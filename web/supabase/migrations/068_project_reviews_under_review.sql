-- Migration 068: Add UNDER_REVIEW to project_reviews decision CHECK constraint
--
-- The decision route inserts 'UNDER_REVIEW' when a reviewer places a project
-- under review. The original CHECK in 067 only allowed 'APPROVE' | 'RETURN',
-- causing silent insert failures and an empty review history.

ALTER TABLE project_reviews
  DROP CONSTRAINT IF EXISTS project_reviews_decision_check;

ALTER TABLE project_reviews
  ADD CONSTRAINT project_reviews_decision_check
  CHECK (decision IN ('APPROVE', 'RETURN', 'UNDER_REVIEW'));
