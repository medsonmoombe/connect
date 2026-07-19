-- Migration 025: Document hash deduplication
-- Adds file_hash column to detect and block duplicate file uploads.

ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Index for fast duplicate lookups (only non-deleted docs)
CREATE INDEX IF NOT EXISTS idx_project_documents_hash
  ON project_documents (project_id, file_hash)
  WHERE deleted_at IS NULL AND file_hash IS NOT NULL;
