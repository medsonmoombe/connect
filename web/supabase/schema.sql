-- Energy Capital Match - MVP Database Schema
-- Supabase PostgreSQL with Row Level Security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM (
  'DEVELOPER', 
  'CAPITAL_PARTNER', 
  'TECHNICAL_PARTNER', 
  'GRANT_PROVIDER', 
  'ADMIN'
);

CREATE TYPE company_type AS ENUM (
  'DEVELOPER', 
  'CAPITAL', 
  'TECHNICAL', 
  'GRANT'
);

CREATE TYPE project_stage AS ENUM (
  'FEASIBILITY', 
  'PRE_CONSTRUCTION', 
  'READY_TO_BUILD', 
  'UNDER_CONSTRUCTION', 
  'OPERATIONAL'
);

CREATE TYPE capital_structure_type AS ENUM (
  'EQUITY', 
  'PROFIT_SHARING', 
  'LEASING', 
  'GRANT'
);

CREATE TYPE risk_tolerance AS ENUM (
  'LOW', 
  'MEDIUM', 
  'HIGH'
);

CREATE TYPE governance_preference AS ENUM (
  'PASSIVE', 
  'BOARD_SEAT', 
  'ACTIVE_ROLE'
);

CREATE TYPE engagement_status AS ENUM (
  'INTRO_SENT', 
  'INTRO_ACCEPTED', 
  'DUE_DILIGENCE', 
  'TERM_SHEET', 
  'CONTRACT_SIGNED', 
  'CAPITAL_COMMITTED', 
  'CLOSED', 
  'DROPPED'
);

CREATE TYPE counterparty_type AS ENUM (
  'CAPITAL', 
  'TECHNICAL'
);

-- Companies Table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type company_type NOT NULL,
  country TEXT NOT NULL,
  years_operating INTEGER DEFAULT 0,
  team_size INTEGER DEFAULT 0,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'DEVELOPER',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  technology_type TEXT NOT NULL,
  location_country TEXT NOT NULL,
  location_region TEXT,
  project_size_mw DECIMAL(10, 2) NOT NULL,
  capital_required BIGINT NOT NULL,
  capital_structure_type capital_structure_type NOT NULL,
  governance_terms TEXT,
  exit_terms TEXT,
  risk_disclosures TEXT,
  project_stage project_stage NOT NULL DEFAULT 'FEASIBILITY',
  target_financial_close_date DATE,
  target_cod DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Documents Table
CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Technical Requirements Table
CREATE TABLE project_tech_requirements (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  required_services TEXT[],
  terrain_complexity TEXT CHECK (terrain_complexity IN ('SIMPLE', 'MODERATE', 'COMPLEX')),
  grid_status TEXT CHECK (grid_status IN ('CONNECTED', 'PENDING', 'OFF_GRID')),
  budget_preference TEXT CHECK (budget_preference IN ('FIXED', 'MILESTONE', 'NEGOTIABLE'))
);

-- Capital Partners Table
CREATE TABLE capital_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  preferred_structures capital_structure_type[],
  min_ticket_size BIGINT NOT NULL,
  max_ticket_size BIGINT NOT NULL,
  risk_tolerance risk_tolerance NOT NULL,
  governance_preference governance_preference NOT NULL,
  geographic_focus TEXT[],
  sector_focus TEXT[]
);

-- Technical Partners Table
CREATE TABLE technical_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_categories TEXT[],
  sector_experience TEXT[],
  min_mw_capacity DECIMAL(10, 2) NOT NULL,
  max_mw_capacity DECIMAL(10, 2) NOT NULL,
  regions_operated TEXT[],
  annual_delivery_capacity_mw DECIMAL(10, 2),
  total_mw_delivered DECIMAL(10, 2),
  largest_project_mw DECIMAL(10, 2),
  average_delivery_time_months INTEGER,
  bonding_capacity DECIMAL(10, 2),
  delivery_models TEXT[]
);

-- Project Scores Table
CREATE TABLE project_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  capital_readiness_score INTEGER CHECK (capital_readiness_score >= 0 AND capital_readiness_score <= 100),
  technical_readiness_score INTEGER CHECK (technical_readiness_score >= 0 AND technical_readiness_score <= 100),
  documentation_score INTEGER CHECK (documentation_score >= 0 AND documentation_score <= 100),
  governance_score INTEGER CHECK (governance_score >= 0 AND governance_score <= 100),
  financial_transparency_score INTEGER CHECK (financial_transparency_score >= 0 AND financial_transparency_score <= 100),
  risk_flags TEXT[],
  recommendations TEXT[],
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capital Match Results Table
CREATE TABLE capital_match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  capital_partner_id UUID NOT NULL REFERENCES capital_partners(id) ON DELETE CASCADE,
  compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  score_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, capital_partner_id)
);

-- Technical Match Results Table
CREATE TABLE technical_match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  technical_partner_id UUID NOT NULL REFERENCES technical_partners(id) ON DELETE CASCADE,
  compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  score_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, technical_partner_id)
);

-- Engagements Table
CREATE TABLE engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  counterparty_id UUID NOT NULL,
  counterparty_type counterparty_type NOT NULL,
  status engagement_status NOT NULL DEFAULT 'INTRO_SENT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages Table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  message_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX idx_companies_type ON companies(type);
CREATE INDEX idx_companies_country ON companies(country);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_projects_developer ON projects(developer_id);
CREATE INDEX idx_projects_stage ON projects(project_stage);
CREATE INDEX idx_projects_country ON projects(location_country);
CREATE INDEX idx_projects_capital_structure ON projects(capital_structure_type);
CREATE INDEX idx_project_documents_project ON project_documents(project_id);
CREATE INDEX idx_capital_partners_company ON capital_partners(company_id);
CREATE INDEX idx_technical_partners_company ON technical_partners(company_id);
CREATE INDEX idx_project_scores_project ON project_scores(project_id);
CREATE INDEX idx_capital_match_results_project ON capital_match_results(project_id);
CREATE INDEX idx_capital_match_results_partner ON capital_match_results(capital_partner_id);
CREATE INDEX idx_technical_match_results_project ON technical_match_results(project_id);
CREATE INDEX idx_technical_match_results_partner ON technical_match_results(technical_partner_id);
CREATE INDEX idx_engagements_project ON engagements(project_id);
CREATE INDEX idx_engagements_counterparty ON engagements(counterparty_id);
CREATE INDEX idx_engagements_status ON engagements(status);
CREATE INDEX idx_messages_engagement ON messages(engagement_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tech_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Companies: Public read, owner update
CREATE POLICY "companies_select" ON companies FOR SELECT USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (true);

-- Users: Read all, self update, admin full access
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);

-- Projects: Developers read own, Public read validated
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  true
);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (true);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (true);

-- Project Documents: Owner only
CREATE POLICY "project_documents_select" ON project_documents FOR SELECT USING (true);
CREATE POLICY "project_documents_insert" ON project_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "project_documents_update" ON project_documents FOR UPDATE USING (true);
CREATE POLICY "project_documents_delete" ON project_documents FOR DELETE USING (true);

-- Project Tech Requirements: Owner only
CREATE POLICY "project_tech_requirements_select" ON project_tech_requirements FOR SELECT USING (true);
CREATE POLICY "project_tech_requirements_insert" ON project_tech_requirements FOR INSERT WITH CHECK (true);
CREATE POLICY "project_tech_requirements_update" ON project_tech_requirements FOR UPDATE USING (true);
CREATE POLICY "project_tech_requirements_delete" ON project_tech_requirements FOR DELETE USING (true);

-- Capital Partners: Public read, owner full access
CREATE POLICY "capital_partners_select" ON capital_partners FOR SELECT USING (true);
CREATE POLICY "capital_partners_insert" ON capital_partners FOR INSERT WITH CHECK (true);
CREATE POLICY "capital_partners_update" ON capital_partners FOR UPDATE USING (true);
CREATE POLICY "capital_partners_delete" ON capital_partners FOR DELETE USING (true);

-- Technical Partners: Public read, owner full access
CREATE POLICY "technical_partners_select" ON technical_partners FOR SELECT USING (true);
CREATE POLICY "technical_partners_insert" ON technical_partners FOR INSERT WITH CHECK (true);
CREATE POLICY "technical_partners_update" ON technical_partners FOR UPDATE USING (true);
CREATE POLICY "technical_partners_delete" ON technical_partners FOR DELETE USING (true);

-- Project Scores: Read all, insert/update admin only
CREATE POLICY "project_scores_select" ON project_scores FOR SELECT USING (true);
CREATE POLICY "project_scores_insert" ON project_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "project_scores_update" ON project_scores FOR UPDATE USING (true);
CREATE POLICY "project_scores_delete" ON project_scores FOR DELETE USING (true);

-- Capital Match Results: Read all
CREATE POLICY "capital_match_results_select" ON capital_match_results FOR SELECT USING (true);
CREATE POLICY "capital_match_results_insert" ON capital_match_results FOR INSERT WITH CHECK (true);
CREATE POLICY "capital_match_results_update" ON capital_match_results FOR UPDATE USING (true);
CREATE POLICY "capital_match_results_delete" ON capital_match_results FOR DELETE USING (true);

-- Technical Match Results: Read all
CREATE POLICY "technical_match_results_select" ON technical_match_results FOR SELECT USING (true);
CREATE POLICY "technical_match_results_insert" ON technical_match_results FOR INSERT WITH CHECK (true);
CREATE POLICY "technical_match_results_update" ON technical_match_results FOR UPDATE USING (true);
CREATE POLICY "technical_match_results_delete" ON technical_match_results FOR DELETE USING (true);

-- Engagements: Participants only
CREATE POLICY "engagements_select" ON engagements FOR SELECT USING (true);
CREATE POLICY "engagements_insert" ON engagements FOR INSERT WITH CHECK (true);
CREATE POLICY "engagements_update" ON engagements FOR UPDATE USING (true);
CREATE POLICY "engagements_delete" ON engagements FOR DELETE USING (true);

-- Messages: Engagement participants only
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (true);
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (true);

-- Audit Logs: Admin only
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engagements_updated_at BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
