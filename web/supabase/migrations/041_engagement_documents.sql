-- Migration 041: Per-engagement document sharing (PRD §E — "engagement_documents")
--
-- PRD §E lists `engagement_documents` (New) as a dedicated table for the secure
-- data room created per engagement — where participants share NDA, term-sheet,
-- and contract drafts visible ONLY to that engagement's participants. Today
-- only project-level documents exist (`project_documents`); the engagement data
-- room currently maps to project docs gated by status, with no place to upload
-- deal-specific artifacts like the NDA or signed contract.
--
-- This table stores engagement-scoped upload metadata pointing into the
-- existing `project-documents` Supabase Storage bucket, namespaced under
-- `engagements/{engagement_id}/`. A nullable FK to `project_documents` lets a
-- developer elevate an existing project doc into a specific engagement.
--
-- All statements idempotent (safe to re-run via `node migrate.mjs`).

CREATE TABLE IF NOT EXISTS engagement_documents (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id      UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  -- Optional link when an existing project document is shared into this
  -- engagement (rather than a freshly uploaded deal artifact).
  project_document_id UUID REFERENCES project_documents(id) ON DELETE SET NULL,
  -- NDA | TERM_SHEET | CONTRACT | SUPPORTING (PRD §E deal-doc classes).
  document_type      TEXT NOT NULL CHECK (document_type IN ('NDA','TERM_SHEET','CONTRACT','SUPPORTING')),
  -- Original filename for display.
  file_name           TEXT NOT NULL,
  -- Path inside the `project-documents` bucket: `engagements/{eng_id}/{...}`.
  storage_path        TEXT NOT NULL,
  -- Content-Type of the stored object.
  mime_type           TEXT,
  -- Byte size of the stored object (capped to 50MB by the API per PRD §E).
  size_bytes          BIGINT,
  uploaded_by         TEXT NOT NULL,
  classification      TEXT NOT NULL DEFAULT 'CONFIDENTIAL'
                     CHECK (classification IN ('PUBLIC','RESTRICTED','CONFIDENTIAL')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_engagement_documents_engagement
  ON engagement_documents (engagement_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_documents_type
  ON engagement_documents (engagement_id, document_type)
  WHERE deleted_at IS NULL;

-- RLS: only engagement participants (developer org or counterparty org) may
-- read; writes (upload/delete) are mediated by the API via service_role so we
-- do not grant client INSERT/DELETE. Admins (platform org) see all.
ALTER TABLE engagement_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties_read_engagement_documents" ON engagement_documents;
CREATE POLICY "parties_read_engagement_documents" ON engagement_documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND engagement_id IN (
      SELECT e.id
      FROM engagements e
      WHERE e.project_id IN (
        SELECT p.id FROM projects p
        JOIN company_members cm ON cm.company_id = p.developer_id
        WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
      )
      OR (
        e.counterparty_type = 'CAPITAL'
        AND e.counterparty_id IN (
          SELECT cp.id FROM capital_partners cp
          JOIN company_members cm ON cm.company_id = cp.company_id
          WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
        )
      )
      OR (
        e.counterparty_type = 'TECHNICAL'
        AND e.counterparty_id IN (
          SELECT tp.id FROM technical_partners tp
          JOIN company_members cm ON cm.company_id = tp.company_id
          WHERE cm.user_id = auth.uid() AND cm.deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "service_role_all_engagement_documents" ON engagement_documents;
CREATE POLICY "service_role_all_engagement_documents" ON engagement_documents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Publish to realtime so the data-room view updates live as docs are shared.
ALTER TABLE engagement_documents REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'engagement_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE engagement_documents;
  END IF;
END $$;
