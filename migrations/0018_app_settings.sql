-- App-level settings (key/value)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default: auto-archive after 7 days in terminal column
INSERT INTO app_settings (key, value) VALUES ('archive_after_days', '7');
