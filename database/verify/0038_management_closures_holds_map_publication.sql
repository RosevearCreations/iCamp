-- iCamp Build 031 verification.
do $verify$
declare
  rls_enabled boolean;
  rls_forced boolean;
  can_delete boolean;
  permission_present boolean;
  publication_table_present boolean;
begin
  select c.relrowsecurity, c.relforcerowsecurity
  into rls_enabled, rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'management_restrictions';

  if coalesce(rls_enabled, false) is not true
    or coalesce(rls_forced, false) is not true then
    raise exception 'Build 031 management restrictions must FORCE RLS';
  end if;

  select has_table_privilege('icamp_app', 'public.management_restrictions', 'DELETE')
  into can_delete;

  if coalesce(can_delete, false) then
    raise exception 'Build 031 management restrictions must not be deletable by icamp_app';
  end if;

  select exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key = 'campground.operations.manage'
  )
  into permission_present;

  if not permission_present then
    raise exception 'Build 031 operations permission is missing';
  end if;

  select to_regclass('icamp_private.campground_map_publication_events') is not null
  into publication_table_present;

  if not publication_table_present then
    raise exception 'Build 031 map publication evidence table is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.management_restrictions'::regclass
      and tgname = 'management_restrictions_no_overlap'
      and not tgisinternal
  ) then
    raise exception 'Build 031 overlap protection trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.management_restrictions'::regclass
      and tgname = 'management_restrictions_guard_mutation'
      and not tgisinternal
  ) then
    raise exception 'Build 031 append/cancel mutation guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
      'icamp_private.campground_map_publication_events'::regclass
      and tgname = 'campground_map_publication_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 031 map publication evidence must be append-only';
  end if;
end
$verify$;
