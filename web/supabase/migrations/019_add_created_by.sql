-- 019: Add created_by column to projects table
-- Tracks the actual user who created the project (for notifications)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

COMMENT ON COLUMN projects.created_by IS 'The user who created this project (auth.users UUID)';
