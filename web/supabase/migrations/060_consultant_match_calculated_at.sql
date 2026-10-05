-- 060: Add calculated_at to consultant/grant match result tables.
-- Matching/run writes calculated_at for all match tables so recomputes can be
-- tracked consistently and stale rows can be marked inactive safely.

ALTER TABLE consultant_match_results
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE grant_provider_match_results
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_consultant_match_status
  ON consultant_match_results (status);

CREATE INDEX IF NOT EXISTS idx_grant_provider_match_status
  ON grant_provider_match_results (status);
