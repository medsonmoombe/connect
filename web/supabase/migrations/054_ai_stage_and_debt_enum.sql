-- ============================================================
-- 054: AI-determined 8-stage taxonomy + DEBT capital structure
--
-- 1) project_stage → 8 development stages (AI-determined):
--    CONCEPT → PRE_FEASIBILITY → FULL_FEASIBILITY → REGULATORY_APPROVAL
--    → PPA_READY → FINANCIAL_CLOSE → CONSTRUCTION → OPERATION
-- 2) capital_structure_type gains DEBT (Grant stays).
-- 3) project_scores gains columns for the AI stage result.
-- ============================================================

-- ── 1) Project stage taxonomy ──────────────────────────────
-- Rename existing values to the new taxonomy (data preserved automatically).
-- These guards make the migration safe for databases that already have the
-- newer labels from a restored schema or a partially applied enum sync.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'project_stage' AND e.enumlabel = 'FEASIBILITY'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'project_stage' AND e.enumlabel = 'FULL_FEASIBILITY'
  ) THEN
    ALTER TYPE project_stage RENAME VALUE 'FEASIBILITY' TO 'FULL_FEASIBILITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'project_stage' AND e.enumlabel = 'PERMITTING'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'project_stage' AND e.enumlabel = 'REGULATORY_APPROVAL'
  ) THEN
    ALTER TYPE project_stage RENAME VALUE 'PERMITTING' TO 'REGULATORY_APPROVAL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'project_stage' AND e.enumlabel = 'OPERATIONS'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'project_stage' AND e.enumlabel = 'OPERATION'
  ) THEN
    ALTER TYPE project_stage RENAME VALUE 'OPERATIONS' TO 'OPERATION';
  END IF;
END $$;
-- Add the genuinely new stages.
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'PRE_FEASIBILITY';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'PPA_READY';

-- New projects start at Concept; the AI sets the real stage during analysis.
ALTER TABLE projects ALTER COLUMN project_stage SET DEFAULT 'CONCEPT';

-- ── 2) Capital structure: Debt (Grant stays) ───────────────
ALTER TYPE capital_structure_type ADD VALUE IF NOT EXISTS 'DEBT';

-- ── 3) project_scores: AI stage result ─────────────────────
ALTER TABLE project_scores ADD COLUMN IF NOT EXISTS determined_stage TEXT;
ALTER TABLE project_scores ADD COLUMN IF NOT EXISTS stage_rationale TEXT;

