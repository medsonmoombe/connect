-- Migration 012: Fix RLS policies — drop blanket USING (true) policies, add proper role-scoped ones
-- This is a security-critical migration that removes the permissive blanket policies
-- which allowed all roles (anon, authenticated) full read/write access to every table.

-- ============================================================
-- 1. DROP ALL EXISTING BLANKET POLICIES
-- ============================================================

-- Drop the misnamed "service_role_all" blanket policies from schema.sql
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'companies', 'users', 'projects', 'project_documents', 'project_tech_requirements',
    'capital_partners', 'technical_partners', 'power_traders',
    'engagements', 'messages', 'portfolio_analyses',
    'project_analytics', 'project_views_daily',
    'setup_invites', 'password_resets',
    'project_scores', 'capital_match_results', 'technical_match_results',
    'audit_logs', 'user_profiles', 'company_members'
  ])
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND qual = 'true'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Also drop named policies from matching_updates.sql and migrations that are now redundant
DROP POLICY IF EXISTS "project_scores_admin_all" ON project_scores;
DROP POLICY IF EXISTS "project_scores_developer_select" ON project_scores;
DROP POLICY IF EXISTS "project_scores_capital_select" ON project_scores;
DROP POLICY IF EXISTS "project_scores_developer_insert" ON project_scores;
DROP POLICY IF EXISTS "project_scores_developer_update" ON project_scores;
DROP POLICY IF EXISTS "capital_match_results_select" ON capital_match_results;
DROP POLICY IF EXISTS "technical_match_results_select" ON technical_match_results;
DROP POLICY IF EXISTS "users_read_own_audit" ON audit_logs;
DROP POLICY IF EXISTS "users_own_profile_select" ON user_profiles;
DROP POLICY IF EXISTS "users_own_profile_update" ON user_profiles;
DROP POLICY IF EXISTS "members_see_own" ON company_members;
DROP POLICY IF EXISTS "service_role_all" ON company_members;

-- ============================================================
-- 2. SERVICE ROLE ONLY TABLES (no anon/authenticated access)
-- ============================================================

-- password_resets: only service_role should access
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON password_resets FOR ALL USING (false);

-- setup_invites: only service_role should access
ALTER TABLE setup_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON setup_invites FOR ALL USING (false);

-- audit_logs: only service_role + admins via API
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON audit_logs FOR ALL USING (false);

-- ============================================================
-- 3. COMPANIES — org members can read their own, service_role writes
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_own" ON companies
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_all_companies" ON companies
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 4. PROJECTS — developers read own, partners read submitted, service_role all
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developers_read_own" ON projects
  FOR SELECT TO authenticated
  USING (developer_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND deleted_at IS NULL
  ));

CREATE POLICY "submitted_projects_readable" ON projects
  FOR SELECT TO authenticated
  USING (status = 'submitted' AND deleted_at IS NULL);

CREATE POLICY "service_role_all_projects" ON projects
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 5. PROJECT_DOCUMENTS — readable by project owner + engaged partners
-- ============================================================

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_docs_owner_read" ON project_documents
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN company_members cm ON cm.company_id = p.developer_id
    WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
  ));

CREATE POLICY "service_role_all_project_docs" ON project_documents
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 6. PROJECT_TECH_REQUIREMENTS — readable by project owner
-- ============================================================

ALTER TABLE project_tech_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_reqs_owner_read" ON project_tech_requirements
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN company_members cm ON cm.company_id = p.developer_id
    WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
  ));

CREATE POLICY "service_role_all_tech_reqs" ON project_tech_requirements
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 7. CAPITAL_PARTNERS — readable by authenticated (for matching UI)
-- ============================================================

ALTER TABLE capital_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_capital" ON capital_partners
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "service_role_all_capital" ON capital_partners
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 8. TECHNICAL_PARTNERS — readable by authenticated
-- ============================================================

ALTER TABLE technical_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_technical" ON technical_partners
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "service_role_all_technical" ON technical_partners
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 9. POWER_TRADERS — readable by authenticated
-- ============================================================

ALTER TABLE power_traders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_traders" ON power_traders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "service_role_all_traders" ON power_traders
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 10. ENGAGEMENTS — parties can read, service_role writes
-- ============================================================

ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_read_engagements" ON engagements
  FOR SELECT TO authenticated
  USING (
    counterparty_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND deleted_at IS NULL)
    OR project_id IN (
      SELECT p.id FROM projects p
      WHERE p.developer_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND deleted_at IS NULL)
    )
  );

CREATE POLICY "service_role_all_engagements" ON engagements
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 11. MESSAGES — engagement parties can read, service_role writes
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    engagement_id IN (
      SELECT e.id FROM engagements e
      WHERE e.counterparty_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND deleted_at IS NULL)
         OR e.project_id IN (
           SELECT p.id FROM projects p
           WHERE p.developer_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND deleted_at IS NULL)
         )
    )
  );

CREATE POLICY "service_role_all_messages" ON messages
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 12. PROJECT_SCORES — owner devs + engaged partners read, service_role writes
-- ============================================================

ALTER TABLE project_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_owner_read" ON project_scores
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN company_members cm ON cm.company_id = p.developer_id
    WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
  ));

CREATE POLICY "service_role_all_scores" ON project_scores
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 13. CAPITAL_MATCH_RESULTS — owner devs + matched partners read
-- ============================================================

ALTER TABLE capital_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capital_matches_read" ON capital_match_results
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN company_members cm ON cm.company_id = p.developer_id
      WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
    )
    OR capital_partner_id IN (
      SELECT cp.id FROM capital_partners cp
      JOIN company_members cm ON cm.company_id = cp.company_id
      WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_all_capital_matches" ON capital_match_results
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 14. TECHNICAL_MATCH_RESULTS — owner devs + matched partners read
-- ============================================================

ALTER TABLE technical_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "technical_matches_read" ON technical_match_results
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN company_members cm ON cm.company_id = p.developer_id
      WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
    )
    OR technical_partner_id IN (
      SELECT tp.id FROM technical_partners tp
      JOIN company_members cm ON cm.company_id = tp.company_id
      WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
    )
  );

CREATE POLICY "service_role_all_technical_matches" ON technical_match_results
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 15. USER_PROFILES — own profile read/update
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "own_profile_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "service_role_all_profiles" ON user_profiles
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 16. COMPANY_MEMBERS — own membership read
-- ============================================================

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_membership_select" ON company_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service_role_all_members" ON company_members
  FOR ALL TO service_role
  USING (true);

-- ============================================================
-- 17. PORTFOLIO_ANALYSES — service_role only
-- ============================================================

ALTER TABLE portfolio_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON portfolio_analyses FOR ALL USING (false);

-- ============================================================
-- 18. PROJECT_ANALYTICS — service_role only
-- ============================================================

ALTER TABLE project_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON project_analytics FOR ALL USING (false);

-- ============================================================
-- 19. PROJECT_VIEWS_DAILY — service_role only
-- ============================================================

ALTER TABLE project_views_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON project_views_daily FOR ALL USING (false);

-- ============================================================
-- 20. EMAIL_LOG — service_role only (already correct from migration 007)
-- ============================================================

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON email_log FOR ALL USING (false);

-- ============================================================
-- 21. NOTIFICATIONS — own notifications read/update/delete, service_role insert
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own_notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own_notifications_delete" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service_role_all_notifications" ON notifications
  FOR ALL TO service_role
  USING (true);
