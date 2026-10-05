-- ─────────────────────────────────────────────────────────────────────────────
--  Migration 056: Consultation Requests + Project Pause
--
--  consultation_requests — developer asks platform admins for help when their
--  project scores low.  Admins review, add notes, guide the developer, and
--  resolve the request once the project is properly documented.
--
--  projects — adds is_paused / paused_at / paused_by / pause_reason columns
--  so developers can freeze a project while they get help.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Consultation requests
CREATE TABLE IF NOT EXISTS consultation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  developer_id    UUID NOT NULL REFERENCES user_profiles(id),
  company_id      UUID REFERENCES companies(id),

  -- Request details
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_review','in_progress','resolved','cancelled')),
  request_type    TEXT NOT NULL DEFAULT 'consultant_help',
  message         TEXT NOT NULL,
  request_details JSONB DEFAULT '{}',

  -- Pause snapshot — whether the project was paused when the request was created
  project_paused  BOOLEAN DEFAULT FALSE,

  -- Admin assignment & resolution
  admin_id        UUID REFERENCES user_profiles(id),
  admin_notes     JSONB DEFAULT '[]'::JSONB,   -- [ { text, created_at, admin_id } ]
  resolution_summary TEXT,
  resolved_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Project pause columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_paused    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paused_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_by    UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_consultation_requests_project
  ON consultation_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_developer
  ON consultation_requests(developer_id);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_status
  ON consultation_requests(status);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_admin
  ON consultation_requests(admin_id)
  WHERE admin_id IS NOT NULL;

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_consultation_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consultation_requests_updated_at ON consultation_requests;
CREATE TRIGGER trg_consultation_requests_updated_at
  BEFORE UPDATE ON consultation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_requests_updated_at();

-- 5. RLS policies
ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;

-- Developers can read their own requests
CREATE POLICY "consultation_read_own" ON consultation_requests
  FOR SELECT USING (auth.uid() = developer_id);

-- Developers can create requests for their own projects
CREATE POLICY "consultation_insert_own" ON consultation_requests
  FOR INSERT WITH CHECK (
    auth.uid() = developer_id
    AND project_id IN (SELECT id FROM projects WHERE developer_id = auth.uid())
  );

-- Admins can read all requests
CREATE POLICY "consultation_admin_read" ON consultation_requests
  FOR SELECT USING (is_platform_admin());

-- Admins can update all requests
CREATE POLICY "consultation_admin_update" ON consultation_requests
  FOR UPDATE USING (is_platform_admin());

-- 6. Add paused to project status check constraint
-- (The CHECK constraint is enforced in code via project-state-machine.ts.
--  The DB constraint in migration 045 already uses the status set; adding
--  'paused' requires a new migration step.)
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'draft','scoring','scoring_retry','pending_live',
    'live','deactivated','archived','paused'
  ));
