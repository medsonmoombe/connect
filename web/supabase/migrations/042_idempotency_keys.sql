-- Migration 042: Idempotency keys for state-changing requests (PRD §14)
--
-- PRD §14 requires background/state-changing ops to be idempotent. The most
-- valuable place for idempotency in the Developer↔Investor flow is
-- `POST /engagements` (express interest): a double-click or network retry must
-- not create a second engagement. We accept an `Idempotency-Key` request header
-- and cache the response for 24h keyed by (user_id, route, key).
--
-- All statements idempotent (safe to re-run via `node migrate.mjs`).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Supabase Auth user UUID (matches messages_read.user_id typing).
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The route/path this key applies to (e.g. 'POST /api/engagements').
  route         TEXT NOT NULL,
  -- The client-supplied Idempotency-Key header value.
  key           TEXT NOT NULL,
  -- The full cached response body to replay verbatim.
  response_body JSONB NOT NULL,
  -- The HTTP status code of the original response (replayed on retry).
  status_code   INTEGER NOT NULL DEFAULT 201,
  -- TTL: rows older than this are treated as misses.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Enforce: one cached response per (user, route, key).
  UNIQUE (user_id, route, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created
  ON idempotency_keys (created_at DESC);

-- RLS: service_role only — the API reads/writes this table on the user's
-- behalf; clients never query it directly.
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_idempotency" ON idempotency_keys;
CREATE POLICY "service_role_all_idempotency" ON idempotency_keys
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Optional retention cleanup: prune rows older than 24h.
-- (Run periodically via pg_cron if available; harmless to no-op otherwise.)
CREATE OR REPLACE FUNCTION prune_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
