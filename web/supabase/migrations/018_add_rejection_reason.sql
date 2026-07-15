-- 018: Add rejection_reason column to projects table
-- Stores the reason when a project is rejected by platform admin or returned by internal reviewer

ALTER TABLE projects ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN projects.rejection_reason IS 'Reason provided when project was rejected or returned for rework';
