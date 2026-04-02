-- Multi-assignee support: replace single assignee_id with junction table

CREATE TABLE IF NOT EXISTS ticket_assignees (
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_user ON ticket_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignees_ticket ON ticket_assignees(ticket_id);

-- Migrate existing assignee data (only if column still exists and table is empty)
INSERT OR IGNORE INTO ticket_assignees (ticket_id, user_id, created_at)
SELECT id, assignee_id, updated_at FROM tickets WHERE assignee_id IS NOT NULL;

-- Drop the old index and column
DROP INDEX IF EXISTS idx_tickets_assignee;
ALTER TABLE tickets DROP COLUMN assignee_id;
