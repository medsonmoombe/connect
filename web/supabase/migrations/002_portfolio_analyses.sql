-- ============================================================
-- Migration 002: Portfolio AI Analysis History
-- ============================================================

CREATE TABLE portfolio_analyses (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_hash            TEXT NOT NULL,
  file_name            TEXT NOT NULL,
  project_count        INTEGER NOT NULL DEFAULT 0,
  portfolio_score      INTEGER,
  performed_by         TEXT NOT NULL REFERENCES users(id),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  analysis_data        JSONB,
  projects_snapshot    JSONB NOT NULL DEFAULT '[]',
  error_message        TEXT,
  estimated_tokens     INTEGER,
  previous_analysis_id UUID REFERENCES portfolio_analyses(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

-- Fast lookup by hash for deduplication
CREATE INDEX idx_portfolio_analyses_hash       ON portfolio_analyses(file_hash);
CREATE INDEX idx_portfolio_analyses_user       ON portfolio_analyses(performed_by);
CREATE INDEX idx_portfolio_analyses_created_at ON portfolio_analyses(created_at DESC);

-- RLS
ALTER TABLE portfolio_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON portfolio_analyses FOR ALL USING (true);
