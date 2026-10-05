-- Migration 047: Real RLS policies as defense-in-depth
-- Replaces permissive USING(true) policies with identity-aware policies.
-- Service role bypasses RLS automatically, so app server-side queries are unaffected.
-- These policies protect against anon/authenticated key leakage.
--
-- Helper functions live in the public schema because the auth schema is owned
-- by supabase_auth_admin and the migration runner (postgres role) cannot CREATE
-- functions there.  All RLS policies reference public.is_platform_admin() / public.user_org_id().

-- Helper functions: use CREATE OR REPLACE (no DROP + CASCADE) to avoid
-- destroying existing policies that depend on them.
-- The old uuid-arg overloads are harmless and left in place.

-- Helper: check if a user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members cm
    JOIN companies c ON c.id = cm.company_id
    WHERE cm.user_id = auth.uid()
      AND cm.role = 'ADMIN'
      AND c.is_platform_org = true
      AND cm.deleted_at IS NULL
  );
$$;

-- Helper: get the user's company_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT cm.company_id
  FROM company_members cm
  WHERE cm.user_id = auth.uid()
    AND cm.deleted_at IS NULL
  LIMIT 1;
$$;

-- Grant execute to Supabase roles so RLS policies can call these functions
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_org_id() TO anon, authenticated, service_role;

-- ── Drop old permissive policies (safe for missing tables) ─────

DO $$
DECLARE
  tbl text;
  tnames text[] := ARRAY[
    'companies', 'user_profiles', 'projects', 'project_status_history',
    'project_documents', 'project_tech_requirements',
    'capital_partners', 'technical_partners', 'power_traders',
    'project_scores', 'capital_match_results', 'technical_match_results',
    'engagements', 'messages',     'audit_logs', 'portfolio_analyses', 'platform_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tnames
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- ── companies / organizations ──────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "companies_select_public" ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS "companies_update_members" ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS "companies_insert_admin" ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS "companies_delete_admin" ON public.companies';
    EXECUTE 'CREATE POLICY "companies_select_public" ON public.companies FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "companies_update_members" ON public.companies FOR UPDATE USING (id = public.user_org_id() OR public.is_platform_admin()) WITH CHECK (id = public.user_org_id() OR public.is_platform_admin())';
    EXECUTE 'CREATE POLICY "companies_insert_admin" ON public.companies FOR INSERT WITH CHECK (public.is_platform_admin())';
    EXECUTE 'CREATE POLICY "companies_delete_admin" ON public.companies FOR DELETE USING (public.is_platform_admin())';
  END IF;
END $$;

-- ── users / user_profiles ──────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "users_select_own" ON public.user_profiles';
    EXECUTE 'DROP POLICY IF EXISTS "users_update_own" ON public.user_profiles';
    EXECUTE 'CREATE POLICY "users_select_own" ON public.user_profiles FOR SELECT USING (id = auth.uid() OR public.is_platform_admin())';
    EXECUTE 'CREATE POLICY "users_update_own" ON public.user_profiles FOR UPDATE USING (id = auth.uid() OR public.is_platform_admin()) WITH CHECK (id = auth.uid() OR public.is_platform_admin())';
  END IF;
END $$;

-- ── projects ───────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "projects_select" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "projects_insert" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "projects_update" ON public.projects';
    EXECUTE 'DROP POLICY IF EXISTS "projects_delete" ON public.projects';
    EXECUTE 'CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (public.is_platform_admin() OR developer_id = public.user_org_id() OR (status = ''live'' AND is_visible_to_investors = true) OR (status = ''pending_internal_review''))';
    EXECUTE 'CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (public.is_platform_admin() OR developer_id = public.user_org_id())';
    EXECUTE 'CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (public.is_platform_admin() OR developer_id = public.user_org_id()) WITH CHECK (public.is_platform_admin() OR developer_id = public.user_org_id())';
    EXECUTE 'CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (public.is_platform_admin() OR developer_id = public.user_org_id())';
  END IF;
END $$;

-- ── project_documents ──────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_documents' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "project_documents_select" ON public.project_documents';
    EXECUTE 'DROP POLICY IF EXISTS "project_documents_insert" ON public.project_documents';
    EXECUTE 'DROP POLICY IF EXISTS "project_documents_delete" ON public.project_documents';
    EXECUTE 'CREATE POLICY "project_documents_select" ON public.project_documents FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id() OR (p.status = ''live'' AND p.is_visible_to_investors = true))))';
    EXECUTE 'CREATE POLICY "project_documents_insert" ON public.project_documents FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id())))';
    EXECUTE 'CREATE POLICY "project_documents_delete" ON public.project_documents FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id())))';
  END IF;
END $$;

-- ── engagements ────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'engagements' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "engagements_select" ON public.engagements';
    EXECUTE 'CREATE POLICY "engagements_select" ON public.engagements FOR SELECT USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = engagements.project_id AND p.developer_id = public.user_org_id()) OR EXISTS (SELECT 1 FROM public.capital_partners cp WHERE cp.id = engagements.counterparty_id AND cp.company_id = public.user_org_id()) OR EXISTS (SELECT 1 FROM public.technical_partners tp WHERE tp.id = engagements.counterparty_id AND tp.company_id = public.user_org_id()))';
  END IF;
END $$;

-- ── messages ───────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "messages_select" ON public.messages';
    EXECUTE 'DROP POLICY IF EXISTS "messages_insert" ON public.messages';
    EXECUTE 'CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (public.is_platform_admin() OR sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.engagements e JOIN public.projects p ON p.id = e.project_id WHERE e.id = messages.engagement_id AND (p.developer_id = public.user_org_id() OR EXISTS (SELECT 1 FROM public.capital_partners cp WHERE cp.id = e.counterparty_id AND cp.company_id = public.user_org_id()) OR EXISTS (SELECT 1 FROM public.technical_partners tp WHERE tp.id = e.counterparty_id AND tp.company_id = public.user_org_id()))))';
    EXECUTE 'CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.engagements e JOIN public.projects p ON p.id = e.project_id WHERE e.id = messages.engagement_id AND (p.developer_id = public.user_org_id() OR EXISTS (SELECT 1 FROM public.capital_partners cp WHERE cp.id = e.counterparty_id AND cp.company_id = public.user_org_id()) OR EXISTS (SELECT 1 FROM public.technical_partners tp WHERE tp.id = e.counterparty_id AND tp.company_id = public.user_org_id()))))';
  END IF;
END $$;

-- ── audit_logs ─────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs';
    EXECUTE 'CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT USING (public.is_platform_admin())';
  END IF;
END $$;

-- ── project_scores ─────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_scores' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.project_scores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "project_scores_select" ON public.project_scores';
    EXECUTE 'CREATE POLICY "project_scores_select" ON public.project_scores FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_scores.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id() OR (p.status = ''live'' AND p.is_visible_to_investors = true))))';
  END IF;
END $$;

-- ── capital_partners ───────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'capital_partners' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.capital_partners ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "capital_partners_select" ON public.capital_partners';
    EXECUTE 'CREATE POLICY "capital_partners_select" ON public.capital_partners FOR SELECT USING (public.is_platform_admin() OR company_id = public.user_org_id())';
  END IF;
END $$;

-- ── technical_partners ─────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'technical_partners' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.technical_partners ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "technical_partners_select" ON public.technical_partners';
    EXECUTE 'CREATE POLICY "technical_partners_select" ON public.technical_partners FOR SELECT USING (public.is_platform_admin() OR company_id = public.user_org_id())';
  END IF;
END $$;

-- ── power_traders ──────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'power_traders' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.power_traders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "power_traders_select" ON public.power_traders';
    EXECUTE 'CREATE POLICY "power_traders_select" ON public.power_traders FOR SELECT USING (public.is_platform_admin() OR company_id = public.user_org_id())';
  END IF;
END $$;

-- ── capital_match_results ──────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'capital_match_results' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.capital_match_results ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "capital_match_results_select" ON public.capital_match_results';
    EXECUTE 'CREATE POLICY "capital_match_results_select" ON public.capital_match_results FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = capital_match_results.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id())) OR EXISTS (SELECT 1 FROM public.capital_partners cp WHERE cp.id = capital_match_results.capital_partner_id AND cp.company_id = public.user_org_id()))';
  END IF;
END $$;

-- ── technical_match_results ────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'technical_match_results' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.technical_match_results ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "technical_match_results_select" ON public.technical_match_results';
    EXECUTE 'CREATE POLICY "technical_match_results_select" ON public.technical_match_results FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = technical_match_results.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id())) OR EXISTS (SELECT 1 FROM public.technical_partners tp WHERE tp.id = technical_match_results.technical_partner_id AND tp.company_id = public.user_org_id()))';
  END IF;
END $$;

-- ── portfolio_analyses ─────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portfolio_analyses' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.portfolio_analyses ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "portfolio_analyses_select_own" ON public.portfolio_analyses';
    EXECUTE 'CREATE POLICY "portfolio_analyses_select_own" ON public.portfolio_analyses FOR SELECT USING (performed_by = auth.uid()::text OR public.is_platform_admin())';
  END IF;
END $$;

-- ── platform_settings ──────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can read platform_settings" ON public.platform_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can insert platform_settings" ON public.platform_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can update platform_settings" ON public.platform_settings';
    EXECUTE 'DROP POLICY IF EXISTS "platform_settings_select_admin" ON public.platform_settings';
    EXECUTE 'DROP POLICY IF EXISTS "platform_settings_insert_admin" ON public.platform_settings';
    EXECUTE 'DROP POLICY IF EXISTS "platform_settings_update_admin" ON public.platform_settings';
    EXECUTE 'CREATE POLICY "platform_settings_select_admin" ON public.platform_settings FOR SELECT TO authenticated USING (public.is_platform_admin())';
    EXECUTE 'CREATE POLICY "platform_settings_insert_admin" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin())';
    EXECUTE 'CREATE POLICY "platform_settings_update_admin" ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_platform_admin())';
  END IF;
END $$;

-- ── project_status_history ─────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_status_history' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "project_status_history_select" ON public.project_status_history';
    EXECUTE 'CREATE POLICY "project_status_history_select" ON public.project_status_history FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_status_history.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id())))';
  END IF;
END $$;

-- ── project_tech_requirements ──────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_tech_requirements' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.project_tech_requirements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "project_tech_requirements_select" ON public.project_tech_requirements';
    EXECUTE 'CREATE POLICY "project_tech_requirements_select" ON public.project_tech_requirements FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tech_requirements.project_id AND (public.is_platform_admin() OR p.developer_id = public.user_org_id() OR (p.status = ''live'' AND p.is_visible_to_investors = true))))';
  END IF;
END $$;
