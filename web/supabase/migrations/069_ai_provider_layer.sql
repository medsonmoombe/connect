-- ─────────────────────────────────────────────────────────────────────────────
-- 069_ai_provider_layer.sql
-- Multi-provider AI layer: config, model catalog, cache, usage logs,
-- evidence store, versioned analyses, async job queue, and spend views.
-- ─────────────────────────────────────────────────────────────────────────────

-- Active provider (singleton row, id=1 enforced by CHECK)
create table if not exists ai_provider_config (
  id int primary key default 1 check (id = 1),
  active_provider text not null default 'gemini'
    check (active_provider in ('mistral','gemini','deepseek')),
  active_model text not null default 'gemini-2.0-flash-lite',
  prompt_version int not null default 1,
  confidence_threshold numeric(3,2) not null default 0.70,
  max_chars_per_doc int not null default 48000,
  platform_monthly_budget_usd numeric(10,2) not null default 200.00,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into ai_provider_config (id) values (1) on conflict (id) do nothing;

-- Model catalog: prices live in DB so cost math is always current
create table if not exists ai_model_catalog (
  provider text not null,
  model text not null,
  label text not null,
  input_per_1m numeric(10,4) not null,
  output_per_1m numeric(10,4) not null,
  supports_vision boolean not null default false,
  enabled boolean not null default true,
  primary key (provider, model)
);

-- Seed the catalog with known models (update prices from provider dashboards)
insert into ai_model_catalog (provider, model, label, input_per_1m, output_per_1m, supports_vision, enabled) values
  ('gemini',   'gemini-2.0-flash-lite', 'Gemini Flash-Lite', 0.075, 0.30, true,  true),
  ('gemini',   'gemini-2.0-flash',      'Gemini Flash',      0.10,  0.40, true,  true),
  ('mistral',  'mistral-small-latest',  'Mistral Small',     0.15,  0.60, true,  true),
  ('deepseek', 'deepseek-chat',         'DeepSeek V4 Flash', 0.14,  0.28, false, false)
on conflict (provider, model) do nothing;

-- Analysis cache: same doc + provider + model + prompt_version = reuse, zero cost
create table if not exists ai_analysis_cache (
  content_hash text not null,
  provider text not null,
  model text not null,
  prompt_version int not null,
  result jsonb not null,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now(),
  primary key (content_hash, provider, model, prompt_version)
);

-- Every AI call, priced
create table if not exists ai_usage_logs (
  id bigint generated always as identity primary key,
  project_id uuid,
  user_id uuid,
  document_id uuid,
  provider text not null,
  model text not null,
  request_type text not null,
  status text not null default 'ok',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost numeric(10,6) not null default 0,
  latency_ms int,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_logs_project_created on ai_usage_logs (project_id, created_at);
create index if not exists ai_usage_logs_created on ai_usage_logs (created_at);

-- Evidence extracted by AI (audit trail: which model asserted what)
create table if not exists ai_evidence (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  analysis_id bigint,
  document_id uuid,
  evidence_key text not null,
  value jsonb not null,
  confidence numeric(3,2) not null,
  source text not null default 'document',
  excerpt text,
  provider text,
  model text,
  prompt_version int,
  created_at timestamptz not null default now()
);
create index if not exists ai_evidence_project on ai_evidence (project_id);

-- Versioned analysis snapshots
create table if not exists ai_analyses (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version int not null,
  scoring_version int not null,
  score int not null,
  stage int not null,
  pillars jsonb not null,
  gaps jsonb not null,
  risk_flags jsonb not null,
  docs_analyzed int not null default 0,
  docs_skipped int not null default 0,
  total_cost numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

-- Async processing queue
create table if not exists ai_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  requested_by uuid,
  request_type text not null default 'full_analysis',
  status text not null default 'queued'
    check (status in ('queued','running','done','error')),
  attempts int not null default 0,
  worker_id text,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_jobs_one_active_per_project
  on ai_jobs (project_id) where status in ('queued','running');

-- Atomic claim for workers (safe with multiple workers / cron overlap)
create or replace function claim_ai_jobs(p_worker text, p_limit int default 3)
returns setof ai_jobs language sql as $$
  with picked as (
    select id from ai_jobs
    where status = 'queued'
       or (status = 'running' and started_at < now() - interval '10 minutes')
    order by created_at
    for update skip locked
    limit p_limit
  )
  update ai_jobs j
    set status = 'running', worker_id = p_worker, started_at = now(), attempts = attempts + 1
  from picked where j.id = picked.id
  returning j.*;
$$;

-- Automatic retry of scoring_retry projects (max 3 total attempts)
create or replace function enqueue_scoring_retries(p_max_attempts int default 3)
returns int language plpgsql as $$
declare inserted int;
begin
  with candidates as (
    select p.id as project_id,
           (select count(*) from ai_jobs j where j.project_id = p.id) as prior_attempts
    from projects p
    where p.status = 'scoring_retry'
      and not exists (
        select 1 from ai_jobs j
        where j.project_id = p.id and j.status in ('queued','running')
      )
  ), picked as (
    select * from candidates where prior_attempts < p_max_attempts
  ), ins as (
    insert into ai_jobs (project_id, request_type)
    select project_id, 'full_analysis' from picked
    returning 1
  )
  select count(*) into inserted from ins;
  return inserted;
end $$;

-- Admin spend views
create or replace view ai_spend_monthly as
select
  date_trunc('month', created_at) as month,
  provider,
  count(*) as requests,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(estimated_cost) as cost_usd
from ai_usage_logs
group by 1, 2;

create or replace view ai_top_projects_monthly as
select
  date_trunc('month', created_at) as month,
  project_id,
  count(*) as requests,
  sum(estimated_cost) as cost_usd,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens
from ai_usage_logs
group by 1, 2;

-- RLS: all writes via service-role API routes only
alter table ai_provider_config enable row level security;
alter table ai_model_catalog   enable row level security;
alter table ai_usage_logs      enable row level security;
alter table ai_evidence        enable row level security;
alter table ai_analyses        enable row level security;
alter table ai_jobs            enable row level security;
alter table ai_analysis_cache  enable row level security;

-- Platform admins can read config + usage
create policy admin_read_ai_config on ai_provider_config
  for select using (
    exists (
      select 1 from company_members cm
      join companies c on c.id = cm.company_id
      where cm.user_id = auth.uid()
        and c.is_platform_org = true
        and cm.deleted_at is null
    )
  );

create policy admin_read_ai_usage on ai_usage_logs
  for select using (
    exists (
      select 1 from company_members cm
      join companies c on c.id = cm.company_id
      where cm.user_id = auth.uid()
        and c.is_platform_org = true
        and cm.deleted_at is null
    )
  );

create policy admin_read_ai_catalog on ai_model_catalog
  for select using (
    exists (
      select 1 from company_members cm
      join companies c on c.id = cm.company_id
      where cm.user_id = auth.uid()
        and c.is_platform_org = true
        and cm.deleted_at is null
    )
  );

-- Project owners can read their own evidence + analyses
create policy owner_read_evidence on ai_evidence
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_id
        and p.developer_id in (
          select company_id from company_members
          where user_id = auth.uid() and deleted_at is null
        )
    )
  );

create policy owner_read_analyses on ai_analyses
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_id
        and p.developer_id in (
          select company_id from company_members
          where user_id = auth.uid() and deleted_at is null
        )
    )
  );

-- Update storage bucket file size limit to 50MB
update storage.buckets
set file_size_limit = 52428800
where id = 'project-documents';
