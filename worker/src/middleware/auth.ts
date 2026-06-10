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

// Read-only endpoints that can be viewed without an account (anonymous board + ticket viewing).
// Everything else still requires a valid session. Only GET requests matching these are public.
const PUBLIC_READ_PATTERNS: RegExp[] = [
  /^\/api\/v1\/tickets(\/.*)?$/,                  // board list, ticket detail, comments, attachments, subtasks
  /^\/api\/v1\/columns\/?$/,                      // board columns
  /^\/api\/v1\/projects\/?$/,                     // project filter
  /^\/api\/v1\/milestones(\/[^/]+)?\/?$/,         // milestone filter + detail
  /^\/api\/v1\/attachments\/[^/]+\/download\/?$/, // serve attachment files (cover images, downloads)
];

function isPublicRead(c: Context<{ Bindings: Env }>): boolean {
  if (c.req.method !== 'GET') return false;
  return PUBLIC_READ_PATTERNS.some((re) => re.test(c.req.path));
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Accept token from Authorization header, cookie, or query param. Unlike protected
  // routes, a missing/invalid token here is tolerated for public read endpoints — the
  // request simply proceeds anonymously (no `user` set on the context).
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : getCookie(c, 'session') || c.req.query('token');

  if (token) {
    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      const user = await c.env.DB.prepare('SELECT id, email, name, first_name, last_name, avatar_url, role, must_change_password, theme, ticket_size, notification_email, notify_ticket_created, notify_ticket_assigned, notify_ticket_done, notify_ticket_comment, notify_user_registered, created_at, last_login FROM users WHERE id = ?').bind(payload.sub).first<User>();
      if (user && user.role !== ('suspended' as Role)) {
        c.set('user', user);
        c.set('jwtPayload', payload);
        return await next();
      }
    } catch {
      // Invalid/expired token — fall through to anonymous handling below.
    }
  }

  // No valid session. Allow anonymous viewing of public read endpoints; reject everything else.
  if (isPublicRead(c)) {
    return await next();
  }
  return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401);
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
