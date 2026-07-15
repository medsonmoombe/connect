-- Migration 020: Add pending_internal_review and returned to project status
-- These are first-class statuses replacing the draft+rejection_reason hack.

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'draft',
    'pending_internal_review',
    'returned',
    'submitted',
    'under_review',
    'validated',
    'rejected',
    'archived'
  ));
