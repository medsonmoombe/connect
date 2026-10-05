-- 057: Match result tables for consultant and grant-provider counterparties.
-- Mirrors capital_match_results / technical_match_results so the matching
-- engine and the matches read API can surface these partner types too.

-- ── Consultant match results ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_match_results (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  consultant_id        UUID NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  compatibility_score  INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  score_breakdown      JSONB DEFAULT '{}',
  status               match_status DEFAULT 'active',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, consultant_id)
);

-- ── Grant provider match results ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grant_provider_match_results (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  grant_provider_id    UUID NOT NULL REFERENCES grant_providers(id) ON DELETE CASCADE,
  compatibility_score  INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  score_breakdown      JSONB DEFAULT '{}',
  status               match_status DEFAULT 'active',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, grant_provider_id)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consultant_match_project
  ON consultant_match_results (project_id, compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_grant_provider_match_project
  ON grant_provider_match_results (project_id, compatibility_score DESC);

-- ── RLS (service_role blanket policies — same pattern as other tables) ──────
ALTER TABLE consultant_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_provider_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_consultant_matches"
  ON consultant_match_results FOR ALL USING (true);
CREATE POLICY "service_role_all_grant_provider_matches"
  ON grant_provider_match_results FOR ALL USING (true);