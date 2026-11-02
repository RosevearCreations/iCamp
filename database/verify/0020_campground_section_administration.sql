-- Build 017 campground hierarchy administration verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 017 Verify Org', 'build017-verify-org')
returning id as b17_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b17_org_id',
  'Build 017 Verify Camp',
  'build017-verify-camp',
  'America/Toronto'
)
returning id as b17_camp_id
\gset

insert into icamp_private.user_accounts (email_normalized, account_type)
values ('build017-manager@example.test', 'staff')
returning id as b17_manager_id
\gset

insert into icamp_private.user_accounts (email_normalized, account_type)
values ('build017-frontdesk@example.test', 'staff')
returning id as b17_front_id
\gset

insert into icamp_private.campground_assignments (
  user_id,
  organization_id,
  campground_id
)
values (
  :'b17_manager_id',
  :'b17_org_id',
  :'b17_camp_id'
)
returning id as b17_manager_assignment
\gset

insert into icamp_private.campground_assignments (
  user_id,
  organization_id,
  campground_id
)
values (
  :'b17_front_id',
  :'b17_org_id',
  :'b17_camp_id'
)
returning id as b17_front_assignment
\gset

insert into icamp_private.campground_assignment_roles (assignment_id, role_id)
select :'b17_manager_assignment', id
from icamp_private.roles
where role_kind = 'template'
  and role_code = 'campground_manager';

insert into icamp_private.campground_assignment_roles (assignment_id, role_id)
select :'b17_front_assignment', id
from icamp_private.roles
where role_kind = 'template'
  and role_code = 'front_desk';

set local role icamp_app;
select set_config('icamp.user_id', :'b17_manager_id', true);

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order,
  settings
)
values (
  :'b17_org_id',
  :'b17_camp_id',
  'Verify North',
  'VERIFY-NORTH',
  20,
  '{"operatingMode":"quiet","quietHoursStart":"22:00","quietHoursEnd":"07:00","staffNote":"Synthetic verification only."}'::jsonb
)
returning id as b17_section_id
\gset

insert into public.campground_subsections (
  organization_id,
  campground_id,
  section_id,
  name,
  code,
  sort_order
)
values (
  :'b17_org_id',
  :'b17_camp_id',
  :'b17_section_id',
  'Verify North A',
  'VERIFY-NORTH-A',
  10
);

update public.campground_sections
set sort_order = 5,
    lifecycle_state = 'inactive'
where id = :'b17_section_id';

select set_config('icamp.test.section_id', :'b17_section_id', true);

do $build017$
declare
  row_data record;
begin
  select
    settings ->> 'operatingMode' as section_mode,
    sort_order,
    lifecycle_state,
    row_version
  into row_data
  from public.campground_sections
  where id = current_setting('icamp.test.section_id')::uuid;

  if row_data.section_mode <> 'quiet' then
    raise exception 'Expected quiet operating mode, found %', row_data.section_mode;
  end if;
  if row_data.sort_order <> 5 then
    raise exception 'Expected section sort order 5, found %', row_data.sort_order;
  end if;
  if row_data.lifecycle_state <> 'inactive' then
    raise exception 'Expected inactive lifecycle state, found %', row_data.lifecycle_state;
  end if;
  if row_data.row_version < 2 then
    raise exception 'Expected row-version increment, found %', row_data.row_version;
  end if;
end
$build017$;

reset role;
set local role icamp_app;
select set_config('icamp.user_id', :'b17_front_id', true);
select set_config('icamp.test.org_id', :'b17_org_id', true);
select set_config('icamp.test.camp_id', :'b17_camp_id', true);

do $build017_denied$
begin
  begin
    insert into public.campground_sections (
      organization_id,
      campground_id,
      name,
      code,
      sort_order
    )
    values (
      current_setting('icamp.test.org_id')::uuid,
      current_setting('icamp.test.camp_id')::uuid,
      'Denied',
      'DENIED',
      99
    );
    raise exception 'Front desk unexpectedly created a section';
  exception
    when insufficient_privilege then
      null;
  end;
end
$build017_denied$;

reset role;
rollback;
