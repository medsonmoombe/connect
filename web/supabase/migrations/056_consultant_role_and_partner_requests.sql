-- 056: Add CONSULTANT/GRANT_PROVIDER roles, consultant & grant_provider profiles,
-- partner_requests table, and extra_data JSONB column on projects.

-- ── Expand enums ───────────────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CONSULTANT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GRANT_PROVIDER';
ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'CONSULTANT';
ALTER TYPE counterparty_type ADD VALUE IF NOT EXISTS 'CONSULTANT';
ALTER TYPE counterparty_type ADD VALUE IF NOT EXISTS 'GRANT_PROVIDER';

-- ── Consultant profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultants (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_categories          TEXT[],
  sector_experience           TEXT[],
  specializations             TEXT[],
  years_of_experience         INTEGER,
  total_projects_completed    INTEGER,
  largest_project_mw          DECIMAL(10,2),
  regions_operated            TEXT[],
  certifications              TEXT[],
  key_team_members            JSONB DEFAULT '[]',
  references_data             JSONB DEFAULT '[]',
  availability                TEXT CHECK (availability IN ('AVAILABLE','BUSY','UNAVAILABLE')),
  hourly_rate_range           TEXT,
  project_rate_range          TEXT,
  company_experience_doc_url  TEXT,
  portfolio_doc_url           TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- ── Grant provider profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grant_providers (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grant_types                 TEXT[],
  min_grant_size              BIGINT,
  max_grant_size              BIGINT,
  focus_sectors               TEXT[],
  geographic_focus            TEXT[],
  eligibility_criteria        TEXT,
  application_process         TEXT,
  typical_timeline_months     INTEGER,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- ── Partner requests (quote / meeting / introduction) ──────────────────────
CREATE TABLE IF NOT EXISTS partner_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  partner_company_id  UUID NOT NULL REFERENCES companies(id),
  request_type        TEXT NOT NULL CHECK (request_type IN ('quote','meeting','introduction')),
  gaps_to_fill        TEXT[],
  requested_service   TEXT,
  message             TEXT,
  status              TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','viewed','accepted','declined','expired')),
  project_summary     JSONB DEFAULT '{}',
  engagement_id       UUID REFERENCES engagements(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ
);

-- ── Extra data on projects ─────────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}';

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consultants_company ON consultants(company_id);
CREATE INDEX IF NOT EXISTS idx_grant_providers_company ON grant_providers(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_project ON partner_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_partner ON partner_requests(partner_company_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON partner_requests(status);

-- ── RLS (service_role blanket policies — same pattern as other tables) ─────
ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_consultants" ON consultants FOR ALL USING (true);
CREATE POLICY "service_role_all_grant_providers" ON grant_providers FOR ALL USING (true);
CREATE POLICY "service_role_all_partner_requests" ON partner_requests FOR ALL USING (true);

-- ── Updated-at triggers ────────────────────────────────────────────────────
CREATE TRIGGER update_consultants_updated_at
  BEFORE UPDATE ON consultants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grant_providers_updated_at
  BEFORE UPDATE ON grant_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_requests_updated_at
  BEFORE UPDATE ON partner_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
