-- Migration 052: Business-value features
-- 1. Investor interest signals tracking
-- 2. Investor interest score on projects
-- 3. Matching digests scheduling
-- 4. Platform analytics aggregate view

-- ── 1. Interest signals ─────────────────────────────────────────────────────
-- Tracks granular investor interest events per project for the Interest Index
CREATE TABLE IF NOT EXISTS project_interest_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'express_interest', 'bookmark', 'view', 'dataroom_open',
    'document_download', 'message_sent', 'engagement_created'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate bookmarks
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_bookmark
  ON project_interest_signals (project_id, user_id)
  WHERE signal_type = 'bookmark';

-- Prevent duplicate express_interest per user per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_express_interest
  ON project_interest_signals (project_id, user_id)
  WHERE signal_type = 'express_interest';

-- Query performance: fetch signals for a project
CREATE INDEX IF NOT EXISTS idx_interest_signals_project
  ON project_interest_signals (project_id, signal_type, created_at DESC);

-- Query performance: fetch signals for a user
CREATE INDEX IF NOT EXISTS idx_interest_signals_user
  ON project_interest_signals (user_id, created_at DESC);

-- ── 2. Investor interest score on projects ───────────────────────────────────
-- Cached computed score (0-100) updated periodically or on-demand
ALTER TABLE projects ADD COLUMN investor_interest_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN investor_interest_updated_at TIMESTAMPTZ;

-- ── 3. Matching digests ─────────────────────────────────────────────────────
-- Stores digest preferences and schedule for each user
CREATE TABLE IF NOT EXISTS matching_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'off')),
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track digest email history
CREATE TABLE IF NOT EXISTS matching_digest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL,
  matches_sent INTEGER NOT NULL DEFAULT 0,
  new_matches INTEGER NOT NULL DEFAULT 0,
  score_changes INTEGER NOT NULL DEFAULT 0,
  engagement_updates INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_logs_user
  ON matching_digest_logs (user_id, sent_at DESC);

-- ── 4. Platform analytics materialized view ─────────────────────────────────
-- Pre-computed aggregate for the admin analytics dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS platform_analytics_daily AS
SELECT
  date_trunc('day', timestamp)::date AS day,
  COUNT(*) FILTER (WHERE entity_type = 'project') AS projects_created,
  COUNT(*) FILTER (WHERE entity_type = 'engagement') AS engagements_created,
  COUNT(*) FILTER (WHERE entity_type = 'company') AS companies_created,
  COUNT(*) FILTER (WHERE action_type = 'USER_REGISTERED') AS users_registered,
  COUNT(*) FILTER (WHERE action_type LIKE '%MATCH%') AS matches_generated,
  COUNT(*) AS total_actions
FROM audit_logs
WHERE timestamp >= now() - INTERVAL '90 days'
GROUP BY date_trunc('day', timestamp)::date
ORDER BY day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_analytics_daily_day
  ON platform_analytics_daily (day);

-- ── 5. Engagement stage distribution view ────────────────────────────────────
-- For the Kanban board and analytics: counts per status per project
CREATE OR REPLACE VIEW engagement_stage_counts AS
SELECT
  project_id,
  status,
  COUNT(*) AS count
FROM engagements
WHERE status != 'DROPPED'
GROUP BY project_id, status;
