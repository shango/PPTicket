import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const milestoneRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/milestones
milestoneRoutes.get('/', async (c) => {
  const projectId = c.req.query('project');
  const status = c.req.query('status');

  let query = `SELECT m.*, p.name as project_name, p.abbreviation as project_abbreviation, p.color as project_color,
    (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND archived_at IS NULL) as total_tickets,
    (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND archived_at IS NULL AND status IN (SELECT slug FROM columns WHERE is_terminal = 1)) as done_tickets
    FROM milestones m
    LEFT JOIN products p ON m.project_id = p.id`;

  const conditions: string[] = [];
  const params: string[] = [];

  if (projectId) { conditions.push('m.project_id = ?'); params.push(projectId); }
  if (status) { conditions.push('m.status = ?'); params.push(status); }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY p.name ASC, m.sort_order ASC, m.created_at ASC';

  const stmt = c.env.DB.prepare(query);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return c.json({ data: result.results, error: null });
});

// GET /api/v1/milestones/:id
milestoneRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const milestone = await c.env.DB.prepare(
    `SELECT m.*, p.name as project_name, p.abbreviation as project_abbreviation, p.color as project_color,
      (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND archived_at IS NULL) as total_tickets,
      (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND archived_at IS NULL AND status IN (SELECT slug FROM columns WHERE is_terminal = 1)) as done_tickets
      FROM milestones m
      LEFT JOIN products p ON m.project_id = p.id
      WHERE m.id = ?`
  ).bind(id).first();

  if (!milestone) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } }, 404);
  }
  return c.json({ data: milestone, error: null });
});

// POST /api/v1/milestones (dev+ only)
milestoneRoutes.post('/', requireRole('dev', 'admin'), async (c) => {
  const { name, project_id, description, target_date, status } = await c.req.json<{
    name: string;
    project_id: string;
    description?: string;
    target_date?: number | null;
    status?: 'open' | 'closed';
  }>();

  if (!name || !project_id) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Name and project are required.' } }, 400);
  }

  const project = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(project_id).first();
  if (!project) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Project not found.' } }, 400);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Place new milestone at the end
  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as max_order FROM milestones WHERE project_id = ?'
  ).bind(project_id).first<{ max_order: number | null }>();
  const sortOrder = (maxOrder?.max_order ?? 0) + 1;

  await c.env.DB.prepare(
    'INSERT INTO milestones (id, project_id, name, description, target_date, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, project_id, name, description || null, target_date || null, status || 'open', sortOrder, now, now).run();

  const milestone = await c.env.DB.prepare(
    `SELECT m.*, p.name as project_name, p.abbreviation as project_abbreviation, p.color as project_color,
      0 as total_tickets, 0 as done_tickets
      FROM milestones m LEFT JOIN products p ON m.project_id = p.id WHERE m.id = ?`
  ).bind(id).first();
  return c.json({ data: milestone, error: null }, 201);
});

// PATCH /api/v1/milestones/:id (dev+ only)
milestoneRoutes.patch('/:id', requireRole('dev', 'admin'), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    description?: string | null;
    target_date?: number | null;
    status?: 'open' | 'closed';
    sort_order?: number;
  }>();

  const existing = await c.env.DB.prepare('SELECT id FROM milestones WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
  if (body.target_date !== undefined) { updates.push('target_date = ?'); values.push(body.target_date); }
  if (body.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'closed') {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Status must be open or closed.' } }, 400);
    }
    updates.push('status = ?'); values.push(body.status);
  }
  if (body.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(body.sort_order); }

  if (updates.length === 0) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'No fields to update.' } }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await c.env.DB.prepare(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const milestone = await c.env.DB.prepare(
    `SELECT m.*, p.name as project_name, p.abbreviation as project_abbreviation, p.color as project_color,
      (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND archived_at IS NULL) as total_tickets,
      (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND archived_at IS NULL AND status IN (SELECT slug FROM columns WHERE is_terminal = 1)) as done_tickets
      FROM milestones m LEFT JOIN products p ON m.project_id = p.id WHERE m.id = ?`
  ).bind(id).first();
  return c.json({ data: milestone, error: null });
});

// DELETE /api/v1/milestones/:id (admin only)
milestoneRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();

  const existing = await c.env.DB.prepare('SELECT id FROM milestones WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } }, 404);
  }

  // Nullify milestone_id on linked tickets
  await c.env.DB.prepare('UPDATE tickets SET milestone_id = NULL WHERE milestone_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM milestones WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Milestone deleted' }, error: null });
});
