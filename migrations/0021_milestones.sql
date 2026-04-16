-- Create milestones table
CREATE TABLE milestones (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  target_date INTEGER,
  status      TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  sort_order  REAL NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_milestones_status ON milestones(status);

-- Add milestone_id to tickets
ALTER TABLE tickets ADD COLUMN milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL;
CREATE INDEX idx_tickets_milestone ON tickets(milestone_id);
