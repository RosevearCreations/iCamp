-- iCamp Build 032 verification.
do $verify$
declare
  rules_rls boolean;
  rules_force boolean;
  periods_rls boolean;
  periods_force boolean;
begin
  if to_regclass('public.campground_booking_rules') is null then
    raise exception 'campground_booking_rules table is missing';
  end if;
  if to_regclass('public.booking_calendar_periods') is null then
    raise exception 'booking_calendar_periods table is missing';
  end if;

  select relrowsecurity, relforcerowsecurity
    into rules_rls, rules_force
  from pg_class
  where oid = 'public.campground_booking_rules'::regclass;

  select relrowsecurity, relforcerowsecurity
    into periods_rls, periods_force
  from pg_class
  where oid = 'public.booking_calendar_periods'::regclass;

  if not rules_rls or not rules_force then
    raise exception 'campground_booking_rules must enable and force RLS';
  end if;
  if not periods_rls or not periods_force then
    raise exception 'booking_calendar_periods must enable and force RLS';
  end if;

  if has_table_privilege('icamp_app', 'public.campground_booking_rules', 'DELETE') then
    raise exception 'campground_booking_rules must not be deletable by icamp_app';
  end if;
  if has_table_privilege('icamp_app', 'public.booking_calendar_periods', 'DELETE') then
    raise exception 'booking_calendar_periods must not be deletable by icamp_app';
  end if;

  if to_regclass('public.campground_booking_rules_scope_fk_idx') is null
    or to_regclass('public.campground_booking_rules_updated_by_fk_idx') is null
    or to_regclass('public.booking_calendar_periods_scope_idx') is null
    or to_regclass('public.booking_calendar_periods_created_by_fk_idx') is null
    or to_regclass('public.booking_calendar_periods_updated_by_fk_idx') is null
  then
    raise exception 'Build 032 foreign-key/query indexes are incomplete';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.booking_calendar_periods'::regclass
      and tgname = 'booking_calendar_periods_no_overlapping_seasons'
      and not tgisinternal
  ) then
    raise exception 'booking season overlap trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.booking_calendar_periods'::regclass
      and tgname = 'booking_calendar_periods_guard_mutation'
      and not tgisinternal
  ) then
    raise exception 'booking calendar append-preservation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campground_booking_rules'
      and policyname = 'campground_booking_rules_read'
  ) then
    raise exception 'booking rules read policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_calendar_periods'
      and policyname = 'booking_calendar_periods_read'
  ) then
    raise exception 'booking calendar read policy is missing';
  end if;
end
$verify$;
