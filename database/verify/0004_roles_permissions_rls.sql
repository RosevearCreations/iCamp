-- Build 005 authorization and RLS verification.
\set ON_ERROR_STOP on

do $$
declare
  permission_count integer;
  template_count integer;
begin
  select count(*) into permission_count
  from icamp_private.permission_catalog;

  if permission_count < 80 then
    raise exception 'Expected at least 80 permissions, found %', permission_count;
  end if;

  select count(*) into template_count
  from icamp_private.roles
  where role_kind = 'template'
    and lifecycle_state = 'active';

  if template_count < 9 then
    raise exception 'Expected at least 9 active role templates, found %', template_count;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'icamp_app') then
    raise exception 'Missing icamp_app RLS application role';
  end if;
end
$$;

insert into public.organizations (name, slug)
values ('Authorization Org A', 'authz-org-a')
returning id as authz_org_a
\gset

insert into public.organizations (name, slug)
values ('Authorization Org B', 'authz-org-b')
returning id as authz_org_b
\gset

insert into public.campgrounds (
  organization_id,
  name,
  slug,
  timezone
)
values (
  :'authz_org_a',
  'Authorization Camp A',
  'authz-camp-a',
  'America/Toronto'
)
returning id as authz_camp_a
\gset

insert into public.campgrounds (
  organization_id,
  name,
  slug,
  timezone
)
values (
  :'authz_org_b',
  'Authorization Camp B',
  'authz-camp-b',
  'America/Toronto'
)
returning id as authz_camp_b
\gset

insert into icamp_private.user_accounts (
  email_normalized,
  account_type
)
values ('authz-front@example.test', 'staff')
returning id as authz_front_user
\gset

insert into icamp_private.user_accounts (
  email_normalized,
  account_type
)
values ('authz-owner@example.test', 'staff')
returning id as authz_owner_user
\gset

insert into icamp_private.user_accounts (
  email_normalized,
  account_type
)
values ('authz-none@example.test', 'staff')
returning id as authz_none_user
\gset

insert into icamp_private.campground_assignments (
  user_id,
  organization_id,
  campground_id
)
values (
  :'authz_front_user',
  :'authz_org_a',
  :'authz_camp_a'
)
returning id as authz_front_assignment
\gset

insert into icamp_private.campground_assignments (
  user_id,
  organization_id,
  campground_id
)
values (
  :'authz_owner_user',
  :'authz_org_a',
  :'authz_camp_a'
)
returning id as authz_owner_assignment
\gset

insert into icamp_private.campground_assignment_roles (
  assignment_id,
  role_id
)
select :'authz_front_assignment', id
from icamp_private.roles
where role_kind = 'template'
  and role_code = 'front_desk';

insert into icamp_private.campground_assignment_roles (
  assignment_id,
  role_id
)
select :'authz_owner_assignment', id
from icamp_private.roles
where role_kind = 'template'
  and role_code = 'owner_admin';

insert into icamp_private.roles (
  organization_id,
  role_code,
  display_name,
  description,
  role_kind
)
values (
  :'authz_org_a',
  'custom_reports',
  'Custom Reports',
  'Verification custom role.',
  'custom'
)
returning id as authz_custom_role
\gset

insert into icamp_private.role_permissions (
  role_id,
  permission_key
)
values (
  :'authz_custom_role',
  'reports.read'
);

do $$
declare
  foreign_role uuid;
begin
  insert into icamp_private.roles (
    organization_id,
    role_code,
    display_name,
    description,
    role_kind
  )
  values (
    :'authz_org_b',
    'foreign_custom',
    'Foreign Custom',
    'Must not cross organization boundaries.',
    'custom'
  )
  returning id into foreign_role;

  begin
    insert into icamp_private.campground_assignment_roles (
      assignment_id,
      role_id
    )
    values (
      :'authz_front_assignment',
      foreign_role
    );

    raise exception 'Expected custom role cross-organization rejection';
  exception
    when check_violation then
      null;
  end;
end
$$;

select set_config('icamp.user_id', :'authz_front_user', false);
set role icamp_app;

select (count(*) = 1) as front_visible_campground_ok
from public.campgrounds
\gset

\if :front_visible_campground_ok
\else
  \quit 1
\endif

with changed as (
  update public.campgrounds
  set name = 'Front Desk Must Not Change This'
  where id = :'authz_camp_a'
  returning 1
)
select (count(*) = 0) as front_update_denied_ok
from changed
\gset

\if :front_update_denied_ok
\else
  \quit 1
\endif

reset role;

select set_config('icamp.user_id', :'authz_owner_user', false);
set role icamp_app;

with changed as (
  update public.campgrounds
  set name = 'Authorization Camp A Updated'
  where id = :'authz_camp_a'
  returning 1
)
select (count(*) = 1) as owner_update_allowed_ok
from changed
\gset

\if :owner_update_allowed_ok
\else
  \quit 1
\endif

with changed as (
  update public.campgrounds
  set name = 'Owner Must Not Change Camp B'
  where id = :'authz_camp_b'
  returning 1
)
select (count(*) = 0) as cross_property_update_denied_ok
from changed
\gset

\if :cross_property_update_denied_ok
\else
  \quit 1
\endif

reset role;

select set_config('icamp.user_id', :'authz_none_user', false);
set role icamp_app;

select (count(*) = 0) as unassigned_sees_nothing_ok
from public.campgrounds
\gset

\if :unassigned_sees_nothing_ok
\else
  \quit 1
\endif

reset role;
reset icamp.user_id;
