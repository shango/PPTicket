import { Hono } from 'hono';
import { Env, SubTask } from '../types';
import { requireRole } from '../middleware/auth';

export const subtaskRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/tickets/:ticketId/subtasks
subtaskRoutes.get('/', async (c) => {
  const ticketId = c.req.param('ticketId');
  const result = await c.env.DB.prepare(
    `SELECT s.*,
       (SELECT COUNT(*) FROM attachments WHERE subtask_id = s.id) as attachment_count
     FROM subtasks s WHERE s.ticket_id = ? ORDER BY s.sort_order ASC, s.created_at ASC`
  ).bind(ticketId).all();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/tickets/:ticketId/subtasks
subtaskRoutes.post('/', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const ticketId = c.req.param('ticketId');
  const body = await c.req.json<{
    title: string;
    description?: string;
    due_date?: number | null;
  }>();

  if (!body.title || body.title.length > 200) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Title is required (max 200 chars).' } }, 400);
  }

  const ticket = await c.env.DB.prepare('SELECT id FROM tickets WHERE id = ?').bind(ticketId).first();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Place at end of list
  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM subtasks WHERE ticket_id = ?'
  ).bind(ticketId).first<{ max_order: number }>();
  const sortOrder = (maxOrder?.max_order || 0) + 1;

  await c.env.DB.prepare(
    'INSERT INTO subtasks (id, ticket_id, title, description, due_date, completed, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'
  ).bind(id, ticketId, body.title, body.description || null, body.due_date || null, sortOrder, now, now).run();

  const subtask = await c.env.DB.prepare('SELECT * FROM subtasks WHERE id = ?').bind(id).first();
  return c.json({ data: { ...subtask, attachment_count: 0 }, error: null }, 201);
});

// PATCH /api/v1/tickets/:ticketId/subtasks/:id
subtaskRoutes.patch('/:id', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const { id } = c.req.param();
  const ticketId = c.req.param('ticketId');

  const subtask = await c.env.DB.prepare(
    'SELECT * FROM subtasks WHERE id = ? AND ticket_id = ?'
  ).bind(id, ticketId).first<SubTask>();
  if (!subtask) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Subtask not found.' } }, 404);
  }

  const body = await c.req.json<Partial<{
    title: string;
    description: string | null;
    due_date: number | null;
    completed: boolean;
    sort_order: number;
  }>>();

  const updates: string[] = [];
  const values: any[] = [];
  const now = Math.floor(Date.now() / 1000);

  if (body.title !== undefined) {
    if (!body.title || body.title.length > 200) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Title is required (max 200 chars).' } }, 400);
    }
    updates.push('title = ?'); values.push(body.title);
  }
  if (body.description !== undefined) {
    updates.push('description = ?'); values.push(body.description);
  }
  if (body.due_date !== undefined) {
    updates.push('due_date = ?'); values.push(body.due_date);
  }
  if (body.completed !== undefined) {
    updates.push('completed = ?'); values.push(body.completed ? 1 : 0);
  }
  if (body.sort_order !== undefined) {
    updates.push('sort_order = ?'); values.push(body.sort_order);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?'); values.push(now);
    values.push(id);
    await c.env.DB.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  const updated = await c.env.DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM attachments WHERE subtask_id = s.id) as attachment_count
     FROM subtasks s WHERE s.id = ?`
  ).bind(id).first();
  return c.json({ data: updated, error: null });
});

// DELETE /api/v1/tickets/:ticketId/subtasks/:id
subtaskRoutes.delete('/:id', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const { id } = c.req.param();
  const ticketId = c.req.param('ticketId');

  const subtask = await c.env.DB.prepare(
    'SELECT * FROM subtasks WHERE id = ? AND ticket_id = ?'
  ).bind(id, ticketId).first();
  if (!subtask) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Subtask not found.' } }, 404);
  }

  // Delete R2 objects for subtask attachments
  const attachments = await c.env.DB.prepare(
    'SELECT url FROM attachments WHERE subtask_id = ?'
  ).bind(id).all<{ url: string }>();
  for (const a of attachments.results) {
    try { await c.env.ATTACHMENTS.delete(a.url); } catch { /* ignore */ }
  }

  await c.env.DB.prepare('DELETE FROM subtasks WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Subtask deleted' }, error: null });
});

// POST /api/v1/tickets/:ticketId/subtasks/:id/attachments/upload-url
subtaskRoutes.post('/:id/attachments/upload-url', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const ticketId = c.req.param('ticketId');
  const subtaskId = c.req.param('id');
  const { filename, content_type } = await c.req.json<{ filename: string; content_type: string }>();

  const subtask = await c.env.DB.prepare(
    'SELECT id FROM subtasks WHERE id = ? AND ticket_id = ?'
  ).bind(subtaskId, ticketId).first();
  if (!subtask) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Subtask not found.' } }, 404);
  }

  const safeName = filename.replace(/[/\\:\0]/g, '_').slice(0, 200);
  const key = `tickets/${ticketId}/subtasks/${subtaskId}/${crypto.randomUUID()}-${safeName}`;

  return c.json({
    data: { key, upload_url: `/api/v1/tickets/${ticketId}/attachments/upload?key=${encodeURIComponent(key)}` },
    error: null,
  });
});

// POST /api/v1/tickets/:ticketId/subtasks/:id/attachments
subtaskRoutes.post('/:id/attachments', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const ticketId = c.req.param('ticketId');
  const subtaskId = c.req.param('id');
  const { filename, url, mime_type, size_bytes } = await c.req.json<{
    filename: string; url: string; mime_type?: string; size_bytes?: number;
  }>();

  const subtask = await c.env.DB.prepare(
    'SELECT id FROM subtasks WHERE id = ? AND ticket_id = ?'
  ).bind(subtaskId, ticketId).first();
  if (!subtask) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Subtask not found.' } }, 404);
  }

  // Validate URL is a legitimate R2 key
  const expectedPrefix = `tickets/${ticketId}/`;
  if (!url.startsWith(expectedPrefix) || url.includes('..')) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Invalid attachment URL.' } }, 403);
  }

  const head = await c.env.ATTACHMENTS.head(url);
  if (!head) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Attachment file not found in storage.' } }, 404);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'INSERT INTO attachments (id, ticket_id, subtask_id, uploader_id, filename, url, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, ticketId, subtaskId, user.id, filename, url, mime_type || null, size_bytes || null, now).run();

  const attachment = await c.env.DB.prepare(
    'SELECT a.*, u.name as uploader_name FROM attachments a JOIN users u ON a.uploader_id = u.id WHERE a.id = ?'
  ).bind(id).first();
  return c.json({ data: attachment, error: null }, 201);
});

// GET /api/v1/tickets/:ticketId/subtasks/:id/attachments
subtaskRoutes.get('/:id/attachments', async (c) => {
  const subtaskId = c.req.param('id');
  const result = await c.env.DB.prepare(
    'SELECT a.*, u.name as uploader_name FROM attachments a JOIN users u ON a.uploader_id = u.id WHERE a.subtask_id = ? ORDER BY a.created_at ASC'
  ).bind(subtaskId).all();
  return c.json({ data: result.results, error: null });
});
