import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const projectRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/projects
projectRoutes.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT p.*, u.name as default_owner_name FROM products p LEFT JOIN users u ON p.default_owner_id = u.id ORDER BY p.name ASC'
  ).all();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/projects (admin only)
projectRoutes.post('/', requireRole('admin'), async (c) => {
  const { name, abbreviation, color, default_owner_id } = await c.req.json<{ name: string; abbreviation: string; color?: string; default_owner_id?: string }>();

  if (!name || !abbreviation) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Name and abbreviation are required.' } }, 400);
  }
  if (abbreviation.length > 5) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Abbreviation must be 5 characters or fewer.' } }, 400);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    'INSERT INTO products (id, name, abbreviation, color, default_owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, name, abbreviation.toUpperCase(), color || '#6366f1', default_owner_id || null, now).run();

  const project = await c.env.DB.prepare(
    'SELECT p.*, u.name as default_owner_name FROM products p LEFT JOIN users u ON p.default_owner_id = u.id WHERE p.id = ?'
  ).bind(id).first();
  return c.json({ data: project, error: null }, 201);
});

// PATCH /api/v1/projects/:id (admin only)
projectRoutes.patch('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ name?: string; abbreviation?: string; color?: string; default_owner_id?: string | null }>();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
  if (body.abbreviation !== undefined) { updates.push('abbreviation = ?'); values.push(body.abbreviation.toUpperCase()); }
  if (body.color !== undefined) { updates.push('color = ?'); values.push(body.color); }
  if (body.default_owner_id !== undefined) { updates.push('default_owner_id = ?'); values.push(body.default_owner_id); }

  if (updates.length === 0) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No fields to update.' } }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  const project = await c.env.DB.prepare(
    'SELECT p.*, u.name as default_owner_name FROM products p LEFT JOIN users u ON p.default_owner_id = u.id WHERE p.id = ?'
  ).bind(id).first();
  return c.json({ data: project, error: null });
});

// DELETE /api/v1/projects/:id (admin only)
projectRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();

  const ticketCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tickets WHERE product_id = ?').bind(id).first<{ count: number }>();
  if (ticketCount && ticketCount.count > 0) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: `Cannot delete project — ${ticketCount.count} tickets are assigned to it.` } }, 409);
  }

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Project deleted' }, error: null });
});
