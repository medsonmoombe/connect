-- Migration 038: Realtime for engagements + message soft-delete + read receipts
--
-- Goals:
--  * Publish `engagements` to Supabase Realtime so the engagement room receives
--    live status changes (intro accepted, milestones advanced) without polling.
--  * Add `messages.deleted_at` so users can soft-delete their own messages within
--    the PRD §11.1 5-minute window (no edits allowed).
--  * Add a `messages_read` table to track the last-read timestamp per user per
--    engagement, powering unread counts in the inbox (MessagesTab) and nav badge.
--
-- All statements are idempotent and safe to re-run via `node migrate.mjs`.

-- ── 1. Publish engagements to realtime (for live status updates) ───────────────
-- UPDATE payloads need FULL replica identity so the client receives the full row
-- (we subscribe to status changes in the engagement room).
ALTER TABLE engagements REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'engagements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE engagements;
  END IF;
END $$;

-- ── 2. Message soft-delete ────────────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by  TEXT NULL;

-- Index for the common "fetch live messages in an engagement" filter.
CREATE INDEX IF NOT EXISTS idx_messages_engagement_live
  ON messages (engagement_id, created_at ASC)
  WHERE deleted_at IS NULL;

-- ── 3. Read receipts (per user per engagement) ───────────────────────────────
-- Replaces a full messages_read row-per-message model with a single last-read
-- timestamp, which is cheaper and sufficient for unread counts.
--
-- NOTE on user_id typing: the legacy `users(id)` table is TEXT (a stale Firebase
-- UID comment) but the live app stores Supabase Auth UUIDs there. To keep this
-- table cleanly client-writable via `auth.uid()` (UUID) WITHOUT relying on an
-- implicit text/uuid cast or coupling to the legacy `users` table, we type
-- `user_id` as UUID and reference `auth.users(id)` directly. This matches the
-- authenticated user's identity exactly and makes the RLS policies below
-- reliable.
CREATE TABLE IF NOT EXISTS messages_read (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, engagement_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_read_user
  ON messages_read (user_id, last_read_at DESC);

-- RLS: a user may only read/upsert their own last-read rows. Writes from the
-- browser (mark-as-read) go through the anon/authenticated role; service_role
-- is unaffected.
ALTER TABLE messages_read ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_read_messages_read" ON messages_read;
CREATE POLICY "self_read_messages_read" ON messages_read
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "self_upsert_messages_read" ON messages_read;
CREATE POLICY "self_upsert_messages_read" ON messages_read
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "self_update_messages_read" ON messages_read
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can always manage rows (used by admin tooling / backfills).
DROP POLICY IF EXISTS "service_role_all_messages_read" ON messages_read;
CREATE POLICY "service_role_all_messages_read" ON messages_read
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Keep messages read rows available to the realtime layer.
ALTER TABLE messages_read REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages_read'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages_read;
  END IF;
END $$;

-- ── 4. Soft-delete is server-mediated (no client DELETE policy) ─────────────
-- The API performs the soft-delete via the service_role client and enforces
-- (a) ownership and (b) the PRD §11.1 5-minute window. We intentionally do NOT
-- add an authenticated DELETE policy here: `messages.sender_id` is a Firebase
-- UID stored as TEXT (see schema.sql), whereas `auth.uid()` is a UUID from
-- Supabase Auth, so a `sender_id = auth.uid()` check would be an unreliable
-- type comparison. Keeping the delete server-side avoids that mismatch and
-- keeps a single enforcement point for the time window. service_role already
-- has full access via the existing policy from migration 012.

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
