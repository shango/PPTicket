-- Initial schema for PDO Kanban
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer',
  created_at  INTEGER NOT NULL,
  last_login  INTEGER
);

CREATE TABLE tickets (
  id           TEXT PRIMARY KEY,
  ticket_number INTEGER UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog',
  priority     TEXT NOT NULL DEFAULT 'p2',
  assignee_id  TEXT REFERENCES users(id),
  submitter_id TEXT NOT NULL REFERENCES users(id),
  due_date     INTEGER,
  sort_order   REAL NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE ticket_tags (
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (ticket_id, tag)
);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE attachments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  filename    TEXT NOT NULL,
  url         TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT REFERENCES users(id),
  action     TEXT NOT NULL,
  target_id  TEXT,
  payload    TEXT,
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_submitter ON tickets(submitter_id);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_sort ON tickets(status, sort_order);
CREATE INDEX idx_comments_ticket ON comments(ticket_id);
CREATE INDEX idx_attachments_ticket ON attachments(ticket_id);
CREATE INDEX idx_audit_target ON audit_log(target_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
