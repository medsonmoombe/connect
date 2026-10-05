-- Migration 049: Developer field gaps + document type constraints
-- Aligns DB schema with AfriConnect User Guide requirements

-- ── Document type enum ────────────────────────────────────────────────────────
CREATE TYPE document_type AS ENUM (
  'FEASIBILITY_STUDY',
  'ENVIRONMENTAL_ASSESSMENT',
  'FINANCIAL_MODEL',
  'LEGAL_OPPINION',
  'TITLE_DEED',
  'PPA',
  'GRID_CONNECTION_AGREEMENT',
  'CONSTRUCTION_DRAWINGS',
  'TECHNICAL_DRAWINGS',
  'PERMIT',
  'OTHER'
);

-- ── Projects: add financial breakdown + description ────────────────────────────
ALTER TABLE projects ADD COLUMN capex NUMERIC;
ALTER TABLE projects ADD COLUMN opex NUMERIC;
ALTER TABLE projects ADD COLUMN funding_required NUMERIC;
ALTER TABLE projects ADD COLUMN description TEXT;

-- ── Companies: add registration, ownership, contact fields ─────────────────────
ALTER TABLE companies ADD COLUMN registration_number TEXT;
ALTER TABLE companies ADD COLUMN ownership_structure TEXT;
ALTER TABLE companies ADD COLUMN ownership_details TEXT;
ALTER TABLE companies ADD COLUMN contact_email TEXT;
ALTER TABLE companies ADD COLUMN contact_phone TEXT;
ALTER TABLE companies ADD COLUMN management_experience_summary TEXT;

-- ── Projects: add PPA status ──────────────────────────────────────────────────
-- project_tech_requirements is 1:1 with project, add ppa_status there
ALTER TABLE project_tech_requirements ADD COLUMN ppa_status TEXT
  CHECK (ppa_status IN ('SECURED', 'IN_PROGRESS', 'NOT_STARTED', 'NOT_APPLICABLE'));

-- ── Project documents: add classification + storage_path ───────────────────────
-- (these columns may already exist from earlier additions; add only if missing)
DO $$ BEGIN
  ALTER TABLE project_documents ADD COLUMN storage_path TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_documents ADD COLUMN file_hash TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_documents ADD COLUMN classification TEXT
    CHECK (classification IN ('PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
