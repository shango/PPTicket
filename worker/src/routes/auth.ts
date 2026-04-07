import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Env, User } from '../types';
import { signJWT, verifyJWT } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { sendEmail, newUserEmail } from '../lib/email';

const ALLOWED_DOMAIN = 'pdoexperts.fb.com';

function getCookieOptions(c: any) {
  const isLocal = c.env.FRONTEND_URL?.includes('localhost');
  return {
    httpOnly: true,
    secure: !isLocal,
    sameSite: (isLocal ? 'Lax' : 'Strict') as 'Lax' | 'Strict',
    path: '/',
    maxAge: 2592000, // 30 days
  };
}

export const authRoutes = new Hono<{ Bindings: Env }>();

// POST /auth/login
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (!email || !password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Email and password are required.' } }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await c.env.DB.prepare('SELECT id, email, name, role, password_hash, must_change_password FROM users WHERE email = ?').bind(normalizedEmail).first<User & { password_hash: string; must_change_password: number }>();

  if (!user || !user.password_hash) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password.' } }, 401);
  }

  if (user.role === ('suspended' as any)) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Your account has been suspended.' } }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password.' } }, 401);
  }

  // Update last login
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, user.id).run();

  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, c.env.JWT_SECRET);
  setCookie(c, 'session', token, getCookieOptions(c));

  return c.json({ data: { token, must_change_password: !!user.must_change_password, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, error: null });
});

// POST /auth/register — Self-registration for allowed domain
authRoutes.post('/register', async (c) => {
  const { email, password, first_name, last_name } = await c.req.json<{ email: string; password: string; first_name: string; last_name: string }>();

  if (!email || !password || !first_name?.trim() || !last_name?.trim()) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'All fields are required.' } }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const emailDomain = normalizedEmail.split('@')[1];
  if (emailDomain !== ALLOWED_DOMAIN) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: `Registration is only available for @${ALLOWED_DOMAIN} email addresses.` } }, 403);
  }

  if (password.length < 8) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Password must be at least 8 characters.' } }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
  if (existing) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: 'An account with this email already exists. Please sign in.' } }, 409);
  }

  const name = `${first_name.trim()} ${last_name.trim()}`;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, first_name, last_name, avatar_url, role, password_hash, must_change_password, created_at, last_login) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)'
  ).bind(id, normalizedEmail, name, first_name.trim(), last_name.trim(), 'viewer', passwordHash, now, now).run();

  // Notify admins (respecting email preferences)
  const adminEmails = await c.env.DB.prepare("SELECT email FROM users WHERE role = 'admin' AND notify_user_registered = 1").all<{ email: string }>();
  if (adminEmails.results.length > 0) {
    const emailData = newUserEmail(name, normalizedEmail, c.env.FRONTEND_URL);
    c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: adminEmails.results.map(a => a.email), ...emailData }));
  }

  const token = await signJWT({ sub: id, email: normalizedEmail, role: 'viewer' }, c.env.JWT_SECRET);
  setCookie(c, 'session', token, getCookieOptions(c));

  return c.json({ data: { token, user: { id, email: normalizedEmail, name, role: 'viewer' } }, error: null }, 201);
});

// POST /auth/setup — Initial admin setup (atomic — only works when no users exist)
authRoutes.post('/setup', async (c) => {
  const { email, password, first_name, last_name } = await c.req.json<{ email: string; password: string; first_name: string; last_name: string }>();

  if (!email || !password || !first_name || !last_name) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Email, password, first name, and last name are required.' } }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid email format.' } }, 400);
  }

  if (password.length < 8) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Password must be at least 8 characters.' } }, 400);
  }

  const name = `${first_name.trim()} ${last_name.trim()}`;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  // Atomic insert — only succeeds if no users exist (prevents TOCTOU race)
  const result = await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, first_name, last_name, avatar_url, role, password_hash, created_at, last_login)
     SELECT ?, ?, ?, ?, ?, NULL, 'admin', ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM users)`
  ).bind(id, email.toLowerCase().trim(), name, first_name.trim(), last_name.trim(), passwordHash, now, now).run();

  if (!result.meta.changes || result.meta.changes === 0) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Setup already completed.' } }, 403);
  }

  const token = await signJWT({ sub: id, email, role: 'admin' }, c.env.JWT_SECRET);
  setCookie(c, 'session', token, getCookieOptions(c));

  return c.json({ data: { token, user: { id, email, name, role: 'admin' } }, error: null });
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

  const user = await c.env.DB.prepare('SELECT password_hash, role FROM users WHERE id = ?').bind(payload.sub).first<{ password_hash: string; role: string }>();
  if (!user || !user.password_hash) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } }, 404);
  }

  if (user.role === 'suspended') {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Account suspended.' } }, 401);
  }

  const { current_password, new_password } = await c.req.json<{ current_password: string; new_password: string }>();

  if (!current_password || !new_password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Current and new passwords are required.' } }, 400);
  }
  if (new_password.length < 8) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'New password must be at least 8 characters.' } }, 400);
  }

  const valid = await verifyPassword(current_password, user.password_hash);
  if (!valid) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Current password is incorrect.' } }, 401);
  }

  const newHash = await hashPassword(new_password);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').bind(newHash, payload.sub).run();

  return c.json({ data: { message: 'Password changed successfully.' }, error: null });
});

// POST /auth/logout
authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ data: { message: 'Logged out' }, error: null });
});
