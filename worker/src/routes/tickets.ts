import { Hono } from 'hono';
import { Env, Ticket, TicketStatus, TicketType, Priority } from '../types';
import { requireRole } from '../middleware/auth';
import { sendEmail, newTicketEmail, ticketAssignedEmail, ticketStatusEmail, newCommentEmail } from '../lib/email';
import { sendPushToUser, sendPushToUsers } from '../lib/push';

export const ticketRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/tickets
ticketRoutes.get('/', async (c) => {
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const assignee = c.req.query('assignee');
  const tag = c.req.query('tag');
  const submitter = c.req.query('submitter');
  const product = c.req.query('product');

  let query = 'SELECT t.*, GROUP_CONCAT(DISTINCT tt.tag) as tags, GROUP_CONCAT(DISTINCT ta.user_id) as assignee_ids, GROUP_CONCAT(DISTINCT a.name) as assignee_names, p.name as product_name, p.abbreviation as product_abbreviation, p.color as product_color, u.name as submitter_name FROM tickets t LEFT JOIN ticket_tags tt ON t.id = tt.ticket_id LEFT JOIN ticket_assignees ta ON t.id = ta.ticket_id LEFT JOIN users a ON ta.user_id = a.id LEFT JOIN products p ON t.product_id = p.id LEFT JOIN users u ON t.submitter_id = u.id';
  const conditions: string[] = [];
  const params: string[] = [];

  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
  if (assignee) { conditions.push('EXISTS (SELECT 1 FROM ticket_assignees WHERE ticket_id = t.id AND user_id = ?)'); params.push(assignee); }
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
    assignee_ids: t.assignee_ids ? t.assignee_ids.split(',') : [],
    assignee_names: t.assignee_names ? t.assignee_names.split(',') : [],
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
  const validPriorities = ['p0', 'p1', 'p2', 'p3'];
  const priority = body.priority && validPriorities.includes(body.priority) ? body.priority : 'p2';
  const validTypes = ['bug', 'feature'];
  if (body.ticket_type && !validTypes.includes(body.ticket_type)) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid ticket type.' } }, 400);
  }
  // Only admins can set a different submitter
  let submitterId = user.id;
  if (body.submitter_id && user.role === 'admin') {
    const submitterExists = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND role != 'suspended'").bind(body.submitter_id).first();
    if (!submitterExists) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid submitter.' } }, 400);
    }
    submitterId = body.submitter_id;
  }

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
    `INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, submitter_id, edc, product_version, sort_order, created_at, updated_at)
     SELECT ?, COALESCE(MAX(ticket_number), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM tickets WHERE status = ?), 0) + 1, ?, ?
     FROM tickets`
  ).bind(id, body.title, body.description, initialStatus, priority, body.ticket_type || 'bug', body.product_id || null, submitterId, body.edc || null, body.product_version || null, initialStatus, now, now).run();

  // Add default assignee to junction table
  if (assigneeId) {
    await c.env.DB.prepare(
      'INSERT INTO ticket_assignees (ticket_id, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(id, assigneeId, now).run();
  }

  const inserted = await c.env.DB.prepare('SELECT ticket_number FROM tickets WHERE id = ?').bind(id).first<{ ticket_number: number }>();
  const ticketNumber = inserted!.ticket_number;

  // Insert tags
  if (body.tags && body.tags.length > 0) {
    const tagInserts = body.tags.slice(0, 5).map(tag =>
      c.env.DB.prepare('INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?)').bind(id, tag.trim().slice(0, 50)).run()
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

  // Push notification for new ticket to admins + default owner
  const pushRecipientIds: string[] = [];
  const admins = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'admin' AND id != ?").bind(user.id).all<{ id: string }>();
  pushRecipientIds.push(...admins.results.map(a => a.id));
  if (assigneeId && assigneeId !== user.id) pushRecipientIds.push(assigneeId);
  if (pushRecipientIds.length > 0) {
    c.executionCtx.waitUntil(sendPushToUsers(c.env.DB, pushRecipientIds, {
      type: 'new_ticket', ticketNumber, title: body.title, body: `New ${body.ticket_type || 'bug'} ticket from ${user.name}`,
    }, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY));
  }

  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  const assignees = await c.env.DB.prepare(
    'SELECT ta.user_id, u.name FROM ticket_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.ticket_id = ?'
  ).bind(id).all<{ user_id: string; name: string }>();
  return c.json({ data: { ...ticket, tags: body.tags || [], assignee_ids: assignees.results.map(a => a.user_id), assignee_names: assignees.results.map(a => a.name) }, error: null }, 201);
});

// GET /api/v1/tickets/:id
ticketRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const ticket = await c.env.DB.prepare(
    'SELECT t.*, u.name as submitter_name, p.name as product_name, p.abbreviation as product_abbreviation, p.color as product_color FROM tickets t LEFT JOIN users u ON t.submitter_id = u.id LEFT JOIN products p ON t.product_id = p.id WHERE t.id = ?'
  ).bind(id).first();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const tags = await c.env.DB.prepare('SELECT tag FROM ticket_tags WHERE ticket_id = ?').bind(id).all<{ tag: string }>();
  const assignees = await c.env.DB.prepare(
    'SELECT ta.user_id, u.name FROM ticket_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.ticket_id = ?'
  ).bind(id).all<{ user_id: string; name: string }>();
  const commentCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE ticket_id = ?').bind(id).first<{ count: number }>();
  const attachmentCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM attachments WHERE ticket_id = ?').bind(id).first<{ count: number }>();

  return c.json({
    data: {
      ...ticket,
      tags: tags.results.map(t => t.tag),
      assignee_ids: assignees.results.map(a => a.user_id),
      assignee_names: assignees.results.map(a => a.name),
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
    assignee_ids: string[];
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

  if (body.title !== undefined) {
    if (!body.title || body.title.length > 200) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Title is required (max 200 chars).' } }, 400);
    }
    updates.push('title = ?'); values.push(body.title);
  }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
  if (body.product_version !== undefined) { updates.push('product_version = ?'); values.push(body.product_version); }
  if (body.ticket_type !== undefined) {
    if (!['bug', 'feature'].includes(body.ticket_type)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid ticket type.' } }, 400);
    }
    updates.push('ticket_type = ?'); values.push(body.ticket_type);
  }
  if (body.product_id !== undefined) { updates.push('product_id = ?'); values.push(body.product_id); }

  // Priority and assignee changes are restricted to dev/admin
  if (body.priority !== undefined) {
    if (isDM) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Only devs and admins can change priority.' } }, 403);
    }
    if (!['p0', 'p1', 'p2', 'p3'].includes(body.priority)) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid priority.' } }, 400);
    }
    updates.push('priority = ?'); values.push(body.priority);
  }
  if (body.edc !== undefined) { updates.push('edc = ?'); values.push(body.edc); }

  // Handle assignee changes with notification (dev/admin only)
  if (body.assignee_ids !== undefined) {
    if (isDM) {
      return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Only devs and admins can assign tickets.' } }, 403);
    }

    // Get current assignees for diff
    const currentAssignees = await c.env.DB.prepare(
      'SELECT user_id FROM ticket_assignees WHERE ticket_id = ?'
    ).bind(id).all<{ user_id: string }>();
    const currentIds = new Set(currentAssignees.results.map(a => a.user_id));

    // Delete and reinsert
    await c.env.DB.prepare('DELETE FROM ticket_assignees WHERE ticket_id = ?').bind(id).run();
    if (body.assignee_ids.length > 0) {
      const inserts = body.assignee_ids.slice(0, 10).map(userId =>
        c.env.DB.prepare('INSERT INTO ticket_assignees (ticket_id, user_id, created_at) VALUES (?, ?, ?)')
          .bind(id, userId, now).run()
      );
      await Promise.all(inserts);
    }

    // Notify newly added assignees only
    const newAssignees = body.assignee_ids.filter(uid => !currentIds.has(uid));
    for (const assigneeUserId of newAssignees) {
      const assignee = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(assigneeUserId).first<{ email: string }>();
      if (assignee) {
        const email = ticketAssignedEmail(ticket.ticket_number, ticket.title, ticket.priority, ticket.edc, c.env.FRONTEND_URL);
        c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: [assignee.email], ...email }));
      }
    }

    // Push notification to newly assigned users
    if (newAssignees.length > 0) {
      c.executionCtx.waitUntil(sendPushToUsers(c.env.DB, newAssignees, {
        type: 'assigned', ticketNumber: ticket.ticket_number, title: ticket.title,
        body: `You've been assigned to PDO-${ticket.ticket_number}: ${ticket.title}`,
      }, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY));
    }

    // Mark updated_at even if no other field changes
    if (updates.length === 0) {
      updates.push('updated_at = ?');
      values.push(now);
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
      c.env.DB.prepare('INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?)').bind(id, tag.trim().slice(0, 50)).run()
    );
    await Promise.all(tagInserts);
  }

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  const tags = await c.env.DB.prepare('SELECT tag FROM ticket_tags WHERE ticket_id = ?').bind(id).all<{ tag: string }>();
  const assigneesResult = await c.env.DB.prepare(
    'SELECT ta.user_id, u.name FROM ticket_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.ticket_id = ?'
  ).bind(id).all<{ user_id: string; name: string }>();
  return c.json({ data: { ...updated, tags: tags.results.map(t => t.tag), assignee_ids: assigneesResult.results.map(a => a.user_id), assignee_names: assigneesResult.results.map(a => a.name) }, error: null });
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
    const statusLabel = status === 'in_review' ? 'in review' : status;
    c.executionCtx.waitUntil(sendPushToUser(c.env.DB, ticket.submitter_id, {
      type: 'status', ticketNumber: ticket.ticket_number, title: ticket.title,
      body: `PDO-${ticket.ticket_number} is now ${statusLabel}`,
    }, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY));
  }

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  return c.json({ data: updated, error: null });
});

// GET /api/v1/tickets/:id/comments
ticketRoutes.get('/:id/comments', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT c.*, u.name as author_name, u.avatar_url as author_avatar FROM comments c JOIN users u ON c.author_id = u.id WHERE c.ticket_id = ? ORDER BY c.created_at ASC'
  ).bind(id).all();

  // Track that user has seen this ticket's comments (for first-only push suppression)
  if (user) {
    const now = Math.floor(Date.now() / 1000);
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        'INSERT INTO ticket_last_seen (user_id, ticket_id, seen_at) VALUES (?, ?, ?) ON CONFLICT(user_id, ticket_id) DO UPDATE SET seen_at = ?'
      ).bind(user.id, id, now, now).run()
    );
  }

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

  const ticket = await c.env.DB.prepare('SELECT id, ticket_number, title, product_id FROM tickets WHERE id = ?').bind(ticketId).first<{ id: string; ticket_number: number; title: string; product_id: string | null }>();
  if (!ticket) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }, 404);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'INSERT INTO comments (id, ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, ticketId, user.id, body, now).run();

  // Notify all assignees + project default owner + @mentioned users (excluding the comment author)
  const toEmails = new Set<string>();
  const ticketAssignees = await c.env.DB.prepare(
    'SELECT ta.user_id, u.email FROM ticket_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.ticket_id = ?'
  ).bind(ticketId).all<{ user_id: string; email: string }>();
  for (const a of ticketAssignees.results) {
    if (a.user_id !== user.id) toEmails.add(a.email);
  }
  if (ticket.product_id) {
    const project = await c.env.DB.prepare('SELECT default_owner_id FROM products WHERE id = ?').bind(ticket.product_id).first<{ default_owner_id: string | null }>();
    if (project?.default_owner_id && project.default_owner_id !== user.id) {
      const owner = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(project.default_owner_id).first<{ email: string }>();
      if (owner) toEmails.add(owner.email);
    }
  }

  // Parse @mentions from comment body and add to recipients
  const mentionMatches = body.match(/@[\w][\w\s]*/g);
  if (mentionMatches) {
    const mentionNames = mentionMatches.map(m => m.slice(1).trim()).filter(Boolean);
    for (const name of mentionNames) {
      const mentioned = await c.env.DB.prepare(
        "SELECT id, email FROM users WHERE name = ? AND role != 'suspended'"
      ).bind(name).first<{ id: string; email: string }>();
      if (mentioned && mentioned.id !== user.id) {
        toEmails.add(mentioned.email);
      }
    }
  }

  if (toEmails.size > 0) {
    const email = newCommentEmail(ticket.ticket_number, ticket.title, user.name, body, c.env.FRONTEND_URL);
    c.executionCtx.waitUntil(sendEmail(c.env.EMAIL_API_KEY, { to: [...toEmails], ...email }));
  }

  // Push notifications with first-only logic: only push if user hasn't seen since last comment
  const pushRecipientUserIds = new Set<string>();
  for (const a of ticketAssignees.results) {
    if (a.user_id !== user.id) pushRecipientUserIds.add(a.user_id);
  }
  if (ticket.product_id) {
    const project = await c.env.DB.prepare('SELECT default_owner_id FROM products WHERE id = ?').bind(ticket.product_id).first<{ default_owner_id: string | null }>();
    if (project?.default_owner_id && project.default_owner_id !== user.id) pushRecipientUserIds.add(project.default_owner_id);
  }
  if (mentionMatches) {
    for (const name of mentionMatches.map(m => m.slice(1).trim()).filter(Boolean)) {
      const mentioned = await c.env.DB.prepare("SELECT id FROM users WHERE name = ? AND role != 'suspended'").bind(name).first<{ id: string }>();
      if (mentioned && mentioned.id !== user.id) pushRecipientUserIds.add(mentioned.id);
    }
  }

  // Get the previous comment timestamp (before this one) to check first-only
  const prevComment = await c.env.DB.prepare(
    'SELECT MAX(created_at) as last_at FROM comments WHERE ticket_id = ? AND id != ?'
  ).bind(ticketId, id).first<{ last_at: number | null }>();
  const lastCommentAt = prevComment?.last_at || 0;

  const pushTargets: string[] = [];
  for (const uid of pushRecipientUserIds) {
    const seen = await c.env.DB.prepare(
      'SELECT seen_at FROM ticket_last_seen WHERE user_id = ? AND ticket_id = ?'
    ).bind(uid, ticketId).first<{ seen_at: number }>();
    // Push if: never seen, or last seen before the previous comment (meaning they have unread)
    if (!seen || seen.seen_at < lastCommentAt) {
      // Already has unread — suppress (first-only)
    } else {
      // They've seen everything up to now — this is the first unread, push it
      pushTargets.push(uid);
    }
  }

  if (pushTargets.length > 0) {
    c.executionCtx.waitUntil(sendPushToUsers(c.env.DB, pushTargets, {
      type: 'comment', ticketNumber: ticket.ticket_number, title: ticket.title,
      body: `${user.name} commented on PDO-${ticket.ticket_number}`,
    }, c.env.VAPID_PUBLIC_KEY, c.env.VAPID_PRIVATE_KEY));
  }

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

  const safeName = filename.replace(/[/\\:\0]/g, '_').slice(0, 200);
  const key = `tickets/${ticketId}/${crypto.randomUUID()}-${safeName}`;

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

  // Enforce upload size limit (10MB)
  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > 10 * 1024 * 1024) {
    return c.json({ data: null, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Max file size is 10MB.' } }, 413);
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength > 10 * 1024 * 1024) {
    return c.json({ data: null, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Max file size is 10MB.' } }, 413);
  }
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
