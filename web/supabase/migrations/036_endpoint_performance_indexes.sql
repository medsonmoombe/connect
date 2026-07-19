-- Migration 036: Endpoint performance indexes
-- Supports dashboard, marketplace, match, bookmark, and engagement hot paths.

CREATE INDEX IF NOT EXISTS idx_projects_live_marketplace
  ON projects (status, is_visible_to_investors, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_developer_created
  ON projects (developer_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_capital_match_partner_score
  ON capital_match_results (capital_partner_id, compatibility_score DESC);

CREATE INDEX IF NOT EXISTS idx_technical_match_project_score
  ON technical_match_results (project_id, compatibility_score DESC);

CREATE INDEX IF NOT EXISTS idx_capital_match_project_score
  ON capital_match_results (project_id, compatibility_score DESC);

WITH ranked_bookmarks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, project_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM project_bookmarks
)
DELETE FROM project_bookmarks pb
USING ranked_bookmarks rb
WHERE pb.id = rb.id
  AND rb.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_bookmarks_user_project_unique
  ON project_bookmarks (user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_bookmarks_user_created
  ON project_bookmarks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagements_project_created
  ON engagements (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagements_counterparty_created
  ON engagements (counterparty_id, created_at DESC);
