-- Migration 039: Match result versioning (PRD §5.2)
--
-- PRD §5.2 requires match scores to be versioned: when scores are recomputed,
-- the previous scores must be preserved in a history table and stale matches
-- marked `inactive` (NOT deleted). Today `capital_match_results`/`
-- `technical_match_results` simply upsert by (project, partner), overwriting the
-- prior score with no audit trail.
--
-- This migration:
--   1. Adds a `status` (`active`/`inactive`) column to capital_match_results
--      mirroring the existing column on technical_match_results.
--   2. Adds a `calculated_at` timestamp to both tables (updated each recompute).
--   3. Creates `match_results_history` capturing every recomputed score.
--
-- The matching engine (api/matching/run) is responsible for, on each run:
--   - copying the PREVIOUS active row for a (project, partner) pair into
--     match_results_history before upserting the new score, and
--   - marking any (project, partner) pair NOT present in the latest run as
--     `inactive` (the pair is no longer a match — e.g. partner changed sector
--     focus). Rows for pairs still present are set back to `active`.
--
-- All statements are idempotent and safe to re-run via `node migrate.mjs`.

-- ── 1. capital_match_results.status + calculated_at ───────────────────────────
ALTER TABLE capital_match_results
  ADD COLUMN IF NOT EXISTS status        match_status NOT NULL DEFAULT 'active';

ALTER TABLE capital_match_results
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_capital_match_status
  ON capital_match_results (status)
  WHERE status = 'active';

-- ── 2. technical_match_results.calculated_at (status already present) ─────────
ALTER TABLE technical_match_results
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_technical_match_status
  ON technical_match_results (status)
  WHERE status = 'active';

-- ── 3. match_results_history — append-only audit of every score ───────────────
-- One row per recomputed (project, partner, type) score. `partner_type` tells
-- us which partner id column holds the counterparty (capital_partner_id vs
-- technical_partner_id) so a single history table can serve both engines.
CREATE TABLE IF NOT EXISTS match_results_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  partner_type      TEXT NOT NULL CHECK (partner_type IN ('CAPITAL','TECHNICAL')),
  partner_id        UUID NOT NULL,
  compatibility_score INTEGER NOT NULL CHECK (compatibility_score BETWEEN 0 AND 100),
  score_breakdown   JSONB DEFAULT '{}',
  -- The run that produced this row. Allow NULL for backfilled history.
  run_reason        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_history_project
  ON match_results_history (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_partner
  ON match_results_history (partner_type, partner_id, created_at DESC);

-- RLS: service_role only (history is read via the API/admin, never by clients
-- directly). auth.uid()-based access is intentionally not granted here.
ALTER TABLE match_results_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_match_history" ON match_results_history;
CREATE POLICY "service_role_all_match_history" ON match_results_history
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill: seed history with a snapshot of the current active scores so the
-- audit trail begins with the present state (best-effort, single run).
INSERT INTO match_results_history (project_id, partner_type, partner_id, compatibility_score, score_breakdown, run_reason)
  SELECT project_id, 'CAPITAL', capital_partner_id, compatibility_score, score_breakdown, 'backfill'
  FROM capital_match_results
  ON CONFLICT DO NOTHING;

INSERT INTO match_results_history (project_id, partner_type, partner_id, compatibility_score, score_breakdown, run_reason)
  SELECT project_id, 'TECHNICAL', technical_partner_id, compatibility_score, score_breakdown, 'backfill'
  FROM technical_match_results
  ON CONFLICT DO NOTHING;
