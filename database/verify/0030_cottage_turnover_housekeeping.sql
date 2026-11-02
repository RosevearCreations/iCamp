-- Build 027 cottage turnover and housekeeping verification.
\set ON_ERROR_STOP on

begin;

insert into public.organizations (name, slug)
values ('Build 027 Verify Org', 'build027-verify-org')
returning id as b27_org_id
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'b27_org_id',
  'Build 027 Verify Camp',
  'build027-verify-camp',
  'America/Toronto'
)
returning id as b27_camp_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  'Cottage Turnover Row',
  'COTT27',
  10
)
returning id as b27_section_id
\gset

insert into icamp_private.campground_map_objects (
  organization_id,
  campground_id,
  object_kind,
  object_code,
  display_name,
  section_id
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  'cottage',
  'COTT-27',
  'Turnover Cottage 27',
  :'b27_section_id'
)
returning id as b27_map_id
\gset

insert into public.accommodations (
  organization_id,
  campground_id,
  section_id,
  map_object_id,
  accommodation_kind,
  code,
  display_name
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  :'b27_section_id',
  :'b27_map_id',
  'rental_cottage',
  'COTT-27',
  'Turnover Cottage 27'
)
returning id as b27_accommodation_id
\gset

insert into public.rental_cottages (
  accommodation_id,
  organization_id,
  campground_id,
  cottage_style,
  bedroom_count,
  bed_count,
  max_occupancy
)
values (
  :'b27_accommodation_id',
  :'b27_org_id',
  :'b27_camp_id',
  'serviced',
  2,
  3,
  6
);

insert into public.cottage_housekeeping_templates (
  organization_id,
  campground_id,
  accommodation_id,
  name,
  turnover_type,
  expected_minutes,
  linen_requirements,
  housekeeping_requirements,
  damage_inspection_required,
  security_inspection_required
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  :'b27_accommodation_id',
  'Standard departure',
  'departure',
  90,
  'Replace bedding and six towel sets.',
  'Kitchen, bathroom, floors, surfaces and garbage.',
  true,
  true
)
returning id as b27_template_id
\gset

insert into public.cottage_inventory_checklist_items (
  organization_id,
  campground_id,
  accommodation_id,
  template_id,
  item_category,
  item_name,
  required_quantity,
  unit,
  expected_condition,
  sort_order
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  :'b27_accommodation_id',
  :'b27_template_id',
  'linen',
  'Bath towel sets',
  6,
  'sets',
  'Clean, dry and guest-ready',
  10
)
returning id as b27_item_id
\gset

select availability_revision as b27_before_availability,
       status_revision as b27_before_status
from public.accommodations
where id = :'b27_accommodation_id'
\gset

insert into public.cottage_turnovers (
  organization_id,
  campground_id,
  accommodation_id,
  template_id,
  status,
  scheduled_for
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  :'b27_accommodation_id',
  :'b27_template_id',
  'scheduled',
  statement_timestamp()
)
returning id as b27_turnover_id
\gset

insert into public.cottage_turnover_item_checks (
  organization_id,
  campground_id,
  accommodation_id,
  turnover_id,
  checklist_item_id,
  item_category,
  item_name,
  required_quantity,
  unit,
  expected_condition,
  is_required
)
select
  organization_id,
  campground_id,
  accommodation_id,
  :'b27_turnover_id',
  id,
  item_category,
  item_name,
  required_quantity,
  unit,
  expected_condition,
  is_required
from public.cottage_inventory_checklist_items
where id = :'b27_item_id';

update public.cottage_turnover_item_checks
set checked = true,
    checked_at = statement_timestamp()
where turnover_id = :'b27_turnover_id';

insert into public.cottage_damage_inspections (
  organization_id,
  campground_id,
  accommodation_id,
  turnover_id,
  inspection_result,
  linen_complete,
  housekeeping_complete,
  inventory_complete,
  damage_found,
  security_issue_found
)
values (
  :'b27_org_id',
  :'b27_camp_id',
  :'b27_accommodation_id',
  :'b27_turnover_id',
  'pass',
  true,
  true,
  true,
  false,
  false
);

update public.cottage_turnovers
set status = 'ready',
    completed_at = statement_timestamp()
where id = :'b27_turnover_id';

select set_config('icamp.test.b27_org_id', :'b27_org_id', true);
select set_config('icamp.test.b27_camp_id', :'b27_camp_id', true);
select set_config('icamp.test.b27_accommodation_id', :'b27_accommodation_id', true);
select set_config('icamp.test.b27_turnover_id', :'b27_turnover_id', true);
select set_config('icamp.test.b27_before_availability', :'b27_before_availability', true);
select set_config('icamp.test.b27_before_status', :'b27_before_status', true);

do $build027_verify$
declare
  current_availability bigint;
  current_status bigint;
  invalid_template_rejected boolean := false;
  rls_count integer;
begin
  select availability_revision, status_revision
  into current_availability, current_status
  from public.accommodations
  where id = current_setting('icamp.test.b27_accommodation_id', true)::uuid;

  if current_availability <
     current_setting('icamp.test.b27_before_availability', true)::bigint + 2 then
    raise exception 'Turnover lifecycle did not advance accommodation availability revision';
  end if;

  if current_status <
     current_setting('icamp.test.b27_before_status', true)::bigint + 2 then
    raise exception 'Turnover lifecycle did not advance accommodation status revision';
  end if;

  if not exists (
    select 1
    from public.cottage_turnover_item_checks
    where turnover_id = current_setting('icamp.test.b27_turnover_id', true)::uuid
      and checked
      and item_name = 'Bath towel sets'
  ) then
    raise exception 'Turnover checklist snapshot or completion evidence is missing';
  end if;

  if not exists (
    select 1
    from public.cottage_damage_inspections
    where turnover_id = current_setting('icamp.test.b27_turnover_id', true)::uuid
      and inspection_result = 'pass'
      and linen_complete
      and housekeeping_complete
      and inventory_complete
      and not damage_found
      and not security_issue_found
  ) then
    raise exception 'Damage/security inspection evidence did not persist';
  end if;

  begin
    insert into public.cottage_housekeeping_templates (
      organization_id,
      campground_id,
      accommodation_id,
      name,
      turnover_type
    )
    values (
      current_setting('icamp.test.b27_org_id', true)::uuid,
      current_setting('icamp.test.b27_camp_id', true)::uuid,
      current_setting('icamp.test.b27_accommodation_id', true)::uuid,
      'Bad template',
      'unknown'
    );
  exception
    when check_violation then
      invalid_template_rejected := true;
  end;

  if not invalid_template_rejected then
    raise exception 'Invalid turnover type was accepted';
  end if;

  select count(*) into rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'cottage_housekeeping_templates',
      'cottage_inventory_checklist_items',
      'cottage_turnovers',
      'cottage_turnover_item_checks',
      'cottage_damage_inspections'
    )
    and c.relrowsecurity
    and c.relforcerowsecurity;

  if rls_count <> 5 then
    raise exception 'Build 027 tables must all have forced RLS';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') and (
    has_table_privilege('anon', 'public.cottage_housekeeping_templates', 'select')
    or has_table_privilege('anon', 'public.cottage_turnovers', 'select')
    or has_table_privilege('anon', 'public.cottage_damage_inspections', 'select')
  ) then
    raise exception 'anon must not directly read Build 027 housekeeping data';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') and (
    has_table_privilege('authenticated', 'public.cottage_housekeeping_templates', 'select')
    or has_table_privilege('authenticated', 'public.cottage_turnovers', 'select')
    or has_table_privilege('authenticated', 'public.cottage_damage_inspections', 'select')
  ) then
    raise exception 'authenticated must not directly read Build 027 housekeeping data';
  end if;
end
$build027_verify$;

rollback;
