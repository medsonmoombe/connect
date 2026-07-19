-- Migration 027: Add pending_live as a first-class project status
-- The new flow: scoring → pending_live (waiting for activation delay) → live (cron)

-- Migrate any projects currently in 'scoring' that already have scores to 'pending_live'
UPDATE projects SET status = 'pending_live'
  WHERE status = 'scoring'
  AND EXISTS (SELECT 1 FROM project_scores WHERE project_id = projects.id);

-- Update the check constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('draft', 'scoring', 'pending_live', 'live', 'deactivated', 'archived'));
