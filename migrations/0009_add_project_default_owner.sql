ALTER TABLE products ADD COLUMN default_owner_id TEXT REFERENCES users(id);
