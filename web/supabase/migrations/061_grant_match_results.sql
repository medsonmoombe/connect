-- 061_grant_match_results.sql
-- Grant providers are scored as capital partners but stored here
-- to avoid violating the capital_match_results FK constraint.

create table if not exists grant_match_results (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  grant_provider_id   uuid not null references grant_providers(id) on delete cascade,
  compatibility_score integer not null default 0,
  score_breakdown     jsonb not null default '{}',
  status              text not null default 'active' check (status in ('active', 'inactive')),
  calculated_at       timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (project_id, grant_provider_id)
);

create index if not exists idx_grant_match_results_provider on grant_match_results(grant_provider_id);
create index if not exists idx_grant_match_results_project  on grant_match_results(project_id);
create index if not exists idx_grant_match_results_score    on grant_match_results(compatibility_score desc);

alter table grant_match_results enable row level security;

-- Grant providers see their own matches
create policy "grant_match_select_partner" on grant_match_results
  for select using (
    exists (
      select 1 from grant_providers gp
      join company_members cm on cm.company_id = gp.company_id
      where gp.id = grant_match_results.grant_provider_id
        and cm.user_id = auth.uid()
        and cm.deleted_at is null
    )
  );

-- Developers see matches on their own projects
create policy "grant_match_select_developer" on grant_match_results
  for select using (
    exists (
      select 1 from projects p
      join company_members cm on cm.company_id = p.developer_id
      where p.id = grant_match_results.project_id
        and cm.user_id = auth.uid()
        and cm.deleted_at is null
    )
  );

-- Service role has full access (matching engine)
create policy "grant_match_service_all" on grant_match_results
  for all using (auth.role() = 'service_role');
