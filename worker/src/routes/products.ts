import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const productRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/products (any authenticated user)
productRoutes.get('/', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM products ORDER BY name ASC').all();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/products (admin only)
productRoutes.post('/', requireRole('admin'), async (c) => {
  const { name, abbreviation, color } = await c.req.json<{ name: string; abbreviation: string; color?: string }>();

  if (!name || !abbreviation) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Name and abbreviation are required.' } }, 400);
  }

  if (abbreviation.length > 5) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Abbreviation must be 5 characters or fewer.' } }, 400);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    'INSERT INTO products (id, name, abbreviation, color, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name, abbreviation.toUpperCase(), color || '#6366f1', now).run();

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return c.json({ data: product, error: null }, 201);
});

// PATCH /api/v1/products/:id (admin only)
productRoutes.patch('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ name?: string; abbreviation?: string; color?: string }>();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
  if (body.abbreviation !== undefined) { updates.push('abbreviation = ?'); values.push(body.abbreviation.toUpperCase()); }
  if (body.color !== undefined) { updates.push('color = ?'); values.push(body.color); }

  if (updates.length === 0) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No fields to update.' } }, 400);
  }

  values.push(id);
  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return c.json({ data: product, error: null });
});

// DELETE /api/v1/products/:id (admin only)
productRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();

  // Check if any tickets reference this product
  const ticketCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tickets WHERE product_id = ?').bind(id).first<{ count: number }>();
  if (ticketCount && ticketCount.count > 0) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: `Cannot delete product — ${ticketCount.count} tickets are assigned to it.` } }, 409);
  }

  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Product deleted' }, error: null });
});
