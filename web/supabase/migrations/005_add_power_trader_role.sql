-- Add POWER_TRADER to organizations CHECK constraint
-- and update rejection_note column if it doesn't exist

-- Drop old constraint and recreate with POWER_TRADER
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_primary_role_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_primary_role_check 
  CHECK (primary_role IN ('DEVELOPER','CAPITAL_PARTNER','TECHNICAL_PARTNER','GRANT_PROVIDER','POWER_TRADER'));

-- Add rejection_note if missing (migration 003 created it, but just in case)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS rejection_note TEXT;
