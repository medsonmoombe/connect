-- 063_power_trader_match_results.sql

alter type counterparty_type add value if not exists 'POWER_TRADER';

-- Persist scored Power Trader / offtaker matches.

create table if not exists power_trader_match_results (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  power_trader_id     uuid not null references power_traders(id) on delete cascade,
  compatibility_score integer not null default 0,
  score_breakdown     jsonb not null default '{}',
  status              text not null default 'active' check (status in ('active', 'inactive')),
  calculated_at       timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (project_id, power_trader_id)
);

create index if not exists idx_power_trader_match_results_trader
  on power_trader_match_results(power_trader_id);
create index if not exists idx_power_trader_match_results_project
  on power_trader_match_results(project_id);
create index if not exists idx_power_trader_match_results_score
  on power_trader_match_results(compatibility_score desc);
create index if not exists idx_power_trader_match_results_status
  on power_trader_match_results(status);

alter table power_trader_match_results enable row level security;

create policy "power_trader_match_select_partner" on power_trader_match_results
  for select using (
    exists (
      select 1 from power_traders pt
      join company_members cm on cm.company_id = pt.company_id
      where pt.id = power_trader_match_results.power_trader_id
        and cm.user_id = auth.uid()
        and cm.deleted_at is null
    )
  );

create policy "power_trader_match_select_developer" on power_trader_match_results
  for select using (
    exists (
      select 1 from projects p
      join company_members cm on cm.company_id = p.developer_id
      where p.id = power_trader_match_results.project_id
        and cm.user_id = auth.uid()
        and cm.deleted_at is null
    )
  );

create policy "power_trader_match_service_all" on power_trader_match_results
  for all using (auth.role() = 'service_role');


