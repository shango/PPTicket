import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const attachmentRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/attachments — list all attachments, optionally filtered by project
attachmentRoutes.get('/', async (c) => {
  const productId = c.req.query('product');

  let query = `SELECT a.*, u.name as uploader_name, t.ticket_number, t.title as ticket_title,
    p.name as product_name, p.abbreviation as product_abbreviation, p.color as product_color
    FROM attachments a
    JOIN users u ON a.uploader_id = u.id
    JOIN tickets t ON a.ticket_id = t.id
    LEFT JOIN products p ON t.product_id = p.id`;

  const params: string[] = [];
  if (productId) {
    query += ' WHERE t.product_id = ?';
    params.push(productId);
  }

  query += ' ORDER BY a.created_at DESC';

  const stmt = c.env.DB.prepare(query);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return c.json({ data: result.results, error: null });
});

// GET /api/v1/attachments/:id/download — serve file from R2
attachmentRoutes.get('/:id/download', async (c) => {
  const { id } = c.req.param();
  const attachment = await c.env.DB.prepare(
    'SELECT url, filename, mime_type FROM attachments WHERE id = ?'
  ).bind(id).first<{ url: string; filename: string; mime_type: string | null }>();
  if (!attachment) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Attachment not found.' } }, 404);
  }

  const object = await c.env.ATTACHMENTS.get(attachment.url);
  if (!object) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'File not found in storage.' } }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', attachment.mime_type || 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${attachment.filename.replace(/"/g, '\\"')}"`);
  if (object.size) headers.set('Content-Length', String(object.size));

  return new Response(object.body, { headers });
});

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

  // Delete from R2 — url stores the R2 key directly
  try {
    await c.env.ATTACHMENTS.delete(attachment.url);
  } catch (e) {
    console.error('R2 delete failed:', e);
  }

  await c.env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(id).run();
  return c.json({ data: { message: 'Attachment deleted' }, error: null });
});
