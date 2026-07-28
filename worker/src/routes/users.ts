import { Hono } from 'hono';
import { Env, AssignableRole, ASSIGNABLE_ROLES } from '../types';
import { requireRole } from '../middleware/auth';
import { hashPassword, validatePassword } from '../lib/password';
import { isValidEmail, normalizeEmail, isAllowedDomain, domainRejectionMessage } from '../lib/email-policy';

const USER_FIELDS = 'id, email, name, first_name, last_name, avatar_url, role, must_change_password, created_at, last_login';

function isAssignableRole(role: unknown): role is AssignableRole {
  return typeof role === 'string' && (ASSIGNABLE_ROLES as string[]).includes(role);
}

/** Invalidate every outstanding session for a user (role change, suspension, ...). */
function revokeSessions(db: D1Database, userId: string) {
  return db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').bind(userId).run();
}

export const userRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/users/me
userRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({ data: user, error: null });
});

// PATCH /api/v1/users/me/theme
userRoutes.patch('/me/theme', async (c) => {
  const user = c.get('user');
  const { theme } = await c.req.json<{ theme: string }>();
  if (!['dark', 'light'].includes(theme)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid theme.' } }, 400);
  }
  await c.env.DB.prepare('UPDATE users SET theme = ? WHERE id = ?').bind(theme, user.id).run();
  return c.json({ data: { theme }, error: null });
});

// PATCH /api/v1/users/me/ticket-size
userRoutes.patch('/me/ticket-size', async (c) => {
  const user = c.get('user');
  const { ticket_size } = await c.req.json<{ ticket_size: string }>();
  if (!['small', 'large'].includes(ticket_size)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid ticket size.' } }, 400);
  }
  await c.env.DB.prepare('UPDATE users SET ticket_size = ? WHERE id = ?').bind(ticket_size, user.id).run();
  return c.json({ data: { ticket_size }, error: null });
});

// PATCH /api/v1/users/me/profile
userRoutes.patch('/me/profile', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ first_name?: string; last_name?: string; email?: string; notification_email?: string | null }>();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.first_name !== undefined) {
    if (typeof body.first_name !== 'string' || !body.first_name.trim()) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'First name is required.' } }, 400);
    }
    updates.push('first_name = ?'); values.push(body.first_name.trim());
  }
  if (body.last_name !== undefined) {
    if (typeof body.last_name !== 'string' || !body.last_name.trim()) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Last name is required.' } }, 400);
    }
    updates.push('last_name = ?'); values.push(body.last_name.trim());
  }
  if (body.first_name !== undefined || body.last_name !== undefined) {
    const fn = body.first_name?.trim() || user.first_name || '';
    const ln = body.last_name?.trim() || user.last_name || '';
    updates.push('name = ?'); values.push(`${fn} ${ln}`.trim());
  }
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid email format.' } }, 400);
    }
    const normalizedEmail = normalizeEmail(body.email);
    // The sign-in domain allowlist has to hold here too, otherwise a user could
    // move their own account off an approved domain and lock themselves out -
    // or park an account on a domain the allowlist was meant to exclude.
    if (!isAllowedDomain(c.env, normalizedEmail)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: domainRejectionMessage(c.env) } }, 400);
    }
    const dup = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(normalizedEmail, user.id).first();
    if (dup) return c.json({ data: null, error: { code: 'CONFLICT', message: 'Email already in use.' } }, 409);
    updates.push('email = ?'); values.push(normalizedEmail);
  }
  if (body.notification_email !== undefined) {
    if (body.notification_email === null || body.notification_email === '') {
      updates.push('notification_email = NULL');
    } else {
      if (!isValidEmail(body.notification_email)) {
        return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid notification email format.' } }, 400);
      }
      updates.push('notification_email = ?'); values.push(normalizeEmail(body.notification_email));
    }
  }

  if (updates.length === 0) return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No fields to update.' } }, 400);

  values.push(user.id);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  return c.json({ data: { message: 'Profile updated' }, error: null });
});

// PATCH /api/v1/users/me/email-preferences
userRoutes.patch('/me/email-preferences', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, boolean>>();

  const validKeys = ['notify_ticket_created', 'notify_ticket_assigned', 'notify_ticket_done', 'notify_ticket_comment', 'notify_user_registered'];
  const updates: string[] = [];
  const values: any[] = [];

  for (const key of validKeys) {
    if (key in body) {
      if (typeof body[key] !== 'boolean') {
        return c.json({ data: null, error: { code: 'INVALID_INPUT', message: `${key} must be a boolean.` } }, 400);
      }
      updates.push(`${key} = ?`);
      values.push(body[key] ? 1 : 0);
    }
  }

  if (updates.length === 0) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No valid preferences provided.' } }, 400);
  }

  values.push(user.id);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  return c.json({ data: { message: 'Preferences updated' }, error: null });
});

// GET /api/v1/users/names (all authenticated users — for @mention autocomplete)
userRoutes.get('/names', async (c) => {
  const result = await c.env.DB.prepare("SELECT id, name FROM users WHERE role != 'suspended' ORDER BY name ASC").all<{ id: string; name: string }>();
  return c.json({ data: result.results, error: null });
});

// GET /api/v1/users (Admin only)
userRoutes.get('/', requireRole('admin'), async (c) => {
  const result = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users ORDER BY created_at DESC`).all();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/users (Admin only — create user)
userRoutes.post('/', requireRole('admin'), async (c) => {
  const { email, first_name, last_name, password, role } = await c.req.json<{ email: string; first_name: string; last_name: string; password: string; role?: AssignableRole }>();

  if (!email || typeof first_name !== 'string' || typeof last_name !== 'string' || !first_name.trim() || !last_name.trim() || !password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Email, first name, last name, and password are required.' } }, 400);
  }
  if (!isValidEmail(email)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid email format.' } }, 400);
  }
  const normalizedEmail = normalizeEmail(email);
  // Without this check an admin can create an account that can never sign in,
  // because /auth/login rejects addresses outside the allowlist.
  if (!isAllowedDomain(c.env, normalizedEmail)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: domainRejectionMessage(c.env) } }, 400);
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: passwordError } }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
  if (existing) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: 'A user with this email already exists.' } }, 409);
  }

  const userRole: AssignableRole = isAssignableRole(role) ? role : 'viewer';

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  const name = `${first_name.trim()} ${last_name.trim()}`;
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, first_name, last_name, avatar_url, role, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
  ).bind(id, normalizedEmail, name, first_name.trim(), last_name.trim(), null, userRole, passwordHash, now).run();

  const user = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
  return c.json({ data: user, error: null }, 201);
});

// PATCH /api/v1/users/:id (Admin only — edit user)
userRoutes.patch('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ first_name?: string; last_name?: string; email?: string; role?: AssignableRole }>();

  const target = await c.env.DB.prepare('SELECT first_name, last_name, role FROM users WHERE id = ?').bind(id).first<{ first_name: string; last_name: string; role: string }>();
  if (!target) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];
  let roleChanged = false;

  if (body.first_name !== undefined) {
    if (typeof body.first_name !== 'string' || !body.first_name.trim()) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'First name is required.' } }, 400);
    }
    updates.push('first_name = ?'); values.push(body.first_name.trim());
  }
  if (body.last_name !== undefined) {
    if (typeof body.last_name !== 'string' || !body.last_name.trim()) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Last name is required.' } }, 400);
    }
    updates.push('last_name = ?'); values.push(body.last_name.trim());
  }
  if (body.first_name !== undefined || body.last_name !== undefined) {
    // Recompute name
    const fn = body.first_name?.trim() || target.first_name || '';
    const ln = body.last_name?.trim() || target.last_name || '';
    updates.push('name = ?'); values.push(`${fn} ${ln}`.trim());
  }
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid email format.' } }, 400);
    }
    const normalizedEmail = normalizeEmail(body.email);
    if (!isAllowedDomain(c.env, normalizedEmail)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: domainRejectionMessage(c.env) } }, 400);
    }
    const dup = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(normalizedEmail, id).first();
    if (dup) return c.json({ data: null, error: { code: 'CONFLICT', message: 'Email already in use.' } }, 409);
    updates.push('email = ?'); values.push(normalizedEmail);
  }
  if (body.role !== undefined) {
    if (!isAssignableRole(body.role)) return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid role.' } }, 400);
    // Guard last admin
    if (body.role !== 'admin' && target.role === 'admin') {
      const count = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
      if (count && count.count <= 1) return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot demote the last admin.' } }, 403);
    }
    roleChanged = body.role !== target.role;
    updates.push('role = ?'); values.push(body.role);
  }

  if (updates.length === 0) return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No fields to update.' } }, 400);

  // The role is baked into the issued JWT, so a demotion has to invalidate
  // existing sessions or the user keeps their old permissions until expiry.
  if (roleChanged) updates.push('token_version = token_version + 1');

  values.push(id);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
  return c.json({ data: updated, error: null });
});

// PATCH /api/v1/users/:id/role (Admin only)
userRoutes.patch('/:id/role', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const { role } = await c.req.json<{ role: AssignableRole }>();

  if (!isAssignableRole(role)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid role.' } }, 400);
  }

  const target = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first<{ role: string }>();
  if (!target) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } }, 404);
  }

  // Guard: can't demote the last admin
  if (role !== 'admin' && target.role === 'admin') {
    const adminCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
    if (adminCount && adminCount.count <= 1) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot demote the last admin.' } }, 403);
    }
  }

  // Sessions carry the role claim, so a change must evict outstanding tokens.
  await c.env.DB.prepare('UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?').bind(role, id).run();
  const updated = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
  return c.json({ data: updated, error: null });
});

// DELETE /api/v1/users/:id (Admin only — soft delete)
userRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get('user');

  if (id === currentUser.id) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot suspend yourself.' } }, 403);
  }

  // Guard: can't suspend the last admin
  const target = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first<{ role: string }>();
  if (!target) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } }, 404);
  }
  if (target.role === 'admin') {
    const adminCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
    if (adminCount && adminCount.count <= 1) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot suspend the last admin.' } }, 403);
    }
  }

  const permanent = c.req.query('permanent') === 'true';

  if (permanent) {
    // Clean up all references before deleting the user row
    await revokeSessions(c.env.DB, id);
    await c.env.DB.prepare('DELETE FROM ticket_assignees WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM ticket_last_seen WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM comments WHERE author_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM attachments WHERE uploader_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM audit_log WHERE actor_id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE products SET default_owner_id = NULL WHERE default_owner_id = ?').bind(id).run();
    // Re-assign tickets to the admin performing the deletion (submitter_id is NOT NULL)
    await c.env.DB.prepare('UPDATE tickets SET submitter_id = ? WHERE submitter_id = ?').bind(currentUser.id, id).run();
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return c.json({ data: { message: 'User permanently deleted' }, error: null });
  }

  // Suspension has to kill live sessions immediately, not at token expiry.
  await c.env.DB.prepare("UPDATE users SET role = 'suspended', token_version = token_version + 1 WHERE id = ?").bind(id).run();
  return c.json({ data: { message: 'User suspended' }, error: null });
});
