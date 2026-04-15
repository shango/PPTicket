-- Sub-tasks for tickets
CREATE TABLE subtasks (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    INTEGER,
  completed   INTEGER NOT NULL DEFAULT 0,
  sort_order  REAL NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_subtasks_ticket ON subtasks(ticket_id);

-- Allow attachments to belong to a subtask (nullable = ticket-level attachment)
ALTER TABLE attachments ADD COLUMN subtask_id TEXT REFERENCES subtasks(id) ON DELETE CASCADE;
CREATE INDEX idx_attachments_subtask ON attachments(subtask_id);
