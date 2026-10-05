-- 070_project_status_history.sql
-- Audit trail for every project status transition.
-- Referenced by project-state-machine.ts and orchestrator.ts.

create table if not exists project_status_history (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references projects(id) on delete cascade,
  from_status text not null,
  to_status   text not null,
  actor_id    uuid,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists project_status_history_project
  on project_status_history (project_id, created_at desc);

alter table project_status_history enable row level security;

-- Platform admins can read all history
create policy admin_read_status_history on project_status_history
  for select using (
    exists (
      select 1 from company_members cm
      join companies c on c.id = cm.company_id
      where cm.user_id = auth.uid()
        and c.is_platform_org = true
        and cm.deleted_at is null
    )
  );

-- Project owners can read their own project history
create policy owner_read_status_history on project_status_history
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
