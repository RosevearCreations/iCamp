-- Build 003 migration verification.
\set ON_ERROR_STOP on

do $$
declare
  expected_tables text[] := array[
    'organizations',
    'campgrounds',
    'campground_sections',
    'campground_subsections',
    'admin_refresh_states'
  ];
  table_name text;
  rls_enabled boolean;
begin
  foreach table_name in array expected_tables loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing expected table: public.%', table_name;
    end if;

    select c.relrowsecurity
      into rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = table_name;

    if coalesce(rls_enabled, false) is not true then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;
  end loop;
end
$$;

insert into public.organizations (name, slug)
values ('iCamp CI Organization', 'icamp-ci')
returning id as organization_id
\gset

insert into public.campgrounds (
  organization_id,
  name,
  slug,
  timezone
)
values (
  :'organization_id',
  'iCamp CI Campground',
  'ci-campground',
  'America/Toronto'
)
returning id as campground_id
\gset

insert into public.campground_sections (
  organization_id,
  campground_id,
  name,
  code,
  sort_order
)
values (
  :'organization_id',
  :'campground_id',
  'North',
  'NORTH',
  1
)
returning id as section_id
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
  :'organization_id',
  :'campground_id',
  :'section_id',
  'North A',
  'NORTH-A',
  1
);

insert into public.admin_refresh_states (
  organization_id,
  campground_id,
  section_key,
  refresh_status,
  last_requested_at,
  last_started_at,
  last_succeeded_at,
  source_watermark
)
values (
  :'organization_id',
  :'campground_id',
  'management.customer-input',
  'fresh',
  statement_timestamp() - interval '2 seconds',
  statement_timestamp() - interval '1 second',
  statement_timestamp(),
  'ci-watermark-1'
);

update public.campgrounds
set name = 'iCamp CI Campground Updated'
where id = :'campground_id';

do $$
declare
  version bigint;
begin
  select row_version
    into version
  from public.campgrounds
  where slug = 'ci-campground';

  if version <> 2 then
    raise exception 'row_version trigger expected 2, found %', version;
  end if;
end
$$;

do $$
begin
  begin
    insert into public.campground_sections (
      organization_id,
      campground_id,
      name,
      code
    )
    values (
      gen_random_uuid(),
      gen_random_uuid(),
      'Invalid Cross Tenant',
      'INVALID'
    );

    raise exception 'Expected tenant boundary foreign key violation';
  exception
    when foreign_key_violation then
      null;
  end;
end
$$;
