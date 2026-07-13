-- Migration 006: Add is_platform_org column for platform admin distinction
-- Platform Admins (internal staff) belong to an org with is_platform_org = true.
-- Org Admins belong to regular orgs (is_platform_org = false).

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_platform_org boolean DEFAULT false;

-- Allow POWER_TRADER as a valid primary_role (if constrained)
DO $$
BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_primary_role_check;
  ALTER TABLE organizations ADD CONSTRAINT organizations_primary_role_check 
    CHECK (primary_role IN ('DEVELOPER','CAPITAL_PARTNER','TECHNICAL_PARTNER','GRANT_PROVIDER','POWER_TRADER'));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
