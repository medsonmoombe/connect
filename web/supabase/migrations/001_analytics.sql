-- ============================================================
-- Migration 001: Project Analytics
-- Write-time aggregation via triggers — reads are always O(1)
-- ============================================================

-- ── 1. Pre-aggregated counters (one row per project) ─────────

CREATE TABLE IF NOT EXISTS project_analytics (
  project_id        UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  total_views       INTEGER NOT NULL DEFAULT 0,
  unique_viewers    INTEGER NOT NULL DEFAULT 0,
  dataroom_accesses INTEGER NOT NULL DEFAULT 0,
  capital_matches   INTEGER NOT NULL DEFAULT 0,
  technical_matches INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Daily view time-series (7-day sparkline) ──────────────

CREATE TABLE IF NOT EXISTS project_views_daily (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  view_date  DATE NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, view_date)
);

-- ── 3. Indexes ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_analytics_project
  ON project_analytics(project_id);

CREATE INDEX IF NOT EXISTS idx_views_daily_project_date
  ON project_views_daily(project_id, view_date DESC);

-- Composite index for fast funnel queries
CREATE INDEX IF NOT EXISTS idx_engagements_project_status
  ON engagements(project_id, status);

-- Composite index for dedup check (same user, same project, recent)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity_time
  ON audit_logs(user_id, entity_id, timestamp DESC);

-- ── 4. Trigger: audit_log INSERT → increment counters ────────
-- Deduplicates views: same user_id + entity_id within 1 hour
-- counts as a single unique view (prevents refresh spam).

CREATE OR REPLACE FUNCTION fn_increment_project_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_is_dupe BOOLEAN := FALSE;
BEGIN
  IF NEW.entity_type <> 'PROJECT' THEN
    RETURN NEW;
  END IF;

  IF NEW.action_type = 'PROJECT_VIEW' THEN
    -- Dedup: same user viewed same project within last hour?
    IF NEW.user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM audit_logs
        WHERE user_id     = NEW.user_id
          AND entity_id   = NEW.entity_id
          AND action_type = 'PROJECT_VIEW'
          AND timestamp   > NOW() - INTERVAL '1 hour'
          AND id          <> NEW.id
      ) INTO v_is_dupe;
    END IF;

    INSERT INTO project_analytics (project_id, total_views, unique_viewers)
      VALUES (NEW.entity_id, 1, CASE WHEN v_is_dupe THEN 0 ELSE 1 END)
      ON CONFLICT (project_id) DO UPDATE SET
        total_views    = project_analytics.total_views + 1,
        unique_viewers = project_analytics.unique_viewers
                         + CASE WHEN v_is_dupe THEN 0 ELSE 1 END,
        updated_at     = NOW();

    -- Daily time-series
    INSERT INTO project_views_daily (project_id, view_date, view_count)
      VALUES (NEW.entity_id, CURRENT_DATE, 1)
      ON CONFLICT (project_id, view_date) DO UPDATE SET
        view_count = project_views_daily.view_count + 1;

  ELSIF NEW.action_type = 'DATAROOM_ACCESS' THEN
    INSERT INTO project_analytics (project_id, dataroom_accesses)
      VALUES (NEW.entity_id, 1)
      ON CONFLICT (project_id) DO UPDATE SET
        dataroom_accesses = project_analytics.dataroom_accesses + 1,
        updated_at        = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_analytics ON audit_logs;
CREATE TRIGGER trg_audit_log_analytics
  AFTER INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_project_analytics();

-- ── 5. Triggers: match inserts → increment match counters ────

CREATE OR REPLACE FUNCTION fn_increment_capital_match_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_analytics (project_id, capital_matches)
    VALUES (NEW.project_id, 1)
    ON CONFLICT (project_id) DO UPDATE SET
      capital_matches = project_analytics.capital_matches + 1,
      updated_at      = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_capital_match_analytics ON capital_match_results;
CREATE TRIGGER trg_capital_match_analytics
  AFTER INSERT ON capital_match_results
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_capital_match_count();

CREATE OR REPLACE FUNCTION fn_increment_technical_match_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_analytics (project_id, technical_matches)
    VALUES (NEW.project_id, 1)
    ON CONFLICT (project_id) DO UPDATE SET
      technical_matches = project_analytics.technical_matches + 1,
      updated_at        = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_technical_match_analytics ON technical_match_results;
CREATE TRIGGER trg_technical_match_analytics
  AFTER INSERT ON technical_match_results
  FOR EACH ROW
  EXECUTE FUNCTION fn_increment_technical_match_count();

-- ── 6. RLS (same permissive pattern as rest of schema) ───────

ALTER TABLE project_analytics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_views_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON project_analytics   FOR ALL USING (true);
CREATE POLICY "service_role_all" ON project_views_daily FOR ALL USING (true);

-- ── 7. Backfill existing data ────────────────────────────────
-- Safe to run multiple times (ON CONFLICT DO UPDATE).

INSERT INTO project_analytics (
  project_id, total_views, dataroom_accesses, capital_matches, technical_matches
)
SELECT
  p.id,
  COALESCE(v.total_views,       0),
  COALESCE(v.dataroom_accesses, 0),
  COALESCE(cm.cnt,              0),
  COALESCE(tm.cnt,              0)
FROM projects p
LEFT JOIN (
  SELECT
    entity_id AS project_id,
    COUNT(*) FILTER (WHERE action_type = 'PROJECT_VIEW')    AS total_views,
    COUNT(*) FILTER (WHERE action_type = 'DATAROOM_ACCESS') AS dataroom_accesses
  FROM audit_logs
  WHERE entity_type = 'PROJECT'
  GROUP BY entity_id
) v  ON v.project_id  = p.id
LEFT JOIN (
  SELECT project_id, COUNT(*) AS cnt FROM capital_match_results  GROUP BY project_id
) cm ON cm.project_id = p.id
LEFT JOIN (
  SELECT project_id, COUNT(*) AS cnt FROM technical_match_results GROUP BY project_id
) tm ON tm.project_id = p.id
ON CONFLICT (project_id) DO UPDATE SET
  total_views       = EXCLUDED.total_views,
  dataroom_accesses = EXCLUDED.dataroom_accesses,
  capital_matches   = EXCLUDED.capital_matches,
  technical_matches = EXCLUDED.technical_matches,
  updated_at        = NOW();

-- Backfill daily views from existing audit_logs
INSERT INTO project_views_daily (project_id, view_date, view_count)
SELECT
  entity_id::UUID,
  timestamp::DATE,
  COUNT(*)
FROM audit_logs
WHERE entity_type = 'PROJECT'
  AND action_type = 'PROJECT_VIEW'
GROUP BY entity_id, timestamp::DATE
ON CONFLICT (project_id, view_date) DO UPDATE SET
  view_count = EXCLUDED.view_count;
