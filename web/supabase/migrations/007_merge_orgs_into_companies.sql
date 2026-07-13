-- ============================================================
-- Migration 007: Merge organizations → companies
-- ============================================================
-- Goal: eliminate the `organizations` and `organization_members` tables
-- by consolidating their auth/RBAC columns into `companies` and
-- creating a new `company_members` table.
-- ============================================================

-- ── 0. Ensure organizations has all required columns ─────────
-- (migrations 004/006 may not have been applied)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_platform_org BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS years_operating INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Allow POWER_TRADER in organizations primary_role CHECK
DO $$
BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_primary_role_check;
  ALTER TABLE organizations ADD CONSTRAINT organizations_primary_role_check
    CHECK (primary_role IN ('DEVELOPER','CAPITAL_PARTNER','TECHNICAL_PARTNER','GRANT_PROVIDER','POWER_TRADER'));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- ── 1. Add RBAC columns to companies ─────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_role TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_platform_org BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_verification';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Derive primary_role from legacy type column (cast through text)
UPDATE companies SET primary_role = CASE type::text
  WHEN 'CAPITAL'      THEN 'CAPITAL_PARTNER'
  WHEN 'TECHNICAL'    THEN 'TECHNICAL_PARTNER'
  WHEN 'DEVELOPER'    THEN 'DEVELOPER'
  WHEN 'POWER_TRADER' THEN 'POWER_TRADER'
  ELSE 'DEVELOPER'
END WHERE primary_role IS NULL;

-- Make primary_role NOT NULL after backfill
ALTER TABLE companies ALTER COLUMN primary_role SET NOT NULL;

-- Add CHECK constraint on status
DO $$
BEGIN
  ALTER TABLE companies ADD CONSTRAINT companies_status_check
    CHECK (status IN ('pending_verification','verified','rejected','needs_update'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Backfill companies from organizations (by name match) ──
UPDATE companies c
SET
  is_platform_org = COALESCE(o.is_platform_org, false),
  status          = COALESCE(o.status, c.status),
  rejection_note  = COALESCE(o.rejection_note, c.rejection_note),
  reviewed_by     = COALESCE(o.reviewed_by, c.reviewed_by),
  reviewed_at     = COALESCE(o.reviewed_at, c.reviewed_at),
  admin_note      = COALESCE(o.admin_note, c.admin_note),
  primary_role    = COALESCE(o.primary_role, c.primary_role)
FROM organizations o
WHERE o.name = c.name;

-- Create companies for organizations that have NO matching company row
-- Map primary_role to an existing company_type enum value (POWER_TRADER → DEVELOPER since type column is legacy)
INSERT INTO companies (name, primary_role, is_platform_org, status, rejection_note, reviewed_by, reviewed_at, admin_note, country, description, website, team_size, years_operating, logo_url, type)
SELECT
  o.name,
  o.primary_role,
  COALESCE(o.is_platform_org, false),
  o.status,
  o.rejection_note,
  o.reviewed_by,
  o.reviewed_at,
  o.admin_note,
  COALESCE(o.country, 'Not specified') as country,
  o.description,
  o.website,
  o.team_size,
  o.years_operating,
  o.logo_url,
  CASE
    WHEN o.primary_role::text = 'CAPITAL_PARTNER'   THEN 'CAPITAL'::company_type
    WHEN o.primary_role::text = 'TECHNICAL_PARTNER' THEN 'TECHNICAL'::company_type
    ELSE 'DEVELOPER'::company_type
  END
FROM organizations o
LEFT JOIN companies c ON c.name = o.name
WHERE c.id IS NULL;

-- ── 3. Create company_members ─────────────────────────────────
CREATE TABLE IF NOT EXISTS company_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','MEMBER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Enforce single-org membership
DO $$
BEGIN
  ALTER TABLE company_members ADD CONSTRAINT company_members_user_id_unique UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Migrate organization_members → company_members ──────────
INSERT INTO company_members (user_id, company_id, role, created_at)
SELECT
  om.user_id,
  c.id AS company_id,
  om.role,
  om.created_at
FROM organization_members om
JOIN organizations o  ON o.id = om.org_id
JOIN companies c      ON c.name = o.name
ON CONFLICT DO NOTHING;

-- ── 5. Add RLS for company_members ─────────────────────────────
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_see_own"       ON company_members;
DROP POLICY IF EXISTS "service_role_all"      ON company_members;

CREATE POLICY "members_see_own" ON company_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_role_all" ON company_members FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_members_user    ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);

-- ── 6. Update helper functions ─────────────────────────────────
CREATE OR REPLACE FUNCTION is_platform_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members cm
    JOIN companies c ON c.id = cm.company_id
    WHERE cm.user_id = uid
      AND cm.role = 'ADMIN'
      AND c.is_platform_org = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_company_id(uid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
  SELECT company_id FROM company_members WHERE user_id = uid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 7. Drop old tables ─────────────────────────────────────
DROP POLICY IF EXISTS "org_members_read_own_org" ON organizations;
DROP POLICY IF EXISTS "Platform admins can read email_log" ON email_log;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
