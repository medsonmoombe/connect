-- Migration 046: Add UNIQUE partial index on setup_invites(email) for active invites.
-- Prevents duplicate pending invites for the same email at the database level,
-- as a safety net behind the application-level check in the invite route.
--
-- Note: expires_at > NOW() is omitted because NOW() is STABLE, not IMMUTABLE,
-- and PostgreSQL requires IMMUTABLE functions in index predicates. Expiry is
-- enforced at query time by the application.

CREATE UNIQUE INDEX IF NOT EXISTS idx_setup_invites_active_email
  ON setup_invites(email)
  WHERE deleted_at IS NULL
    AND used_at IS NULL;
