-- 014_org_settings_and_password_expiry.sql
-- Org-level security settings + password expiry tracking

-- Org security settings on companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS password_expiry_days INTEGER DEFAULT 0; -- 0 = no expiry
ALTER TABLE companies ADD COLUMN IF NOT EXISTS min_password_length INTEGER DEFAULT 8;

-- Track when password was last changed
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();
