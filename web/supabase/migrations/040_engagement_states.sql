-- Migration 040: Engagement state-transition history (PRD §10, §J)
--
-- PRD §J calls for a dedicated `engagement_states` table logging every
-- transition for audit purposes. Today the only record of transitions is in
-- `audit_logs`. This adds a dedicated, structured history that the engagement
-- room's milestone timeline reads from (so each milestone shows who advanced
-- it and when, plus an optional reason code — required by PRD §10.2 e.g. the
-- `* → DROPPED` "Reason code provided" postcondition).
--
-- All statements idempotent (safe to re-run via `node migrate.mjs`).

CREATE TABLE IF NOT EXISTS engagement_states (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id  UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  from_status    engagement_status NOT NULL,
  to_status      engagement_status NOT NULL,
  -- The user who triggered the transition. TEXT (no FK) to match the
  -- messages.sender_id / audit_logs.user_id pattern used elsewhere (the legacy
  -- `users` table is TEXT while these may carry Supabase Auth UUIDs).
  actor_id       TEXT,
  -- Optional reason code (e.g. for DROPPED transitions per PRD §10.2).
  reason         TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_states_engagement
  ON engagement_states (engagement_id, created_at DESC);

-- RLS: service_role only — history is written by the API on every transition
-- and read via the engagement audit endpoint. Clients never read it directly.
ALTER TABLE engagement_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_engagement_states" ON engagement_states;
CREATE POLICY "service_role_all_engagement_states" ON engagement_states
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill a single initial "transition" for every existing engagement so
-- milestone timelines have a starting point. Use the engagement's own
-- created_at as the timestamp (IS NOT true guard keeps this idempotent).
INSERT INTO engagement_states (engagement_id, from_status, to_status, reason, metadata, created_at)
  SELECT e.id, e.status, e.status, 'backfill_initial', '{}'::jsonb, e.created_at
  FROM engagements e
  WHERE NOT EXISTS (
    SELECT 1 FROM engagement_states es WHERE es.engagement_id = e.id
  );
