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

const USER_SESSION_FIELDS =
  'id, email, name, first_name, last_name, avatar_url, role, must_change_password, theme, ticket_size, ' +
  'notification_email, notify_ticket_created, notify_ticket_assigned, notify_ticket_done, notify_ticket_comment, ' +
  'notify_user_registered, token_version, created_at, last_login';

// Read-only endpoints that can be viewed without an account (anonymous board + ticket viewing).
// Everything else still requires a valid session. Only GET requests matching these are public.
const PUBLIC_READ_PATTERNS: RegExp[] = [
  /^\/api\/v1\/tickets(\/.*)?$/,                  // board list, ticket detail, comments, attachments, subtasks
  /^\/api\/v1\/columns\/?$/,                      // board columns
  /^\/api\/v1\/projects\/?$/,                     // project filter
  /^\/api\/v1\/milestones(\/[^/]+)?\/?$/,         // milestone filter + detail
  /^\/api\/v1\/attachments\/[^/]+\/download\/?$/, // serve attachment files (cover images, downloads)
];

// The only endpoint a user with a forced password change may still call, so the
// frontend can load enough state to route them to the change-password screen.
const PASSWORD_CHANGE_ALLOWED = /^\/api\/v1\/users\/me\/?$/;

function isPublicRead(c: Context<{ Bindings: Env }>): boolean {
  if (c.req.method !== 'GET') return false;
  return PUBLIC_READ_PATTERNS.some((re) => re.test(c.req.path));
}

/**
 * Extract the bearer token. Deliberately only the Authorization header and the
 * session cookie - never a query parameter, because URLs leak into browser
 * history, Referer headers, and request logs.
 */
function extractToken(c: Context<{ Bindings: Env }>): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return getCookie(c, 'session') || null;
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // A missing/invalid token is tolerated for public read endpoints - the request
  // simply proceeds anonymously (no `user` set on the context).
  const token = extractToken(c);

  if (token) {
    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      const user = await c.env.DB
        .prepare(`SELECT ${USER_SESSION_FIELDS} FROM users WHERE id = ?`)
        .bind(payload.sub)
        .first<User>();

      // Tokens minted before session versioning existed carry no `tv`; treat
      // them as generation 0 so they keep working until they expire.
      const tokenVersion = payload.tv ?? 0;
      const sessionValid = !!user && user.role !== 'suspended' && tokenVersion === (user.token_version ?? 0);

      if (sessionValid) {
        if (user!.must_change_password && !PASSWORD_CHANGE_ALLOWED.test(c.req.path)) {
          return c.json({
            data: null,
            error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your password before continuing.' },
          }, 403);
        }
        c.set('user', user!);
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
    if (!user || !roles.includes(user.role)) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } }, 403);
    }
    await next();
  };
}
