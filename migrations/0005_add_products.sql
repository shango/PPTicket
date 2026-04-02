CREATE TABLE products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  created_at   INTEGER NOT NULL
);

ALTER TABLE tickets ADD COLUMN product_id TEXT REFERENCES products(id);

CREATE INDEX idx_tickets_product ON tickets(product_id);

-- Seed products
INSERT INTO products (id, name, abbreviation, color, created_at) VALUES ('prod-genie', 'Genie', 'GEN', '#8b5cf6', strftime('%s','now'));
INSERT INTO products (id, name, abbreviation, color, created_at) VALUES ('prod-genman', 'Genman', 'GM', '#f59e0b', strftime('%s','now'));
INSERT INTO products (id, name, abbreviation, color, created_at) VALUES ('prod-picker', 'Picker', 'PKR', '#06b6d4', strftime('%s','now'));
