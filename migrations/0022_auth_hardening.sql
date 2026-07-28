-- Session revocation support.
--
-- token_version is embedded in every issued JWT as the `tv` claim and re-checked
-- on each request. Bumping it invalidates every outstanding session for that user,
-- which is what makes logout-everywhere, password change, role change, and
-- suspension actually take effect instead of waiting for the token to expire.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Recorded on password change so we can show/audit when credentials last rotated.
ALTER TABLE users ADD COLUMN password_changed_at INTEGER;
