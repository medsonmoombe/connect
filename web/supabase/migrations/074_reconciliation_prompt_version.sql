-- 074: Reconciliation prompt version bump.
--
-- The evidence-extraction prompt now requests per-document project identity
-- (project_identity) and a belonging verdict (relevance.belongs_to_project /
-- contradicts_project), which the orchestrator mechanically enforces when
-- scoring (see lib/ai/reconciliation.ts). Cached extractions produced under
-- the previous prompt carry no reconciliation fields; reusing them would make
-- the gate see "no identity signals" and exclude everything, or worse, trust
-- documents it never checked.
--
-- The cache key includes prompt_version, so bumping it invalidates all prior
-- cached extractions and forces a fresh, reconciliation-aware analysis.

update ai_provider_config
set prompt_version = 2
where prompt_version < 2;
