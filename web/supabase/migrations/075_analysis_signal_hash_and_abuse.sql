-- Migration 075: analysis signal hash + anti-abuse cooldown + matching run log
--
-- WHY:
--   1. The AI readiness cache was keyed only on the document set, so editing
--      score-relevant form fields (approvals, PPA/grid status, land) without
--      changing a file served a STALE score forever. `analysis_signal_hash`
--      covers the document set AND the score-relevant form fields, so any real
--      change invalidates the cache.
--   2. A blanket 24h re-analysis cap blocked genuine updates without stopping a
--      user from re-running analysis by editing in a loop. The guard uses
--      `last_actual_analysis_at` + an exact-revert cache instead.
--   3. Matching recompute triggers were scattered; `matching_run_log` makes the
--      runs (and failures) observable.

-- 1. Analysis signal hash (documents + score-relevant form fields)
alter table project_scores
  add column if not exists analysis_signal_hash text;

comment on column project_scores.analysis_signal_hash is
  'sha256 of the analysed document set plus the score-relevant project form fields. A change to either invalidates the cached readiness score and requires a fresh AI analysis; an exact revert resolves to this cached hash at zero AI cost.';

-- 2. Project-level analysis state
alter table projects
  add column if not exists analysis_dirty boolean not null default false;

alter table projects
  add column if not exists last_actual_analysis_at timestamptz;

comment on column projects.analysis_dirty is
  'True when project documents/content changed after the last analysis, so a stored score must not be presented as current.';
comment on column projects.last_actual_analysis_at is
  'Timestamp of the last genuine (non-cached) AI analysis. Used to enforce the anti-abuse cooldown between real runs.';

-- 3. Matching run log (observability for the centralised trigger)
create table if not exists matching_run_log (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('project', 'partner', 'all')),
  status text not null check (status in ('started', 'success', 'error')),
  project_id uuid,
  scope_ref text,
  triggered_by text,
  error text,
  matched_projects integer not null default 0,
  capital_matches integer not null default 0,
  technical_matches integer not null default 0,
  consultant_matches integer not null default 0,
  trader_matches integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_matching_run_log_created_at on matching_run_log (created_at desc);
create index if not exists idx_matching_run_log_project on matching_run_log (project_id);

comment on table matching_run_log is
  'One row per matching-engine invocation (started/success/error) written by /api/matching/run via lib/matching-trigger.ts.';
