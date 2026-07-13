-- ============================================================
-- Afri Connect — Full Database Schema
-- Run this once on a fresh Supabase project.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('DEVELOPER','CAPITAL_PARTNER','TECHNICAL_PARTNER','ADMIN','POWER_TRADER');
CREATE TYPE company_type AS ENUM ('DEVELOPER','CAPITAL','TECHNICAL','POWER_TRADER');
CREATE TYPE project_stage AS ENUM ('CONCEPT','FEASIBILITY','PRE_CONSTRUCTION','READY_TO_BUILD','UNDER_CONSTRUCTION','OPERATIONAL');
CREATE TYPE capital_structure_type AS ENUM ('EQUITY','PROFIT_SHARING','LEASING','GRANT');
CREATE TYPE risk_tolerance AS ENUM ('LOW','MEDIUM','HIGH');
CREATE TYPE governance_preference AS ENUM ('PASSIVE','BOARD_SEAT','ACTIVE_ROLE');
CREATE TYPE engagement_status AS ENUM ('INTRO_SENT','INTRO_ACCEPTED','NDA_SIGNED','DUE_DILIGENCE','TERM_SHEET','CONTRACT_SIGNED','CAPITAL_COMMITTED','CLOSED','DROPPED');
CREATE TYPE counterparty_type AS ENUM ('CAPITAL','TECHNICAL');
CREATE TYPE match_status AS ENUM ('active','inactive');

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE companies (
  id                                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                                TEXT NOT NULL,
  type                                company_type NOT NULL,
  country                             TEXT NOT NULL,
  years_operating                     INTEGER DEFAULT 0,
  team_size                           INTEGER DEFAULT 0,
  website                             TEXT,
  description                         TEXT,
  logo_url                            TEXT,
  is_new_company_with_experienced_team BOOLEAN DEFAULT FALSE,
  management_team_experience          JSONB DEFAULT '{}',
  created_at                          TIMESTAMPTZ DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: id is TEXT to store Firebase UIDs (not UUID)
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  role                user_role NOT NULL DEFAULT 'DEVELOPER',
  company_id          UUID REFERENCES companies(id) ON DELETE SET NULL,
  verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
  full_name           TEXT,
  avatar_url          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  technology_type             TEXT NOT NULL,
  location_country            TEXT NOT NULL,
  location_region             TEXT,
  project_size_mw             DECIMAL(10,2) NOT NULL,
  capital_required            BIGINT NOT NULL,
  capital_structure_type      capital_structure_type NOT NULL,
  governance_terms            TEXT,
  exit_terms                  TEXT,
  risk_disclosures            TEXT,
  project_stage               project_stage NOT NULL DEFAULT 'FEASIBILITY',
  status                      TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','validated','rejected')),
  target_financial_close_date DATE,
  target_cod                  DATE,
  has_secured_land            BOOLEAN DEFAULT FALSE,
  land_title_status           TEXT CHECK (land_title_status IN ('Traditional','Titled','Not Applicable')),
  has_reached_financial_close BOOLEAN DEFAULT FALSE,
  regulatory_approvals        TEXT[],
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_tech_requirements (
  project_id         UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  required_services  TEXT[],
  terrain_complexity TEXT CHECK (terrain_complexity IN ('SIMPLE','MODERATE','COMPLEX')),
  grid_status        TEXT CHECK (grid_status IN ('CONNECTED','PENDING','OFF_GRID')),
  budget_preference  TEXT CHECK (budget_preference IN ('FIXED','MILESTONE','NEGOTIABLE'))
);

CREATE TABLE capital_partners (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  preferred_structures      capital_structure_type[],
  min_ticket_size           BIGINT NOT NULL,
  max_ticket_size           BIGINT NOT NULL,
  risk_tolerance            risk_tolerance NOT NULL,
  governance_preference     governance_preference NOT NULL,
  geographic_focus          TEXT[],
  sector_focus              TEXT[],
  preferred_project_stage   project_stage[],
  expected_return_profile   TEXT,
  preferred_capital_structure capital_structure_type[]
);

CREATE TABLE technical_partners (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_categories          TEXT[],
  sector_experience           TEXT[],
  min_mw_capacity             DECIMAL(10,2) NOT NULL,
  max_mw_capacity             DECIMAL(10,2) NOT NULL,
  regions_operated            TEXT[],
  annual_delivery_capacity_mw DECIMAL(10,2),
  total_mw_delivered          DECIMAL(10,2),
  largest_project_mw          DECIMAL(10,2),
  average_delivery_time_months INTEGER,
  bonding_capacity            DECIMAL(10,2),
  delivery_models             TEXT[],
  payment_terms               TEXT,
  project_type_experience     TEXT[],
  min_ticket_size_zmw         BIGINT,
  max_ticket_size_zmw         BIGINT,
  years_of_experience         INTEGER,
  company_experience_doc_url  TEXT
);

CREATE TABLE power_traders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  license_type                TEXT NOT NULL,
  max_offtake_capacity_mw     DECIMAL(10,2),
  preferred_technology_types  TEXT[],
  regions_of_interest         TEXT[],
  min_ppa_duration_years      INTEGER,
  credit_rating_equivalent    TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_scores (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  capital_readiness_score     INTEGER CHECK (capital_readiness_score BETWEEN 0 AND 100),
  technical_readiness_score   INTEGER CHECK (technical_readiness_score BETWEEN 0 AND 100),
  regulatory_score            INTEGER DEFAULT 0,
  financial_score             INTEGER DEFAULT 0,
  developer_score             INTEGER DEFAULT 0,
  documentation_score         INTEGER CHECK (documentation_score BETWEEN 0 AND 100),
  governance_score            INTEGER CHECK (governance_score BETWEEN 0 AND 100),
  financial_transparency_score INTEGER CHECK (financial_transparency_score BETWEEN 0 AND 100),
  breakdown                   JSONB DEFAULT '{}',
  risk_flags                  TEXT[],
  recommendations             TEXT[],
  summary                     TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

CREATE TABLE capital_match_results (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  capital_partner_id  UUID NOT NULL REFERENCES capital_partners(id) ON DELETE CASCADE,
  compatibility_score INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  score_breakdown     JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, capital_partner_id)
);

CREATE TABLE technical_match_results (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  technical_partner_id UUID NOT NULL REFERENCES technical_partners(id) ON DELETE CASCADE,
  compatibility_score  INTEGER CHECK (compatibility_score BETWEEN 0 AND 100),
  score_breakdown      JSONB DEFAULT '{}',
  status               match_status DEFAULT 'active',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, technical_partner_id)
);

CREATE TABLE engagements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  counterparty_id  UUID NOT NULL,
  counterparty_type counterparty_type NOT NULL,
  status           engagement_status NOT NULL DEFAULT 'INTRO_SENT',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- sender_id is TEXT to match users.id (Firebase UID)
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  sender_id     TEXT NOT NULL REFERENCES users(id),
  message_body  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- user_id is TEXT to match users.id (Firebase UID)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     TEXT REFERENCES users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

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

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_portfolio_analyses_hash       ON portfolio_analyses(file_hash);
CREATE INDEX idx_portfolio_analyses_user       ON portfolio_analyses(performed_by);
CREATE INDEX idx_portfolio_analyses_created_at ON portfolio_analyses(created_at DESC);
CREATE INDEX idx_companies_type        ON companies(type);
CREATE INDEX idx_companies_country     ON companies(country);
CREATE INDEX idx_users_email           ON users(email);
CREATE INDEX idx_users_role            ON users(role);
CREATE INDEX idx_users_company         ON users(company_id);
CREATE INDEX idx_projects_developer    ON projects(developer_id);
CREATE INDEX idx_projects_stage        ON projects(project_stage);
CREATE INDEX idx_projects_country      ON projects(location_country);
CREATE INDEX idx_engagements_project   ON engagements(project_id);
CREATE INDEX idx_engagements_counterparty ON engagements(counterparty_id);
CREATE INDEX idx_messages_engagement   ON messages(engagement_id);
CREATE INDEX idx_audit_logs_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_capital_match_project ON capital_match_results(project_id);
CREATE INDEX idx_technical_match_project ON technical_match_results(project_id);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at  BEFORE UPDATE ON companies  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at   BEFORE UPDATE ON projects   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_engagements_updated_at BEFORE UPDATE ON engagements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────
-- All tables have RLS enabled but policies are permissive because
-- the app uses the service role key via API routes (server-side).
-- RLS acts as a safety net only.

ALTER TABLE portfolio_analyses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tech_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_partners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_partners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_traders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_match_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- These policies only apply to anon/authenticated direct DB access (not used by the app).
CREATE POLICY "service_role_all" ON portfolio_analyses         FOR ALL USING (true);
CREATE POLICY "service_role_all" ON companies              FOR ALL USING (true);
CREATE POLICY "service_role_all" ON users                  FOR ALL USING (true);
CREATE POLICY "service_role_all" ON projects               FOR ALL USING (true);
CREATE POLICY "service_role_all" ON project_documents      FOR ALL USING (true);
CREATE POLICY "service_role_all" ON project_tech_requirements FOR ALL USING (true);
CREATE POLICY "service_role_all" ON capital_partners       FOR ALL USING (true);
CREATE POLICY "service_role_all" ON technical_partners     FOR ALL USING (true);
CREATE POLICY "service_role_all" ON power_traders          FOR ALL USING (true);
CREATE POLICY "service_role_all" ON project_scores         FOR ALL USING (true);
CREATE POLICY "service_role_all" ON capital_match_results  FOR ALL USING (true);
CREATE POLICY "service_role_all" ON technical_match_results FOR ALL USING (true);
CREATE POLICY "service_role_all" ON engagements            FOR ALL USING (true);
CREATE POLICY "service_role_all" ON messages               FOR ALL USING (true);
CREATE POLICY "service_role_all" ON audit_logs             FOR ALL USING (true);
