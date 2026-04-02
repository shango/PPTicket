import { Hono } from 'hono';
import { Env } from '../types';

export const pushRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/push/vapid-key
pushRoutes.get('/vapid-key', (c) => {
  return c.json({ data: { key: c.env.VAPID_PUBLIC_KEY }, error: null });
});

// POST /api/v1/push/subscribe
pushRoutes.post('/subscribe', async (c) => {
  const user = c.get('user');
  const { endpoint, keys } = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid subscription data.' } }, 400);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Upsert: delete existing subscription for this user+endpoint, then insert
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .bind(user.id, endpoint).run();
  await c.env.DB.prepare(
    'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, user.id, endpoint, keys.p256dh, keys.auth, now).run();

  return c.json({ data: { id }, error: null }, 201);
});

// DELETE /api/v1/push/unsubscribe
pushRoutes.delete('/unsubscribe', async (c) => {
  const user = c.get('user');
  const { endpoint } = await c.req.json<{ endpoint: string }>();

  if (!endpoint) {
    return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Endpoint is required.' } }, 400);
  }

  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .bind(user.id, endpoint).run();

  return c.json({ data: { message: 'Unsubscribed' }, error: null });
});
