-- Migration 007: User notification preferences
-- Adds a JSONB column to store per-user email notification toggles

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "match_found": true,
  "engagement_updates": true,
  "project_status": true,
  "new_messages": false
}'::jsonb;
