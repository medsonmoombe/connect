-- Migration 005: In-app notifications + email log table

-- 1. Email log — tracks every email sent through the platform
CREATE TABLE IF NOT EXISTS email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,                    -- invite, verification, welcome, password_reset, org_status, admin_new_org, etc.
  recipients text[] NOT NULL,            -- email addresses
  subject text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  email_id text,                         -- Resend message ID
  error text,                            -- error message if failed
  entity_id text,                        -- optional: related entity (org id, user id, etc.)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_log_type ON email_log(type);
CREATE INDEX idx_email_log_created ON email_log(created_at DESC);
CREATE INDEX idx_email_log_entity ON email_log(entity_id) WHERE entity_id IS NOT NULL;

-- 2. In-app notifications — per-user notification feed
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,                    -- org_status_change, match_found, engagement_update, message_received, system_announcement, etc.
  title text NOT NULL,
  body text NOT NULL,
  entity_type text,                      -- optional: organizations, projects, engagements, etc.
  entity_id text,                        -- optional: related entity ID
  action_url text,                       -- optional: deep link to relevant page
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- 3. RLS policies (enable Row Level Security)
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Only Platform Admins can read email_log
CREATE POLICY "Platform admins can read email_log"
  ON email_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can insert notifications (via API)
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- 4. Enable Realtime on notifications table
-- Run in Supabase Dashboard > Database > Replication, or via:
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
