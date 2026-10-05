-- Migration 051: Cross-platform fundamentals
-- 1. last_active_at on user_profiles
-- 2. Document versioning columns on project_documents
-- 3. Notification channel preferences (email vs in-app)

-- ── 1. Activity tracking ──────────────────────────────────────────────────────
ALTER TABLE user_profiles ADD COLUMN last_active_at TIMESTAMPTZ;

-- ── 2. Document versioning ────────────────────────────────────────────────────
ALTER TABLE project_documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE project_documents ADD COLUMN replaced_by UUID REFERENCES project_documents(id);
ALTER TABLE project_documents ADD COLUMN replaced_at TIMESTAMPTZ;

-- Index for version history lookups
CREATE INDEX IF NOT EXISTS idx_project_documents_replaced_by
  ON project_documents (replaced_by) WHERE replaced_by IS NOT NULL;
