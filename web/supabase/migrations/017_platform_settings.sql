-- Migration 017: Create platform_settings table for AI configuration
-- Stores platform-wide settings as key-value pairs (JSON values)

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read/write
CREATE POLICY "Platform admins can read platform_settings"
  ON platform_settings
  FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Platform admins can insert platform_settings"
  ON platform_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update platform_settings"
  ON platform_settings
  FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

-- Insert default AI analysis settings
INSERT INTO platform_settings (key, value) VALUES
  ('ai_analysis', '{"auto_trigger": false, "weights": {"regulatory": 40, "financial": 35, "developer": 25}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);
