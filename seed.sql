-- Sample tickets — run AFTER /setup (requires a user) and AFTER 0005 migration (requires products)
-- Usage: cd worker && npx wrangler d1 execute pdo-kanban-db --local --file=../seed.sql

-- Clear old seed data if re-running
DELETE FROM ticket_tags WHERE ticket_id LIKE 'seed-%';
DELETE FROM tickets WHERE id LIKE 'seed-%';

-- Genie bugs
INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-gen-bug-1', 1, 'Login page crashes on Safari', 'When users try to log in using Safari 17.x, the page throws a white screen error after submitting credentials. Console shows a TypeError in the auth module.', 'backlog', 'p0', 'bug', 'prod-genie', '2.3.0', id, NULL, 1, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-gen-bug-2', 2, 'Session expires without warning', 'Users are abruptly logged out after 8 hours with no warning. Need a toast notification 5 minutes before session expiry.', 'in_progress', 'p1', 'bug', 'prod-genie', '2.3.0', id, NULL, 1, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

-- Genie features
INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-gen-feat-1', 3, 'Add CSV export for Genie reports', 'Decision makers need the ability to export Genie analytics data as CSV files for quarterly reporting to stakeholders.', 'todo', 'p2', 'feature', 'prod-genie', NULL, id, NULL, 1, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

-- Genman bugs
INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-gm-bug-1', 4, 'Genman email notifications sent twice', 'When a generation job completes in Genman, the submitter receives two identical email notifications instead of one.', 'todo', 'p1', 'bug', 'prod-genman', '1.8.0', id, NULL, 2, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-gm-bug-2', 5, 'Genman batch processing timeout on large datasets', 'Batch jobs with more than 10k records time out after 30 minutes. Need to implement chunked processing or increase the timeout.', 'in_review', 'p0', 'bug', 'prod-genman', '1.8.1', id, NULL, 1, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

-- Genman features
INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-gm-feat-1', 6, 'Add dark mode to Genman dashboard', 'Users have requested the ability to switch between dark and light themes on the Genman management dashboard.', 'backlog', 'p3', 'feature', 'prod-genman', NULL, id, NULL, 2, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

-- Picker bugs
INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-pkr-bug-1', 7, 'Picker drag and drop fails on Firefox', 'Items cannot be dragged in the Picker selection UI on Firefox 124. Works fine on Chrome and Edge. Likely a pointer event compatibility issue.', 'in_progress', 'p1', 'bug', 'prod-picker', '3.1.0', id, NULL, 2, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-pkr-bug-2', 8, 'Picker mobile layout broken on iPad', 'The Picker grid view overlaps the sidebar on iPad Pro in landscape mode. CSS grid columns need a media query fix.', 'done', 'p2', 'bug', 'prod-picker', '3.0.2', id, NULL, 1, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

-- Picker features
INSERT INTO tickets (id, ticket_number, title, description, status, priority, ticket_type, product_id, product_version, submitter_id, due_date, sort_order, created_at, updated_at)
SELECT 'seed-pkr-feat-1', 9, 'Bulk selection mode for Picker', 'Users need the ability to select multiple items at once in Picker and perform bulk actions like export, delete, or categorize.', 'backlog', 'p2', 'feature', 'prod-picker', NULL, id, NULL, 3, strftime('%s','now'), strftime('%s','now') FROM users LIMIT 1;

-- Tags
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gen-bug-1', 'browser');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gen-bug-1', 'critical');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gen-bug-2', 'auth');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gen-feat-1', 'reporting');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gm-bug-1', 'notifications');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gm-bug-2', 'performance');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-gm-feat-1', 'ui');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-pkr-bug-1', 'browser');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-pkr-bug-1', 'dnd');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-pkr-bug-2', 'mobile');
INSERT INTO ticket_tags (ticket_id, tag) VALUES ('seed-pkr-feat-1', 'ux');
