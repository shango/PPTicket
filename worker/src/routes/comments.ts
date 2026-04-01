import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const commentRoutes = new Hono<{ Bindings: Env }>();

// Note: ticket-scoped comment routes are mounted under /api/v1/tickets/:ticketId/comments in index.ts
// But for simplicity, we handle both patterns here and mount at /api/v1

// GET /api/v1/tickets/:ticketId/comments — handled via ticketRoutes redirect
// We'll mount this directly in the ticket routes or handle via separate path

// For the comment-level operations (edit/delete by comment ID):

// PATCH /api/v1/comments/:id
commentRoutes.patch('/:id', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const { body } = await c.req.json<{ body: string }>();

  if (!body || body.trim().length === 0) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Comment body is required.' } }, 400);
  }

  const comment = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<{ author_id: string }>();
  if (!comment) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Comment not found.' } }, 404);
  }

  // Only author or admin can edit
  if (comment.author_id !== user.id && user.role !== 'admin') {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You can only edit your own comments.' } }, 403);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('UPDATE comments SET body = ?, updated_at = ? WHERE id = ?').bind(body, now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first();
  return c.json({ data: updated, error: null });
});

// DELETE /api/v1/comments/:id
commentRoutes.delete('/:id', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const comment = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<{ author_id: string }>();
  if (!comment) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Comment not found.' } }, 404);
  }

  if (comment.author_id !== user.id && user.role !== 'admin') {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You can only delete your own comments.' } }, 403);
  }

  await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Comment deleted' }, error: null });
});
