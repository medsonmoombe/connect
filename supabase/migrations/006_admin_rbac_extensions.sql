-- Migration 006: Admin RBAC extensions
-- Adds user suspension, score override tracking, and org invite scoping

-- 1. User suspension
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES user_profiles(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS suspension_reason text;

-- 2. Score override tracking (non-destructive — nullable)
ALTER TABLE project_scores ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES user_profiles(id);
ALTER TABLE project_scores ADD COLUMN IF NOT EXISTS overridden_at timestamptz;
ALTER TABLE project_scores ADD COLUMN IF NOT EXISTS override_note text;

-- 4. Extended user profile fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

