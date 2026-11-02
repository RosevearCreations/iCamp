-- iCamp Build 046 verification.

do $verify_build046$
declare
  forced boolean;
begin
  if to_regclass('public.campground_overflow_areas') is null then
    raise exception 'Build 046 overflow areas table missing';
  end if;
  if to_regclass('public.campground_overflow_area_members') is null then
    raise exception 'Build 046 overflow area members table missing';
  end if;
  if to_regclass('public.reservation_office_intake') is null then
    raise exception 'Build 046 reservation office intake table missing';
  end if;

  select relforcerowsecurity
  into forced
  from pg_class
  where oid = 'public.campground_overflow_areas'::regclass;
  if forced is not true then
    raise exception 'Build 046 overflow areas must FORCE RLS';
  end if;

  select relforcerowsecurity
  into forced
  from pg_class
  where oid = 'public.campground_overflow_area_members'::regclass;
  if forced is not true then
    raise exception 'Build 046 overflow area members must FORCE RLS';
  end if;

  select relforcerowsecurity
  into forced
  from pg_class
  where oid = 'public.reservation_office_intake'::regclass;
  if forced is not true then
    raise exception 'Build 046 office intake must FORCE RLS';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.reservation_office_intake'::regclass
      and tgname = 'reservation_office_intake_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 046 office intake append-only trigger missing';
  end if;

  if has_table_privilege('icamp_app', 'public.reservation_office_intake', 'UPDATE')
     or has_table_privilege('icamp_app', 'public.reservation_office_intake', 'DELETE') then
    raise exception 'Build 046 office intake must remain append-only';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') and (
    has_table_privilege('anon', 'public.campground_overflow_areas', 'SELECT')
    or has_table_privilege('anon', 'public.campground_overflow_area_members', 'SELECT')
    or has_table_privilege('anon', 'public.reservation_office_intake', 'SELECT')
  ) then
    raise exception 'Build 046 direct anon access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') and (
    has_table_privilege('authenticated', 'public.campground_overflow_areas', 'SELECT')
    or has_table_privilege('authenticated', 'public.campground_overflow_area_members', 'SELECT')
    or has_table_privilege('authenticated', 'public.reservation_office_intake', 'SELECT')
  ) then
    raise exception 'Build 046 direct authenticated access must remain denied';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'campground_overflow_area_members_accommodation_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'reservation_office_intake_scope_idx'
  ) then
    raise exception 'Build 046 foreign-key/read indexes are incomplete';
  end if;
end
$verify_build046$;
