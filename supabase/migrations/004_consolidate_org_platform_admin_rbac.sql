-- Migration 004: Consolidate organizations, Platform Admin distinction, RBAC foundation
-- Run after 003_supabase_auth_foundation.sql

-- 1. Add missing columns to organizations (consolidate from companies)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS team_size integer DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS years_operating integer DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Enforce single-org membership via UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_user_id_unique'
  ) THEN
    ALTER TABLE organization_members ADD CONSTRAINT organization_members_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3. Add platform_admin flag to organizations for internal platform admins
-- Platform Admins (internal staff) get their own org entry with is_platform_org = true
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_platform_org boolean DEFAULT false;

-- 4. Backfill: copy company metadata into organizations where names match
UPDATE organizations o
SET
  country = c.country,
  description = c.description,
  website = c.website,
  team_size = c.team_size,
  years_operating = c.years_operating,
  logo_url = c.logo_url
FROM companies c
WHERE o.name = c.name
  AND o.country IS NULL;

-- 5. Add GRANT_PROVIDER to user_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'GRANT_PROVIDER' AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'user_role'
    )
  ) THEN
    ALTER TYPE user_role ADD VALUE 'GRANT_PROVIDER';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Ensure pending_verification is the default org status
ALTER TABLE organizations ALTER COLUMN status SET DEFAULT 'pending_verification';
