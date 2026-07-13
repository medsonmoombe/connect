-- ============================================================
-- Migration 003: Supabase Auth Foundation (deadlock-safe)
-- Run in Supabase SQL Editor — safe to re-run.
-- ============================================================

-- ── 1. Extend audit_logs ─────────────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state  JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address   TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent   TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata     JSONB DEFAULT '{}';

-- ── 2. Organizations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  primary_role   TEXT NOT NULL CHECK (primary_role IN ('DEVELOPER','CAPITAL_PARTNER','TECHNICAL_PARTNER','GRANT_PROVIDER')),
  status         TEXT NOT NULL DEFAULT 'pending_verification'
                 CHECK (status IN ('pending_verification','verified','rejected','needs_update')),
  rejection_note TEXT,
  reviewed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Organization Members ──────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','MEMBER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- ── 4. User Profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  avatar_url          TEXT,
  email               TEXT NOT NULL,
  mfa_enabled         BOOLEAN DEFAULT FALSE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Setup Invites ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setup_invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email      TEXT,
  issued_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_members_user    ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org     ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_setup_invites_token ON setup_invites(token);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email  ON user_profiles(email);

-- ── 7. updated_at triggers ───────────────────────────────────
DROP TRIGGER IF EXISTS update_organizations_updated_at  ON organizations;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at  ON user_profiles;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. Enable RLS ────────────────────────────────────────────
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_invites        ENABLE ROW LEVEL SECURITY;

-- ── 9. RLS Policies — drop first so re-runs don't error ──────
DROP POLICY IF EXISTS "users_own_profile_select"   ON user_profiles;
DROP POLICY IF EXISTS "users_own_profile_update"   ON user_profiles;
DROP POLICY IF EXISTS "members_see_own"            ON organization_members;
DROP POLICY IF EXISTS "org_members_read_own_org"   ON organizations;
DROP POLICY IF EXISTS "users_read_own_audit"       ON audit_logs;
DROP POLICY IF EXISTS "service_role_all"           ON organizations;
DROP POLICY IF EXISTS "service_role_all"           ON organization_members;
DROP POLICY IF EXISTS "service_role_all"           ON user_profiles;
DROP POLICY IF EXISTS "service_role_all"           ON setup_invites;

CREATE POLICY "users_own_profile_select" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_own_profile_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "members_see_own" ON organization_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "org_members_read_own_org" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "users_read_own_audit" ON audit_logs
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "service_role_all" ON organizations        FOR ALL USING (true);
CREATE POLICY "service_role_all" ON organization_members FOR ALL USING (true);
CREATE POLICY "service_role_all" ON user_profiles        FOR ALL USING (true);
CREATE POLICY "service_role_all" ON setup_invites        FOR ALL USING (true);

-- ── 10. Helper functions ─────────────────────────────────────
CREATE OR REPLACE FUNCTION is_platform_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = uid AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_org_id(uid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
  SELECT org_id FROM organization_members WHERE user_id = uid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
