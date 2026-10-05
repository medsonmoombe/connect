-- PRD §14.1: AI Scoring Failure Recovery
-- 1. Add `analysis_failure_count` to track consecutive failures
-- 2. Add `scoring_retry` to the project status CHECK constraint

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS analysis_failure_count INTEGER NOT NULL DEFAULT 0;

-- Update the status CHECK constraint to include scoring_retry
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'draft',
    'scoring',
    'scoring_retry',
    'pending_live',
    'live',
    'deactivated',
    'archived'
  ));
