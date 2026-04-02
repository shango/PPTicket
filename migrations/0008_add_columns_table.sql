CREATE TABLE columns (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  sort_order  REAL NOT NULL,
  color       TEXT NOT NULL DEFAULT '#5f6270',
  is_initial  INTEGER NOT NULL DEFAULT 0,
  is_terminal INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- Seed existing hardcoded columns
INSERT INTO columns (id, name, slug, sort_order, color, is_initial, is_terminal, created_at) VALUES
  ('col-backlog',     'Backlog',     'backlog',     1, '#5f6270', 1, 0, strftime('%s','now')),
  ('col-todo',        'To Do',       'todo',        2, '#7c7fdf', 0, 0, strftime('%s','now')),
  ('col-in-progress', 'In Progress', 'in_progress', 3, '#d4944e', 0, 0, strftime('%s','now')),
  ('col-in-review',   'In Review',   'in_review',   4, '#7c9fdf', 0, 0, strftime('%s','now')),
  ('col-done',        'Done',        'done',        5, '#5bae7a', 0, 1, strftime('%s','now'));
