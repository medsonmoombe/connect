-- ── Bookmarks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_bookmarks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user    ON project_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_project ON project_bookmarks(project_id);

ALTER TABLE project_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON project_bookmarks FOR ALL USING (true);

-- ── NDA tracking on engagements ───────────────────────────────────────────────
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMPTZ;
