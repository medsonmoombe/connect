-- Migration 050: Performance indexes for hot-path queries
-- Addresses the highest-impact missing indexes identified in the scale audit.

-- ── Soft-delete partial indexes (most queries filter deleted_at IS NULL) ──────
CREATE INDEX IF NOT EXISTS idx_projects_not_deleted
  ON projects (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_not_deleted
  ON companies (id) WHERE deleted_at IS NULL;

-- ── Foreign key indexes (queried in 15+ route files) ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id
  ON project_documents (project_id);

CREATE INDEX IF NOT EXISTS idx_company_members_company_id
  ON company_members (company_id);

CREATE INDEX IF NOT EXISTS idx_engagement_documents_engagement_id
  ON engagement_documents (engagement_id);

CREATE INDEX IF NOT EXISTS idx_engagement_states_engagement_id
  ON engagement_states (engagement_id);

-- ── Status/filter indexes (frequently filtered columns) ───────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_status
  ON companies (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_engagements_status
  ON engagements (status);

CREATE INDEX IF NOT EXISTS idx_companies_is_platform_org
  ON companies (is_platform_org) WHERE is_platform_org = true;

-- ── Audit log indexes (analytics + engagement preconditions) ──────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
  ON audit_logs (action_type) WHERE action_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_access_logs_action
  ON document_access_logs (action, created_at DESC);

-- ── Message indexes (unread count + chat history) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON messages (sender_id) WHERE deleted_at IS NULL;
