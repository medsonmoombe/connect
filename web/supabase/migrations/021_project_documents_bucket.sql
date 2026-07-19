-- Migration 021: Define project-documents bucket as private with RLS
-- Replaces any hand-configured state. No public document URLs ever.

-- Create the bucket if it doesn't exist (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false, -- private bucket: no public URLs
  20971520, -- 20MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520;

-- Drop any existing policies on this bucket
DROP POLICY IF EXISTS "project_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "project_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_documents_delete" ON storage.objects;

-- Only service_role (used by the API routes via supabase-admin) can read/write.
-- All access is mediated through the API — no direct client storage access.
CREATE POLICY "project_documents_select"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'project-documents');

CREATE POLICY "project_documents_insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'project-documents');

CREATE POLICY "project_documents_delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'project-documents');
