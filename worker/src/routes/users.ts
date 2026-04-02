import { Hono } from 'hono';
import { Env, Role } from '../types';
import { requireRole } from '../middleware/auth';
import { hashPassword } from '../lib/password';
import { sendEmail } from '../lib/email';

const USER_FIELDS = 'id, email, name, first_name, last_name, avatar_url, role, must_change_password, created_at, last_login';

export const userRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/users/me
userRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({ data: user, error: null });
});

// GET /api/v1/users (Admin only)
userRoutes.get('/', requireRole('admin'), async (c) => {
  const result = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users ORDER BY created_at DESC`).all();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/users (Admin only — create user)
userRoutes.post('/', requireRole('admin'), async (c) => {
  const { email, first_name, last_name, password, role } = await c.req.json<{ email: string; first_name: string; last_name: string; password: string; role?: Role }>();

  if (!email || !first_name || !last_name || !password) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Email, first name, last name, and password are required.' } }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid email format.' } }, 400);
  }
  if (password.length < 8) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Password must be at least 8 characters.' } }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
  if (existing) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: 'A user with this email already exists.' } }, 409);
  }

  const validRoles: Role[] = ['viewer', 'decision_maker', 'dev', 'admin'];
  const userRole = role && validRoles.includes(role) ? role : 'viewer';

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  const name = `${first_name.trim()} ${last_name.trim()}`;
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, first_name, last_name, avatar_url, role, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
  ).bind(id, email.toLowerCase().trim(), name, first_name.trim(), last_name.trim(), null, userRole, passwordHash, now).run();

  const user = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
  return c.json({ data: user, error: null }, 201);
});

// PATCH /api/v1/users/:id (Admin only — edit user)
userRoutes.patch('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ first_name?: string; last_name?: string; email?: string; role?: Role }>();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.first_name !== undefined) { updates.push('first_name = ?'); values.push(body.first_name.trim()); }
  if (body.last_name !== undefined) { updates.push('last_name = ?'); values.push(body.last_name.trim()); }
  if (body.first_name !== undefined || body.last_name !== undefined) {
    // Recompute name
    const existing = await c.env.DB.prepare('SELECT first_name, last_name FROM users WHERE id = ?').bind(id).first<{ first_name: string; last_name: string }>();
    const fn = body.first_name?.trim() || existing?.first_name || '';
    const ln = body.last_name?.trim() || existing?.last_name || '';
    updates.push('name = ?'); values.push(`${fn} ${ln}`.trim());
  }
  if (body.email !== undefined) {
    const dup = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(body.email.toLowerCase().trim(), id).first();
    if (dup) return c.json({ data: null, error: { code: 'CONFLICT', message: 'Email already in use.' } }, 409);
    updates.push('email = ?'); values.push(body.email.toLowerCase().trim());
  }
  if (body.role !== undefined) {
    const validRoles: Role[] = ['viewer', 'decision_maker', 'dev', 'admin'];
    if (!validRoles.includes(body.role)) return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid role.' } }, 400);
    // Guard last admin
    if (body.role !== 'admin') {
      const target = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first<{ role: string }>();
      if (target?.role === 'admin') {
        const count = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
        if (count && count.count <= 1) return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot demote the last admin.' } }, 403);
      }
    }
    updates.push('role = ?'); values.push(body.role);
  }

  if (updates.length === 0) return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No fields to update.' } }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  const updated = await c.env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
  return c.json({ data: updated, error: null });
});

// PATCH /api/v1/users/:id/role (Admin only)
userRoutes.patch('/:id/role', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const { role } = await c.req.json<{ role: Role }>();

  const validRoles: Role[] = ['viewer', 'decision_maker', 'dev', 'admin'];
  if (!validRoles.includes(role)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid role.' } }, 400);
  }

  // Guard: can't demote the last admin
  if (role !== 'admin') {
    const target = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first<{ role: string }>();
    if (target?.role === 'admin') {
      const adminCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
      if (adminCount && adminCount.count <= 1) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot demote the last admin.' } }, 403);
      }
    }
  }

  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
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
  if (target?.role === 'admin') {
    const adminCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first<{ count: number }>();
    if (adminCount && adminCount.count <= 1) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot suspend the last admin.' } }, 403);
    }
  }

  const permanent = c.req.query('permanent') === 'true';

  if (permanent) {
    // Clean up all references before deleting
    await c.env.DB.prepare('DELETE FROM ticket_assignees WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE tickets SET submitter_id = ? WHERE submitter_id = ?').bind(currentUser.id, id).run();
    await c.env.DB.prepare('DELETE FROM comments WHERE author_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return c.json({ data: { message: 'User permanently deleted' }, error: null });
  }

  await c.env.DB.prepare("UPDATE users SET role = 'suspended' WHERE id = ?").bind(id).run();
  return c.json({ data: { message: 'User suspended' }, error: null });
});
