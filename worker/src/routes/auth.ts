import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Env, User } from '../types';
import { signJWT } from '../lib/jwt';
import { sendEmail, newUserEmail } from '../lib/email';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get('/google', (c) => {
  const state = crypto.randomUUID();
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 300,
  });

  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=no_code`);
  }

  // Verify OAuth state to prevent CSRF
  const cookieState = getCookie(c, 'oauth_state');
  const queryState = c.req.query('state');
  deleteCookie(c, 'oauth_state', { path: '/' });
  if (!cookieState || cookieState !== queryState) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=state_mismatch`);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=token_exchange`);
  }

  const tokens = await tokenRes.json<{ access_token: string }>();

  // Get user info
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=userinfo`);
  }

  const googleUser = await userInfoRes.json<{ email: string; name: string; picture: string }>();

  // Domain check
  const domain = googleUser.email.split('@')[1];
  if (domain !== c.env.ALLOWED_DOMAIN) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=domain`);
  }

  // Check if user exists
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(googleUser.email).first<User>();
  const now = Math.floor(Date.now() / 1000);

  if (!user) {
    // Create new user with viewer role
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, name, avatar_url, role, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, googleUser.email, googleUser.name, googleUser.picture || null, 'viewer', now, now).run();

    user = { id, email: googleUser.email, name: googleUser.name, avatar_url: googleUser.picture || null, role: 'viewer', created_at: now, last_login: now };

    // Notify admins and devs
    const recipients = await c.env.DB.prepare("SELECT email FROM users WHERE role IN ('admin', 'dev')").all<{ email: string }>();
    if (recipients.results.length > 0) {
      const email = newUserEmail(googleUser.name, googleUser.email, c.env.FRONTEND_URL);
      c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: recipients.results.map(r => r.email), ...email }));
    }
  } else {
    // Update last login
    await c.env.DB.prepare('UPDATE users SET last_login = ?, name = ?, avatar_url = ? WHERE id = ?')
      .bind(now, googleUser.name, googleUser.picture || null, user.id).run();
    user.last_login = now;
  }

  // Issue JWT
  const token = await signJWT({ sub: user.id, email: user.email, role: user.role }, c.env.JWT_SECRET);

  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 28800, // 8 hours
  });

  // Redirect based on role
  const landingPages: Record<string, string> = {
    viewer: '/board',
    decision_maker: '/submit',
    dev: '/board',
    admin: '/board',
  };

  return c.redirect(`${c.env.FRONTEND_URL}${landingPages[user.role] || '/board'}`);
});

authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ data: { message: 'Logged out' }, error: null });
});
