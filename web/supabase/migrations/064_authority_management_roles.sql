-- 064_authority_management_roles.sql
-- Adds a separate authority-management organisation type for project governance.
-- Platform organisations remain technical/system owners; authority organisations
-- can review projects and view management profiles without receiving technical
-- platform-admin privileges.

alter table companies
  add column if not exists is_authority_org boolean not null default false;

create index if not exists idx_companies_is_authority_org
  on companies (is_authority_org)
  where is_authority_org = true;

comment on column companies.is_authority_org is
  'True for sector authority / management organisations that can review projects without platform technical-admin permissions.';

create or replace function public.is_management_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from company_members cm
    join companies c on c.id = cm.company_id
    where cm.user_id = auth.uid()
      and cm.deleted_at is null
      and (
        (c.is_platform_org = true and cm.role = 'ADMIN')
        or c.is_authority_org = true
        or c.primary_role = 'AUTHORITY'
      )
  );
$$;

grant execute on function public.is_management_user() to anon, authenticated, service_role;