-- ============================================================
-- Migration: Sync all enum types to match the canonical schema
-- Run this if you get "invalid input value for enum" errors.
-- Safe to re-run (uses IF NOT EXISTS where supported, or
-- catches errors for enum values that already exist).
-- ============================================================

-- ── project_stage ────────────────────────────────────────────
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'CONCEPT';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'FEASIBILITY';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'PERMITTING';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'FINANCIAL_CLOSE';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'CONSTRUCTION';
ALTER TYPE project_stage ADD VALUE IF NOT EXISTS 'OPERATIONS';

-- ── engagement_status ────────────────────────────────────────
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'INTRO_SENT';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'INTRO_ACCEPTED';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'NDA_SIGNED';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'DUE_DILIGENCE';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'TERM_SHEET';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'CONTRACT_SIGNED';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'CAPITAL_COMMITTED';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'DROPPED';

-- ── user_role ────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DEVELOPER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CAPITAL_PARTNER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'TECHNICAL_PARTNER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'POWER_TRADER';

-- ── company_type ─────────────────────────────────────────────
ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'DEVELOPER';
ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'CAPITAL';
ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'TECHNICAL';
ALTER TYPE company_type ADD VALUE IF NOT EXISTS 'POWER_TRADER';

-- ── capital_structure_type ───────────────────────────────────
ALTER TYPE capital_structure_type ADD VALUE IF NOT EXISTS 'EQUITY';
ALTER TYPE capital_structure_type ADD VALUE IF NOT EXISTS 'PROFIT_SHARING';
ALTER TYPE capital_structure_type ADD VALUE IF NOT EXISTS 'LEASING';
ALTER TYPE capital_structure_type ADD VALUE IF NOT EXISTS 'GRANT';

-- ── risk_tolerance ───────────────────────────────────────────
ALTER TYPE risk_tolerance ADD VALUE IF NOT EXISTS 'LOW';
ALTER TYPE risk_tolerance ADD VALUE IF NOT EXISTS 'MEDIUM';
ALTER TYPE risk_tolerance ADD VALUE IF NOT EXISTS 'HIGH';

-- ── governance_preference ────────────────────────────────────
ALTER TYPE governance_preference ADD VALUE IF NOT EXISTS 'PASSIVE';
ALTER TYPE governance_preference ADD VALUE IF NOT EXISTS 'BOARD_SEAT';
ALTER TYPE governance_preference ADD VALUE IF NOT EXISTS 'ACTIVE_ROLE';

-- ── counterparty_type ────────────────────────────────────────
ALTER TYPE counterparty_type ADD VALUE IF NOT EXISTS 'CAPITAL';
ALTER TYPE counterparty_type ADD VALUE IF NOT EXISTS 'TECHNICAL';

-- ── match_status ─────────────────────────────────────────────
ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'inactive';
