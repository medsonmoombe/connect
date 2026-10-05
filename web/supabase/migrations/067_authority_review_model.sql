-- Migration 067: Authority-review model
--
-- 1. Add `under_review` to the project status CHECK constraint. `pending_live`
--    stays valid for back-compat (legacy rows), but the canonical developer
--    flow now goes draft → scoring → under_review → live (or returned to draft).
-- 2. Backfill: any existing rows in `pending_live` are moved to `under_review`
--    so they appear in the authority review queue immediately. Their
--    `scores_visible_at` is cleared so the score is hidden from the developer
--    until a reviewer decides (matches the new policy).
-- 3. Add the `project_reviews` table — records every approve/return decision
--    with reviewer, decision, comments, and the project's status at the time.
--    This is the source of truth for the Review History section on the project
--    page, replacing the implicit "comments on rejection_reason" approach.
--
-- Note: a backfill into project_status_history was attempted here in an
-- earlier revision, but the table isn't present in every DB state. The
-- history backfill is a nice-to-have — the runtime code creates new
-- project_status_history rows on every transition, so the missing legacy
-- rows are not load-bearing. Skip the DO block to keep the migration
-- robust.

-- ── 1. Update the status CHECK constraint ───────────────────────────────
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'draft',
    'scoring',
    'scoring_retry',
    'under_review',
    'pending_live',  -- legacy; new code targets `under_review` instead
    'live',
    'deactivated',
    'archived',
    'paused'
  ));

-- ── 2. Backfill legacy `pending_live` rows into `under_review` ──────────
UPDATE projects
SET status = 'under_review',
    scores_visible_at = NULL
WHERE status = 'pending_live';

-- ── 3. project_reviews table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision          TEXT NOT NULL CHECK (decision IN ('APPROVE', 'RETURN')),
  comments          TEXT,
  from_status       TEXT NOT NULL,
  to_status         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_reviews_project
  ON project_reviews(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_reviews_reviewer
  ON project_reviews(reviewer_id, created_at DESC);

-- ── 4. RLS for project_reviews ─────────────────────────────────────────
ALTER TABLE project_reviews ENABLE ROW LEVEL SECURITY;

-- Project owner (the developer) and platform admins can read reviews.
DROP POLICY IF EXISTS project_reviews_read ON project_reviews;
CREATE POLICY project_reviews_read ON project_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_reviews.project_id
        AND (
          p.developer_id = public.user_org_id()
          OR public.is_platform_admin()
        )
    )
  );

-- Only the service role (server-side) writes to this table. No INSERT policy
-- for the anon/authenticated roles — the API route uses the service-role key.
