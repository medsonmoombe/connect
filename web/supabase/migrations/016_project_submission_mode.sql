-- Migration 016: Add project submission mode and internal reviewer to companies
-- This enables org-level control over how projects are submitted

-- Add project_submission_mode column (direct or internal_review)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS project_submission_mode text NOT NULL DEFAULT 'direct'
  CHECK (project_submission_mode IN ('direct', 'internal_review'));

-- Add internal_reviewer_id column (user who can approve/reject within the org)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS internal_reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for internal_reviewer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_internal_reviewer ON companies(internal_reviewer_id) WHERE internal_reviewer_id IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN companies.project_submission_mode IS 'How projects are submitted: direct (any admin can submit) or internal_review (designated reviewer approves)';
COMMENT ON COLUMN companies.internal_reviewer_id IS 'User ID of the designated internal reviewer for draft approval (only used when project_submission_mode = internal_review)';
