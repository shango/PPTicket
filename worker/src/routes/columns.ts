import { Hono } from 'hono';
import { Env, Column } from '../types';
import { requireRole } from '../middleware/auth';

export const columnRoutes = new Hono<{ Bindings: Env }>();

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function isHexColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color);
}

// GET /api/v1/columns
columnRoutes.get('/', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM columns ORDER BY sort_order ASC').all<Column>();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/columns
columnRoutes.post('/', requireRole('admin'), async (c) => {
  const { name, color } = await c.req.json<{ name: string; color?: string }>();

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 50) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Column name is required (max 50 chars).' } }, 400);
  }
  if (color !== undefined && !isHexColor(color)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid color format.' } }, 400);
  }

  const slug = toSlug(name);
  if (!slug) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Column name must contain letters or numbers.' } }, 400);
  }
  const existing = await c.env.DB.prepare('SELECT id, name FROM columns WHERE slug = ?').bind(slug).first<{ id: string; name: string }>();
  if (existing) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: `Slug "${slug}" conflicts with existing column "${existing.name}". Choose a more distinct name.` } }, 409);
  }

  // Place at the end (before terminal columns)
  const maxSort = await c.env.DB.prepare('SELECT MAX(sort_order) as max_sort FROM columns').first<{ max_sort: number | null }>();
  const sortOrder = (maxSort?.max_sort || 0) + 1;

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    'INSERT INTO columns (id, name, slug, sort_order, color, is_initial, is_terminal, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
  ).bind(id, name.trim(), slug, sortOrder, color || '#5f6270', now).run();

  const column = await c.env.DB.prepare('SELECT * FROM columns WHERE id = ?').bind(id).first();
  return c.json({ data: column, error: null }, 201);
});

// PATCH /api/v1/columns/:id
columnRoutes.patch('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ name?: string; color?: string; sort_order?: number; is_initial?: boolean; is_terminal?: boolean }>();

  const col = await c.env.DB.prepare('SELECT * FROM columns WHERE id = ?').bind(id).first<Column>();
  if (!col) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Column not found.' } }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 50) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Column name is required (max 50 chars).' } }, 400);
    }
    updates.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.color !== undefined) {
    if (!isHexColor(body.color)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid color format.' } }, 400);
    }
    updates.push('color = ?'); values.push(body.color);
  }
  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== 'number' || !Number.isFinite(body.sort_order)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid sort order.' } }, 400);
    }
    updates.push('sort_order = ?'); values.push(body.sort_order);
  }

  // Handle is_initial — only one column can be initial
  if (body.is_initial !== undefined) {
    if (body.is_initial) {
      await c.env.DB.prepare('UPDATE columns SET is_initial = 0').run();
    } else {
      // Can't unset if it's the only initial
      const count = await c.env.DB.prepare('SELECT COUNT(*) as count FROM columns WHERE is_initial = 1 AND id != ?').bind(id).first<{ count: number }>();
      if (!count || count.count === 0) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'At least one column must be the initial column.' } }, 403);
      }
    }
    updates.push('is_initial = ?');
    values.push(body.is_initial ? 1 : 0);
  }

  // Handle is_terminal — only one column can be terminal
  if (body.is_terminal !== undefined) {
    if (body.is_terminal) {
      await c.env.DB.prepare('UPDATE columns SET is_terminal = 0').run();
    } else {
      const count = await c.env.DB.prepare('SELECT COUNT(*) as count FROM columns WHERE is_terminal = 1 AND id != ?').bind(id).first<{ count: number }>();
      if (!count || count.count === 0) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'At least one column must be the terminal column.' } }, 403);
      }
    }
    updates.push('is_terminal = ?');
    values.push(body.is_terminal ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(id);
    await c.env.DB.prepare(`UPDATE columns SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM columns WHERE id = ?').bind(id).first();
  return c.json({ data: updated, error: null });
});

// POST /api/v1/columns/reorder
columnRoutes.post('/reorder', requireRole('admin'), async (c) => {
  const { order } = await c.req.json<{ order: { id: string; sort_order: number }[] }>();

  if (!order || !Array.isArray(order)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Order array is required.' } }, 400);
  }

  // Validate all IDs are real columns
  const allCols = await c.env.DB.prepare('SELECT id FROM columns').all<{ id: string }>();
  const validIds = new Set(allCols.results.map(c => c.id));
  const updates = order
    .filter(({ id, sort_order }) => validIds.has(id) && typeof sort_order === 'number')
    .map(({ id, sort_order }) =>
      c.env.DB.prepare('UPDATE columns SET sort_order = ? WHERE id = ?').bind(sort_order, id).run()
    );
  await Promise.all(updates);

  const result = await c.env.DB.prepare('SELECT * FROM columns ORDER BY sort_order ASC').all<Column>();
  return c.json({ data: result.results, error: null });
});

// DELETE /api/v1/columns/:id
columnRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();

  const col = await c.env.DB.prepare('SELECT * FROM columns WHERE id = ?').bind(id).first<Column>();
  if (!col) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Column not found.' } }, 404);
  }

  // Can't delete initial or terminal if they're the last one
  if (col.is_initial) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot delete the initial column. Assign another column as initial first.' } }, 403);
  }
  if (col.is_terminal) {
    const termCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM columns WHERE is_terminal = 1').first<{ count: number }>();
    if (termCount && termCount.count <= 1) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Cannot delete the last terminal column.' } }, 403);
    }
  }

  // Can't delete if tickets exist in this column
  const ticketCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tickets WHERE status = ?').bind(col.slug).first<{ count: number }>();
  if (ticketCount && ticketCount.count > 0) {
    return c.json({ data: null, error: { code: 'CONFLICT', message: `Cannot delete — ${ticketCount.count} tickets are in this column. Move them first.` } }, 409);
  }

  await c.env.DB.prepare('DELETE FROM columns WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Column deleted' }, error: null });
});
