import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const attachmentRoutes = new Hono<{ Bindings: Env }>();

// DELETE /api/v1/attachments/:id
attachmentRoutes.delete('/:id', requireRole('decision_maker', 'dev', 'admin'), async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const attachment = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first<{ uploader_id: string; url: string }>();
  if (!attachment) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Attachment not found.' } }, 404);
  }

  if (attachment.uploader_id !== user.id && user.role !== 'admin') {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'You can only delete your own attachments.' } }, 403);
  }

  // Delete from R2
  try {
    const key = new URL(attachment.url).pathname.slice(1);
    await c.env.ATTACHMENTS.delete(key);
  } catch (e) {
    console.error('R2 delete failed:', e);
  }

  await c.env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Attachment deleted' }, error: null });
});
