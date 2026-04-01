import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { ticketRoutes } from './routes/tickets';
import { commentRoutes } from './routes/comments';
import { attachmentRoutes } from './routes/attachments';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.FRONTEND_URL,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
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
api.route('/comments', commentRoutes);
api.route('/attachments', attachmentRoutes);

app.route('/api/v1', api);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
