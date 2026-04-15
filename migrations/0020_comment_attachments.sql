-- Allow attachments to belong to a comment
ALTER TABLE attachments ADD COLUMN comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX idx_attachments_comment ON attachments(comment_id);
