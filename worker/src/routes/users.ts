import { Hono } from 'hono';
import { Env, Role } from '../types';
import { requireRole } from '../middleware/auth';

export const userRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/users/me
userRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({ data: user, error: null });
});

// GET /api/v1/users (Admin only)
userRoutes.get('/', requireRole('admin'), async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return c.json({ data: result.results, error: null });
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
  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
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

  await c.env.DB.prepare("UPDATE users SET role = 'suspended' WHERE id = ?").bind(id).run();
  return c.json({ data: { message: 'User suspended' }, error: null });
});
