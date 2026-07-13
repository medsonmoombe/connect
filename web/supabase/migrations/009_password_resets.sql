-- ── 9. Password Resets ────────────────────────────────────────
-- Custom token-based password reset (replaces Supabase generateLink OTP flow)

CREATE TABLE IF NOT EXISTS password_resets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user  ON password_resets(user_id);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (no user-facing RLS)
DROP POLICY IF EXISTS "service_role_all" ON password_resets;
CREATE POLICY "service_role_all" ON password_resets FOR ALL USING (true);
