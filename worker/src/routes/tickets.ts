import { Hono } from 'hono';
import { Env, Ticket, TicketStatus, TicketType, Priority } from '../types';
import { requireRole } from '../middleware/auth';
import { sendEmail, newTicketEmail, ticketAssignedEmail, ticketStatusEmail } from '../lib/email';

export const ticketRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/tickets
ticketRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const assignee = c.req.query('assignee');
  const tag = c.req.query('tag');
  const submitter = c.req.query('submitter');
  const product = c.req.query('product');

  let query = 'SELECT t.*, GROUP_CONCAT(tt.tag) as tags, p.name as product_name, p.abbreviation as product_abbreviation, p.color as product_color, u.name as submitter_name, a.name as assignee_name FROM tickets t LEFT JOIN ticket_tags tt ON t.id = tt.ticket_id LEFT JOIN products p ON t.product_id = p.id LEFT JOIN users u ON t.submitter_id = u.id LEFT JOIN users a ON t.assignee_id = a.id';
  const conditions: string[] = [];
  const params: string[] = [];

  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
  if (assignee) { conditions.push('t.assignee_id = ?'); params.push(assignee); }
  if (submitter) { conditions.push('t.submitter_id = ?'); params.push(submitter); }
  if (tag) { conditions.push('EXISTS (SELECT 1 FROM ticket_tags WHERE ticket_id = t.id AND tag = ?)'); params.push(tag); }
  if (product) { conditions.push('t.product_id = ?'); params.push(product); }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY t.id ORDER BY t.sort_order ASC';

  const stmt = c.env.DB.prepare(query);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all();

  // Parse tags from comma-separated string to array
  const tickets = result.results.map((t: any) => ({
    ...t,
    tags: t.tags ? t.tags.split(',') : [],
  }));

  return c.json({ data: tickets, error: null });
});

// POST /api/v1/tickets
ticketRoutes.post('/', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    title: string;
    description: string;
    priority?: Priority;
    tags?: string[];
    edc?: number | null;
    product_version?: string | null;
    ticket_type?: TicketType;
    product_id?: string | null;
    submitter_id?: string | null;
  }>();

  if (!body.title || body.title.length > 200) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Title is required (max 200 chars).' } }, 400);
  }
  if (!body.description || body.description.length < 20) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Description is required (min 20 chars).' } }, 400);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const priority = body.priority || 'p2';
  // Only admins can set a different submitter
  const submitterId = (body.submitter_id && user.role === 'admin') ? body.submitter_id : user.id;

  // Get the initial column
  const initialCol = await c.env.DB.prepare('SELECT slug FROM columns WHERE is_initial = 1 LIMIT 1').first<{ slug: string }>();
  const initialStatus = initialCol?.slug || 'backlog';

  // Auto-assign to project's default owner if a project is selected
  let assigneeId: string | null = null;
  if (body.product_id) {
    const project = await c.env.DB.prepare('SELECT default_owner_id FROM products WHERE id = ?').bind(body.product_id).first<{ default_owner_id: string | null }>();
    if (project?.default_owner_id) assigneeId = project.default_owner_id;
  }

  // Atomic insert with computed ticket_number and sort_order to avoid race conditions
  await c.env.DB.prepare(
    `INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, assignee_id, submitter_id, edc, product_version, sort_order, created_at, updated_at)
     SELECT ?, COALESCE(MAX(ticket_number), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM tickets WHERE status = ?), 0) + 1, ?, ?
     FROM tickets`
  ).bind(id, body.title, body.description, initialStatus, priority, body.ticket_type || 'bug', body.product_id || null, assigneeId, submitterId, body.edc || null, body.product_version || null, initialStatus, now, now).run();

  const inserted = await c.env.DB.prepare('SELECT ticket_number FROM tickets WHERE id = ?').bind(id).first<{ ticket_number: number }>();
  const ticketNumber = inserted!.ticket_number;

  // Insert tags
  if (body.tags && body.tags.length > 0) {
    const tagInserts = body.tags.slice(0, 5).map(tag =>
      c.env.DB.prepare('INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?)').bind(id, tag.trim()).run()
    );
    await Promise.all(tagInserts);
  }

  // Notify project default owner + all admins
  const adminEmails = await c.env.DB.prepare("SELECT email FROM users WHERE role = 'admin'").all<{ email: string }>();
  const toEmails = new Set(adminEmails.results.map(r => r.email));

  // Add the project's default owner if assigned
  if (assigneeId) {
    const ownerEmail = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(assigneeId).first<{ email: string }>();
    if (ownerEmail) toEmails.add(ownerEmail.email);
  }

  if (toEmails.size > 0) {
    const email = newTicketEmail(ticketNumber, body.title, priority, user.name, c.env.FRONTEND_URL);
    c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: [...toEmails], ...email }));
  }

  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  return c.json({ data: { ...ticket, tags: body.tags || [] }, error: null }, 201);
});

// GET /api/v1/tickets/:id
ticketRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const ticket = await c.env.DB.prepare(
    'SELECT t.*, u.name as submitter_name, a.name as assignee_name, p.name as product_name, p.abbreviation as product_abbreviation, p.color as product_color FROM tickets t LEFT JOIN users u ON t.submitter_id = u.id LEFT JOIN users a ON t.assignee_id = a.id LEFT JOIN products p ON t.product_id = p.id WHERE t.id = ?'
  ).bind(id).first();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const tags = await c.env.DB.prepare('SELECT tag FROM ticket_tags WHERE ticket_id = ?').bind(id).all<{ tag: string }>();
  const commentCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE ticket_id = ?').bind(id).first<{ count: number }>();
  const attachmentCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM attachments WHERE ticket_id = ?').bind(id).first<{ count: number }>();

  return c.json({
    data: {
      ...ticket,
      tags: tags.results.map(t => t.tag),
      comment_count: commentCount?.count || 0,
      attachment_count: attachmentCount?.count || 0,
    },
    error: null,
  });
});

// PATCH /api/v1/tickets/:id
ticketRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first<Ticket>();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  // Permission check: dev+ can edit any ticket, decision_maker can edit own tickets only
  if (user.role === 'decision_maker' && ticket.submitter_id !== user.id) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You can only edit your own tickets.' } }, 403);
  }
  if (user.role === 'viewer') {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } }, 403);
  }

  const body = await c.req.json<Partial<{
    title: string;
    description: string;
    priority: Priority;
    assignee_id: string | null;
    edc: number | null;
    product_version: string | null;
    ticket_type: TicketType;
    product_id: string | null;
    tags: string[];
  }>>();

  const isDM = user.role === 'decision_maker';
  const updates: string[] = [];
  const values: any[] = [];
  const now = Math.floor(Date.now() / 1000);

  if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
  if (body.product_version !== undefined) { updates.push('product_version = ?'); values.push(body.product_version); }
  if (body.ticket_type !== undefined) { updates.push('ticket_type = ?'); values.push(body.ticket_type); }
  if (body.product_id !== undefined) { updates.push('product_id = ?'); values.push(body.product_id); }

  // Priority and assignee changes are restricted to dev/admin
  if (body.priority !== undefined) {
    if (isDM) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Only devs and admins can change priority.' } }, 403);
    }
    updates.push('priority = ?'); values.push(body.priority);
  }
  if (body.edc !== undefined) { updates.push('edc = ?'); values.push(body.edc); }

  // Handle assignee change with notification (dev/admin only)
  if (body.assignee_id !== undefined) {
    if (isDM) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Only devs and admins can assign tickets.' } }, 403);
    }
    updates.push('assignee_id = ?');
    values.push(body.assignee_id);

    if (body.assignee_id && body.assignee_id !== ticket.assignee_id) {
      const assignee = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(body.assignee_id).first<{ email: string }>();
      if (assignee) {
        const email = ticketAssignedEmail(ticket.ticket_number, ticket.title, ticket.priority, ticket.edc, c.env.FRONTEND_URL);
        c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: [assignee.email], ...email }));
      }
    }
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);
    await c.env.DB.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  // Handle tags update
  if (body.tags !== undefined) {
    await c.env.DB.prepare('DELETE FROM ticket_tags WHERE ticket_id = ?').bind(id).run();
    const tagInserts = body.tags.slice(0, 5).map(tag =>
      c.env.DB.prepare('INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?)').bind(id, tag.trim()).run()
    );
    await Promise.all(tagInserts);
  }

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  const tags = await c.env.DB.prepare('SELECT tag FROM ticket_tags WHERE ticket_id = ?').bind(id).all<{ tag: string }>();
  return c.json({ data: { ...updated, tags: tags.results.map(t => t.tag) }, error: null });
});

// PATCH /api/v1/tickets/:id/move (Dev+ only)
ticketRoutes.patch('/:id/move', requireRole('dev', 'admin'), async (c) => {
  const { id } = c.req.param();
  const { status, sort_order } = await c.req.json<{ status: string; sort_order: number }>();

  // Validate status against columns table
  const column = await c.env.DB.prepare('SELECT * FROM columns WHERE slug = ?').bind(status).first<{ slug: string; is_terminal: number }>();
  if (!column) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid status.' } }, 400);
  }

  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first<Ticket>();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('UPDATE tickets SET status = ?, sort_order = ?, updated_at = ? WHERE id = ?')
    .bind(status, sort_order, now, id).run();

  // Notify submitter when moved to a terminal column
  if (column.is_terminal && ticket.status !== status) {
    const submitter = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(ticket.submitter_id).first<{ email: string }>();
    if (submitter) {
      const email = ticketStatusEmail(ticket.ticket_number, ticket.title, status, c.env.FRONTEND_URL);
      c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: [submitter.email], ...email }));
    }
  }

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  return c.json({ data: updated, error: null });
});

// GET /api/v1/tickets/:id/comments
ticketRoutes.get('/:id/comments', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    'SELECT c.*, u.name as author_name, u.avatar_url as author_avatar FROM comments c JOIN users u ON c.author_id = u.id WHERE c.ticket_id = ? ORDER BY c.created_at ASC'
  ).bind(id).all();
  return c.json({ data: result.results, error: null });
});

// POST /api/v1/tickets/:id/comments
ticketRoutes.post('/:id/comments', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const { id: ticketId } = c.req.param();
  const { body } = await c.req.json<{ body: string }>();

  if (!body || body.trim().length === 0) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Comment body is required.' } }, 400);
  }

  const ticket = await c.env.DB.prepare('SELECT id FROM tickets WHERE id = ?').bind(ticketId).first();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'INSERT INTO comments (id, ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, ticketId, user.id, body, now).run();

  const comment = await c.env.DB.prepare(
    'SELECT c.*, u.name as author_name, u.avatar_url as author_avatar FROM comments c JOIN users u ON c.author_id = u.id WHERE c.id = ?'
  ).bind(id).first();
  return c.json({ data: comment, error: null }, 201);
});

// POST /api/v1/tickets/:id/attachments/upload-url
ticketRoutes.post('/:id/attachments/upload-url', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const { id: ticketId } = c.req.param();
  const { filename, content_type } = await c.req.json<{ filename: string; content_type: string }>();

  const ticket = await c.env.DB.prepare('SELECT id FROM tickets WHERE id = ?').bind(ticketId).first();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const key = `tickets/${ticketId}/${crypto.randomUUID()}-${filename}`;

  // For R2, we return the key and the client uploads via a Worker proxy endpoint
  return c.json({
    data: { key, upload_url: `/api/v1/tickets/${ticketId}/attachments/upload?key=${encodeURIComponent(key)}` },
    error: null,
  });
});

// PUT upload proxy for R2
ticketRoutes.put('/:id/attachments/upload', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const { id: ticketId } = c.req.param();
  const key = c.req.query('key');
  if (!key) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Missing key parameter.' } }, 400);
  }

  // Validate key belongs to this ticket to prevent path traversal / object hijacking
  const expectedPrefix = `tickets/${ticketId}/`;
  if (!key.startsWith(expectedPrefix) || key.includes('..')) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Invalid upload key.' } }, 403);
  }

  const body = await c.req.arrayBuffer();
  await c.env.ATTACHMENTS.put(key, body, {
    httpMetadata: { contentType: c.req.header('content-type') || 'application/octet-stream' },
  });

  return c.json({ data: { key, url: key }, error: null });
});

// POST /api/v1/tickets/:id/attachments
ticketRoutes.post('/:id/attachments', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const { id: ticketId } = c.req.param();
  const { filename, url, mime_type, size_bytes } = await c.req.json<{
    filename: string; url: string; mime_type?: string; size_bytes?: number;
  }>();

  // Validate URL is a legitimate R2 key belonging to this ticket
  const expectedPrefix = `tickets/${ticketId}/`;
  if (!url.startsWith(expectedPrefix) || url.includes('..')) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Invalid attachment URL.' } }, 403);
  }

  // Verify the object actually exists in R2
  const head = await c.env.ATTACHMENTS.head(url);
  if (!head) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Attachment file not found in storage.' } }, 404);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'INSERT INTO attachments (id, ticket_id, uploader_id, filename, url, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, ticketId, user.id, filename, url, mime_type || null, size_bytes || null, now).run();

  const attachment = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first();
  return c.json({ data: attachment, error: null }, 201);
});

// GET /api/v1/tickets/:id/attachments
ticketRoutes.get('/:id/attachments', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    'SELECT a.*, u.name as uploader_name FROM attachments a JOIN users u ON a.uploader_id = u.id WHERE a.ticket_id = ? ORDER BY a.created_at ASC'
  ).bind(id).all();
  return c.json({ data: result.results, error: null });
});

// DELETE /api/v1/tickets/:id (Admin only)
ticketRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param();
  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Ticket deleted' }, error: null });
});
