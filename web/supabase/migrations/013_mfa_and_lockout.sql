-- Migration 013: MFA codes table, login attempt tracking, account lockout
-- Adds: mfa_codes, login_attempts tables, lockout columns on user_profiles

-- ============================================================
-- 1. MFA CODES — stores OTP codes for admin MFA verification
-- ============================================================

CREATE TABLE IF NOT EXISTS mfa_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_codes_user   ON mfa_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_codes_expiry ON mfa_codes(expires_at) WHERE used_at IS NULL;

-- ============================================================
-- 2. LOGIN ATTEMPTS — tracks failed login attempts for lockout
-- ============================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  success     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time  ON login_attempts(user_id, created_at DESC);

-- ============================================================
-- 3. LOCKOUT COLUMNS on user_profiles
-- ============================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS lock_reason TEXT DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS mfa_failed_attempts INTEGER DEFAULT 0;

-- ============================================================
-- 4. RLS — service_role only for new tables
-- ============================================================

ALTER TABLE mfa_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mfa_codes" ON mfa_codes FOR ALL TO service_role USING (true);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_login_attempts" ON login_attempts FOR ALL TO service_role USING (true);
