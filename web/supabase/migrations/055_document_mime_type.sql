-- 055: Store the actual MIME type of each uploaded project document so the
-- AI analysis pipeline can read files with their real content type (PDFs and
-- images natively, Office formats via text extraction) instead of guessing.

ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Backfill mime_type for existing rows from the storage_path filename extension.
UPDATE project_documents
SET mime_type = CASE
  WHEN storage_path ILIKE '%.pdf'   THEN 'application/pdf'
  WHEN storage_path ILIKE '%.png'   THEN 'image/png'
  WHEN storage_path ILIKE '%.jpg'   THEN 'image/jpeg'
  WHEN storage_path ILIKE '%.jpeg'  THEN 'image/jpeg'
  WHEN storage_path ILIKE '%.webp'  THEN 'image/webp'
  WHEN storage_path ILIKE '%.gif'   THEN 'image/gif'
  WHEN storage_path ILIKE '%.docx'  THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  WHEN storage_path ILIKE '%.doc'   THEN 'application/msword'
  WHEN storage_path ILIKE '%.xlsx'  THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  WHEN storage_path ILIKE '%.xls'   THEN 'application/vnd.ms-excel'
  WHEN storage_path ILIKE '%.pptx'  THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  WHEN storage_path ILIKE '%.ppt'   THEN 'application/vnd.ms-powerpoint'
  WHEN storage_path ILIKE '%.csv'   THEN 'text/csv'
  ELSE NULL
END
WHERE mime_type IS NULL AND storage_path IS NOT NULL;
