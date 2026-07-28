import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { ticketRoutes } from './routes/tickets';
import { commentRoutes } from './routes/comments';
import { attachmentRoutes } from './routes/attachments';
import { projectRoutes } from './routes/projects';
import { columnRoutes } from './routes/columns';
import { pushRoutes } from './routes/push';
import { settingsRoutes } from './routes/settings';
import { subtaskRoutes } from './routes/subtasks';
import { milestoneRoutes } from './routes/milestones';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// This Worker only ever serves JSON and R2 blobs - never HTML - so the browser
// should not be sniffing content types, framing responses, or leaking referrers.
// The attachment download route sets its own stricter CSP; skip it here so the
// two do not collide.
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  if (!c.res.headers.has('Content-Security-Policy')) {
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
});

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_URL,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Public auth routes
app.route('/auth', authRoutes);

// Protected API routes
const api = new Hono<{ Bindings: Env }>();
api.use('*', authMiddleware);
api.route('/users', userRoutes);
api.route('/tickets', ticketRoutes);
api.route('/tickets/:ticketId/subtasks', subtaskRoutes);
api.route('/comments', commentRoutes);
api.route('/attachments', attachmentRoutes);
api.route('/projects', projectRoutes);
api.route('/columns', columnRoutes);
api.route('/push', pushRoutes);
api.route('/settings', settingsRoutes);
api.route('/milestones', milestoneRoutes);

app.route('/api/v1', api);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    // Auto-archive tickets in terminal columns past the configured threshold
    const setting = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'archive_after_days'").first<{ value: string }>();
    const archiveDays = parseInt(setting?.value || '7', 10);
    const cutoff = Math.floor(Date.now() / 1000) - archiveDays * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE tickets SET archived_at = ?, updated_at = ?
       WHERE archived_at IS NULL
         AND status IN (SELECT slug FROM columns WHERE is_terminal = 1)
         AND updated_at < ?`
    ).bind(now, now, cutoff).run();
  },
};
