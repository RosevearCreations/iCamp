-- Build 034 accommodation compatibility verification.
\set ON_ERROR_STOP on

begin;

do $build034_verify$
declare
  campsite_columns integer;
  cottage_columns integer;
begin
  select count(*) into campsite_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'campsites'
    and column_name in ('accessible_site', 'pets_allowed', 'max_pets');

  if campsite_columns <> 3 then
    raise exception 'Build 034 campsite compatibility columns are incomplete';
  end if;

  select count(*) into cottage_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'rental_cottages'
    and column_name in ('pets_allowed', 'max_pets');

  if cottage_columns <> 2 then
    raise exception 'Build 034 cottage compatibility columns are incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'campsites_bump_compatibility_revision'
      and not tgisinternal
  ) then
    raise exception 'Build 034 campsite compatibility revision trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'rental_cottages_bump_compatibility_revision'
      and not tgisinternal
  ) then
    raise exception 'Build 034 cottage compatibility revision trigger is missing';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
     and has_table_privilege('anon', 'public.campsites', 'select') then
    raise exception 'anon must not directly read campsite compatibility facts';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_table_privilege('authenticated', 'public.rental_cottages', 'select') then
    raise exception 'authenticated must not directly read cottage compatibility facts';
  end if;
end
$build034_verify$;

rollback;
