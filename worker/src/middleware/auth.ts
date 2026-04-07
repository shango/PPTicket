import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env, JWTPayload, Role, User } from '../types';
import { verifyJWT } from '../lib/jwt';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    jwtPayload: JWTPayload;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Accept token from Authorization header or cookie
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : getCookie(c, 'session');
  if (!token) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401);
  }

  let payload: JWTPayload;
  try {
    payload = await verifyJWT(token, c.env.JWT_SECRET);
  } catch {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session.' } }, 401);
  }

  const user = await c.env.DB.prepare('SELECT id, email, name, first_name, last_name, avatar_url, role, must_change_password, theme, ticket_size, created_at, last_login FROM users WHERE id = ?').bind(payload.sub).first<User>();
  if (!user || user.role === ('suspended' as Role)) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Account not found or suspended.' } }, 401);
  }

  c.set('user', user);
  c.set('jwtPayload', payload);
  await next();
}

export function requireRole(...roles: Role[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } }, 403);
    }
    await next();
  };
}
