-- Energy Capital Match - MVP Database Schema
-- Supabase PostgreSQL with Row Level Security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM (
  'DEVELOPER', 
  'CAPITAL_PARTNER', 
  'TECHNICAL_PARTNER', 
  'ADMIN'
);

CREATE TYPE company_type AS ENUM (
  'DEVELOPER', 
  'CAPITAL', 
  'TECHNICAL'
);

CREATE TYPE project_stage AS ENUM (
  'CONCEPT',
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

CREATE TYPE match_status AS ENUM (
  'active',
  'inactive'
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_new_company_with_experienced_team BOOLEAN DEFAULT FALSE,
  management_team_experience JSONB DEFAULT '{}'
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
  sector_focus TEXT[],
  preferred_project_stage project_stage[],
  expected_return_profile TEXT,
  preferred_capital_structure capital_structure_type[]
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
  delivery_models TEXT[],
  payment_terms TEXT,
  project_type_experience TEXT[],
  min_ticket_size_zmw BIGINT,
  max_ticket_size_zmw BIGINT,
  years_of_experience INTEGER,
  company_experience_doc_url TEXT
);

-- Project Scores Table
CREATE TABLE project_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  capital_readiness_score INTEGER CHECK (capital_readiness_score >= 0 AND capital_readiness_score <= 100),
  technical_readiness_score INTEGER CHECK (technical_readiness_score >= 0 AND technical_readiness_score <= 100),
  regulatory_score INTEGER DEFAULT 0,
  financial_score INTEGER DEFAULT 0,
  developer_score INTEGER DEFAULT 0,
  documentation_score INTEGER CHECK (documentation_score >= 0 AND documentation_score <= 100),
  governance_score INTEGER CHECK (governance_score >= 0 AND governance_score <= 100),
  financial_transparency_score INTEGER CHECK (financial_transparency_score >= 0 AND financial_transparency_score <= 100),
  breakdown JSONB DEFAULT '{}',
  risk_flags TEXT[],
  recommendations TEXT[],
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
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

CREATE TABLE power_traders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  max_offtake_capacity_mw DECIMAL(10, 2),
  preferred_technology_types TEXT[],
  regions_of_interest TEXT[],
  min_ppa_duration_years INTEGER,
  credit_rating_equivalent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technical Match Results Table
CREATE TABLE technical_match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  technical_partner_id UUID NOT NULL REFERENCES technical_partners(id) ON DELETE CASCADE,
  compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  score_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status match_status DEFAULT 'active',
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

-- Companies: Users can read their own company, Admins can read all.
CREATE POLICY "companies_select" ON companies FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.company_id = companies.id OR users.role = 'ADMIN'))
);
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (true); -- Allow creation during signup
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.company_id = companies.id OR users.role = 'ADMIN'))
);

-- Users: Read self, update self, admin full access
CREATE POLICY "users_select" ON users FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true); -- Allow creation during signup
CREATE POLICY "users_update" ON users FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
) WITH CHECK (
  auth.uid() = id OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN')
);

-- Projects: Developers read/manage own, Matched Partners read if Engagement exists
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.company_id = projects.developer_id OR users.role = 'ADMIN'))
  OR EXISTS (
    SELECT 1 FROM engagements e 
    WHERE e.project_id = projects.id 
    AND e.counterparty_id = (SELECT company_id FROM users WHERE id = auth.uid())
  )
);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.company_id = developer_id AND users.role = 'DEVELOPER')
);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.company_id = projects.developer_id OR users.role = 'ADMIN'))
);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.company_id = projects.developer_id OR users.role = 'ADMIN'))
);

-- Project Documents: Owner or Engagement Participant
CREATE POLICY "project_documents_select" ON project_documents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_documents.project_id 
    AND (
      EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.company_id = p.developer_id OR u.role = 'ADMIN'))
      OR EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.project_id = p.id 
        AND e.counterparty_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND e.status NOT IN ('INTRO_SENT') -- Restricted until Intro is Accepted
      )
    )
  )
);
CREATE POLICY "project_documents_insert" ON project_documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects p JOIN users u ON p.developer_id = u.company_id WHERE p.id = project_id AND u.id = auth.uid())
);
CREATE POLICY "project_documents_delete" ON project_documents FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects p JOIN users u ON p.developer_id = u.company_id WHERE p.id = project_id AND u.id = auth.uid())
);

-- Project Scores: Developer owner, Admin, or matched Capital Partner. Technical Partners have no access.
CREATE POLICY "project_scores_select" ON project_scores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (
      u.role = 'ADMIN' OR 
      (u.role = 'DEVELOPER' AND EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_scores.project_id 
        AND p.developer_id = u.company_id
      )) OR
      (u.role = 'CAPITAL_PARTNER' AND EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.project_id = project_scores.project_id 
        AND e.counterparty_id = u.company_id
        AND e.status NOT IN ('INTRO_SENT')
      ))
    )
  )
);

CREATE POLICY "project_scores_insert" ON project_scores FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (
      u.role = 'ADMIN' OR 
      (u.role = 'DEVELOPER' AND EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_scores.project_id 
        AND p.developer_id = u.company_id
      ))
    )
  )
);

CREATE POLICY "project_scores_update" ON project_scores FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (
      u.role = 'ADMIN' OR 
      (u.role = 'DEVELOPER' AND EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = project_scores.project_id 
        AND p.developer_id = u.company_id
      ))
    )
  )
);

-- Matches: Own matches only
CREATE POLICY "capital_match_results_select" ON capital_match_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND (
      u.role = 'ADMIN'
      OR EXISTS (SELECT 1 FROM capital_partners cp WHERE cp.id = capital_match_results.capital_partner_id AND cp.company_id = u.company_id)
      OR EXISTS (SELECT 1 FROM projects p WHERE p.id = capital_match_results.project_id AND p.developer_id = u.company_id)
    )
  )
);

CREATE POLICY "technical_match_results_select" ON technical_match_results FOR SELECT USING (
  technical_match_results.status = 'active'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND (
      u.role = 'ADMIN'
      OR EXISTS (SELECT 1 FROM technical_partners tp WHERE tp.id = technical_match_results.technical_partner_id AND tp.company_id = u.company_id)
      OR EXISTS (SELECT 1 FROM projects p WHERE p.id = technical_match_results.project_id AND p.developer_id = u.company_id)
    )
  )
);

-- Engagements: Participants only
CREATE POLICY "engagements_select" ON engagements FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.company_id = engagements.counterparty_id OR u.company_id = (SELECT developer_id FROM projects WHERE id = engagements.project_id) OR u.role = 'ADMIN'))
);
CREATE POLICY "engagements_update" ON engagements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.company_id = engagements.counterparty_id OR u.company_id = (SELECT developer_id FROM projects WHERE id = engagements.project_id) OR u.role = 'ADMIN'))
);

-- Messages: Engagement participants only
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM engagements e WHERE e.id = messages.engagement_id AND (
    e.counterparty_id = (SELECT company_id FROM users WHERE id = auth.uid()) OR 
    (SELECT developer_id FROM projects WHERE id = e.project_id) = (SELECT company_id FROM users WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  ))
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM engagements e WHERE e.id = engagement_id AND (
    e.counterparty_id = (SELECT company_id FROM users WHERE id = auth.uid()) OR 
    (SELECT developer_id FROM projects WHERE id = e.project_id) = (SELECT company_id FROM users WHERE id = auth.uid())
  ))
);

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


