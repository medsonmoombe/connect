-- Migration 078: sync projects.project_stage with the AI-determined stage
--
-- WHY:
--   The evidence-engine (SCORING_V2) analysis persisted its stage to
--   project_scores.determined_stage but never wrote it back to the project's own
--   `project_stage` column. Every surface that reads that column -- the project
--   details stepper, the spec/sidebar rows, the marketplaces and the matching
--   engine -- kept showing the creation-time default (CONCEPT) while the AI
--   insights panel showed the stage the AI actually determined (e.g.
--   REGULATORY_APPROVAL).
--
--   `project_stage` is an AI-owned system field (lib/project-edit-policy.ts
--   SYSTEM_FIELDS) that developers can never PATCH, so the determined stage is
--   authoritative everywhere. The write path is fixed in the orchestrator; this
--   backfills every scored project so the stored stage matches the determined one.

update projects p
set project_stage = s.determined_stage::project_stage
from project_scores s
where s.project_id = p.id
  and s.determined_stage is not null
  and s.determined_stage in (
    'CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY', 'REGULATORY_APPROVAL',
    'PPA_READY', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATION'
  )
  and p.project_stage is distinct from s.determined_stage::project_stage;
