-- Add archived_at column to tickets
ALTER TABLE tickets ADD COLUMN archived_at INTEGER DEFAULT NULL;
