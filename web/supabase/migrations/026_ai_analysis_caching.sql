-- Migration 026: AI analysis caching via document set hash
-- Stores a hash of all document hashes so we can skip re-analysis
-- when the document set hasn't changed.

ALTER TABLE project_scores ADD COLUMN IF NOT EXISTS documents_hash TEXT;
