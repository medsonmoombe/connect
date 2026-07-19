-- Migration 035: Data Room Foundation
-- Adds storage_path (used in code but never migrated), classification column,
-- and creates the document_access_logs table for audit trails.

-- 1. Add storage_path column (code references it but no migration existed)
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_project_documents_storage_path
  ON project_documents (project_id, storage_path)
  WHERE deleted_at IS NULL AND storage_path IS NOT NULL;

-- 2. Add classification column for access control
-- PUBLIC: visible to any verified user
-- RESTRICTED: visible only after Introduction is Accepted
-- CONFIDENTIAL: visible only within specific engagements
ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'RESTRICTED'
  CHECK (classification IN ('PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'));

CREATE INDEX IF NOT EXISTS idx_project_documents_classification
  ON project_documents (project_id, classification)
  WHERE deleted_at IS NULL;

-- 3. Create document_access_logs table for audit trail
CREATE TABLE IF NOT EXISTS document_access_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     TEXT NOT NULL REFERENCES users(id),
  document_id UUID NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('VIEW', 'DOWNLOAD', 'PREVIEW')),
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_access_logs_document
  ON document_access_logs (document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_access_logs_user
  ON document_access_logs (user_id, created_at DESC);

-- RLS: only service_role (API) can access
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON document_access_logs FOR ALL USING (false);
