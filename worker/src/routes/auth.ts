import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Env, User } from '../types';
import { signJWT, verifyJWT, SESSION_TTL_SECONDS } from '../lib/jwt';
import { hashPassword, verifyPassword, needsRehash, dummyVerify, validatePassword } from '../lib/password';
import { isValidEmail, normalizeEmail, isAllowedDomain, domainRejectionMessage } from '../lib/email-policy';

function getCookieOptions(c: { env: Env }) {
  const isLocal = c.env.FRONTEND_URL?.includes('localhost');
  return {
    httpOnly: true,
    secure: !isLocal,
    sameSite: (isLocal ? 'Lax' : 'Strict') as 'Lax' | 'Strict',
    path: '/',
    // Kept in step with the JWT lifetime so the cookie never outlives the token
    // it carries (and vice versa).
    maxAge: SESSION_TTL_SECONDS,
  };
}

const GENERIC_LOGIN_ERROR = { code: 'UNAUTHORIZED', message: 'Invalid email or password.' };

/**
 * Rate limit a login attempt by client IP and by target account. The IP limiter
 * stops a single host hammering the endpoint; the email limiter stops a
 * distributed attack from concentrating on one account. Both are best-effort
 * (Workers rate limiting counts per Cloudflare location), so they are a
 * brute-force speed bump layered on top of slow password hashing, not a hard cap.
 */
async function loginRateLimited(c: { env: Env; req: { header: (n: string) => string | undefined } }, emailKey: string): Promise<boolean> {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const checks = await Promise.all([
    c.env.LOGIN_RATE_LIMIT_IP?.limit({ key: ip }) ?? Promise.resolve({ success: true }),
    c.env.LOGIN_RATE_LIMIT_EMAIL?.limit({ key: emailKey }) ?? Promise.resolve({ success: true }),
  ]);
  return checks.some((r) => !r.success);
}

export const authRoutes = new Hono<{ Bindings: Env }>();

// POST /auth/login
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Email and password are required.' } }, 400);
  }

  const normalizedEmail = normalizeEmail(email);

  if (await loginRateLimited(c, normalizedEmail)) {
    return c.json({ data: null, error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please wait a minute and try again.' } }, 429);
  }

  if (!isAllowedDomain(c.env, normalizedEmail)) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: domainRejectionMessage(c.env) } }, 403);
  }

  const user = await c.env.DB
    .prepare('SELECT id, email, name, role, password_hash, must_change_password, token_version FROM users WHERE email = ?')
    .bind(normalizedEmail)
    .first<User & { password_hash: string | null }>();

  // Spend the same work whether or not the account exists, so response timing
  // cannot be used to enumerate valid addresses. All failure paths below return
  // the identical generic error for the same reason.
  if (!user || !user.password_hash) {
    await dummyVerify(password);
    return c.json({ data: null, error: GENERIC_LOGIN_ERROR }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid || user.role === 'suspended') {
    return c.json({ data: null, error: GENERIC_LOGIN_ERROR }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, user.id).run();

  // Transparently upgrade hashes stored with an older format or iteration count.
  // Only possible here, because this is the one place we hold the plaintext.
  if (needsRehash(user.password_hash)) {
    const upgraded = await hashPassword(password);
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(upgraded, user.id).run()
    );
  }

  const token = await signJWT(
    { sub: user.id, email: user.email, role: user.role, tv: user.token_version ?? 0 },
    c.env.JWT_SECRET
  );
  setCookie(c, 'session', token, getCookieOptions(c));

  return c.json({
    data: {
      token,
      must_change_password: !!user.must_change_password,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    },
    error: null,
  });
});

// POST /auth/setup — Initial admin setup (atomic — only works when no users exist)
authRoutes.post('/setup', async (c) => {
  const { email, password, first_name, last_name } = await c.req.json<{ email: string; password: string; first_name: string; last_name: string }>();

  if (!email || !password || typeof first_name !== 'string' || typeof last_name !== 'string' || !first_name.trim() || !last_name.trim()) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Email, password, first name, and last name are required.' } }, 400);
  }

  if (!isValidEmail(email)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid email format.' } }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: passwordError } }, 400);
  }

  const normalizedEmail = normalizeEmail(email);

  // Setup is unauthenticated by necessity, so rate limit it too - otherwise it
  // is a free unauthenticated PBKDF2 oracle even after setup has completed.
  if (await loginRateLimited(c, normalizedEmail)) {
    return c.json({ data: null, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute and try again.' } }, 429);
  }

  const name = `${first_name.trim()} ${last_name.trim()}`;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  // Atomic insert — only succeeds if no users exist (prevents TOCTOU race)
  const result = await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, first_name, last_name, avatar_url, role, password_hash, created_at, last_login, password_changed_at)
     SELECT ?, ?, ?, ?, ?, NULL, 'admin', ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM users)`
  ).bind(id, normalizedEmail, name, first_name.trim(), last_name.trim(), passwordHash, now, now, now).run();

  if (!result.meta.changes || result.meta.changes === 0) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Setup already completed.' } }, 403);
  }

  const token = await signJWT({ sub: id, email: normalizedEmail, role: 'admin', tv: 0 }, c.env.JWT_SECRET);
  setCookie(c, 'session', token, getCookieOptions(c));

  return c.json({ data: { token, user: { id, email: normalizedEmail, name, role: 'admin' } }, error: null });
});

// POST /auth/change-password (authenticated — with suspended check)
authRoutes.post('/change-password', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : getCookie(c, 'session') || null;
  if (!token) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401);
  }

  let payload;
  try {
    payload = await verifyJWT(token, c.env.JWT_SECRET);
  } catch {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session.' } }, 401);
  }

  const user = await c.env.DB
    .prepare('SELECT id, email, password_hash, role, token_version FROM users WHERE id = ?')
    .bind(payload.sub)
    .first<{ id: string; email: string; password_hash: string | null; role: string; token_version: number }>();
  if (!user || !user.password_hash) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } }, 404);
  }

  if (user.role === 'suspended') {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Account suspended.' } }, 401);
  }

  // This route runs outside authMiddleware, so the session-generation check has
  // to be repeated here or a revoked token could still rotate the password.
  if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session.' } }, 401);
  }

  const { current_password, new_password, notification_email } = await c.req.json<{ current_password: string; new_password: string; notification_email?: string }>();

  if (typeof current_password !== 'string' || !current_password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Current and new passwords are required.' } }, 400);
  }
  const passwordError = validatePassword(new_password);
  if (passwordError) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: passwordError } }, 400);
  }
  if (new_password === current_password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'New password must be different from the current one.' } }, 400);
  }
  if (notification_email && !isValidEmail(notification_email)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid notification email format.' } }, 400);
  }

  const valid = await verifyPassword(current_password, user.password_hash);
  if (!valid) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Current password is incorrect.' } }, 401);
  }

  // Bumping token_version invalidates every other outstanding session for this
  // user, which is the point: a password change must evict an attacker who
  // already holds a token.
  const newHash = await hashPassword(new_password);
  const now = Math.floor(Date.now() / 1000);
  const newTokenVersion = (user.token_version ?? 0) + 1;

  if (notification_email) {
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?, token_version = ?, notification_email = ? WHERE id = ?'
    ).bind(newHash, now, newTokenVersion, normalizeEmail(notification_email), user.id).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?, token_version = ? WHERE id = ?'
    ).bind(newHash, now, newTokenVersion, user.id).run();
  }

  // Re-issue the caller's own session at the new generation so the device that
  // just changed the password stays signed in.
  const freshToken = await signJWT(
    { sub: user.id, email: user.email, role: user.role as User['role'], tv: newTokenVersion },
    c.env.JWT_SECRET
  );
  setCookie(c, 'session', freshToken, getCookieOptions(c));

  return c.json({ data: { message: 'Password changed successfully.', token: freshToken }, error: null });
});

// POST /auth/logout
authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ data: { message: 'Logged out' }, error: null });
});
