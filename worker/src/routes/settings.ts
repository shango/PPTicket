import { Hono } from 'hono';
import { Env } from '../types';
import { requireRole } from '../middleware/auth';

export const settingsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/v1/settings
settingsRoutes.get('/', requireRole('admin'), async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM app_settings').all<{ key: string; value: string }>();
  const settings: Record<string, string> = {};
  for (const row of rows.results) {
    settings[row.key] = row.value;
  }
  return c.json({ data: settings, error: null });
});

// PATCH /api/v1/settings
settingsRoutes.patch('/', requireRole('admin'), async (c) => {
  const body = await c.req.json<Record<string, string>>();

  if (body.archive_after_days !== undefined) {
    const days = parseInt(body.archive_after_days, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      return c.json({ data: null, error: { code: 'INVALID_INPUT', message: 'Archive days must be between 1 and 365.' } }, 400);
    }
    await c.env.DB.prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    ).bind('archive_after_days', String(days), String(days)).run();
  }

  const rows = await c.env.DB.prepare('SELECT key, value FROM app_settings').all<{ key: string; value: string }>();
  const settings: Record<string, string> = {};
  for (const row of rows.results) {
    settings[row.key] = row.value;
  }
  return c.json({ data: settings, error: null });
});
