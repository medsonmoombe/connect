-- Migration 032: Fix project status CHECK constraint
-- The database has a stale CHECK constraint (possibly with a non-standard name)
-- that still enforces old statuses. This migration finds and drops ALL check
-- constraints on the projects.status column, migrates rows, then adds the correct one.

-- Migrate old statuses to new ones (safe even if rows are already correct)
UPDATE projects SET status = 'live' WHERE status = 'validated';
UPDATE projects SET status = 'live' WHERE status = 'submitted';
UPDATE projects SET status = 'live' WHERE status = 'under_review';

-- Catch any remaining invalid statuses
UPDATE projects SET status = 'draft'
  WHERE status IS NULL OR status NOT IN ('draft', 'live', 'scoring', 'pending_live', 'deactivated', 'archived');

-- Drop ALL check constraints on projects that reference the status column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'projects'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE projects DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Now add the correct constraint
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('draft', 'scoring', 'pending_live', 'live', 'deactivated', 'archived'));
