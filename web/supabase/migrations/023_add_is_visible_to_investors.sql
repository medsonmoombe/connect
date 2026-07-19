-- Migration 023: Add is_visible_to_investors flag
-- Controlled by the hourly cron job once scores_visible_at has passed.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_visible_to_investors boolean NOT NULL DEFAULT false;

-- Backfill: any live project whose scores_visible_at has already passed is visible
UPDATE projects
  SET is_visible_to_investors = true
  WHERE status = 'live'
    AND scores_visible_at IS NOT NULL
    AND scores_visible_at <= now();

-- Live projects with no scores_visible_at set (edge case / legacy) are also visible
UPDATE projects
  SET is_visible_to_investors = true
  WHERE status = 'live'
    AND scores_visible_at IS NULL;

-- Index for the cron query (projects due to become visible)
CREATE INDEX IF NOT EXISTS idx_projects_visibility_cron
  ON projects (status, is_visible_to_investors, scores_visible_at)
  WHERE status = 'live' AND is_visible_to_investors = false;
