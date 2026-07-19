-- Migration 022: New project flow — simplified status states + score reveal delay

-- Add scores_visible_at column (null = not yet live or scores not yet visible)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scores_visible_at timestamptz NULL;

-- Migrate existing rows to new states FIRST (before constraint change)
UPDATE projects SET
  status = 'live',
  scores_visible_at = COALESCE(updated_at, created_at)
  WHERE status = 'validated';

-- Catch ALL remaining non-valid statuses (NULL, typos, old values, etc.)
UPDATE projects SET status = 'draft'
  WHERE status IS NULL OR status NOT IN ('draft', 'live', 'scoring', 'deactivated', 'archived');

-- Now safe to swap the check constraint (all rows are on valid new states)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('draft', 'scoring', 'live', 'deactivated', 'archived'));

-- Remove old submission-mode columns from companies (no longer needed)
ALTER TABLE companies DROP COLUMN IF EXISTS project_submission_mode;
ALTER TABLE companies DROP COLUMN IF EXISTS internal_reviewer_id;

-- Update project_status_history constraint if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_status_history') THEN
    ALTER TABLE project_status_history DROP CONSTRAINT IF EXISTS project_status_history_from_status_check;
    ALTER TABLE project_status_history DROP CONSTRAINT IF EXISTS project_status_history_to_status_check;
  END IF;
END $$;
