-- iCamp Build 048 verification
do $$
begin
  if to_regclass('public.guest_profiles') is null then
    raise exception 'Build 048 guest_profiles missing';
  end if;
  if to_regclass('public.guest_rv_profiles') is null
    or to_regclass('public.guest_vehicle_profiles') is null
    or to_regclass('public.guest_pet_profiles') is null then
    raise exception 'Build 048 saved stay profile tables missing';
  end if;
  if to_regclass('public.guest_profile_events') is null then
    raise exception 'Build 048 guest profile evidence missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservations'
      and column_name='guest_profile_id'
  ) then
    raise exception 'Build 048 reservation guest profile linkage missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='seasonal_assignments'
      and column_name='guest_profile_id'
  ) then
    raise exception 'Build 047 seasonal assignment integration missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='guest_profile_events_append_only' and not tgisinternal
  ) then
    raise exception 'Guest profile evidence must remain append-only';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='reservations_validate_guest_profile' and not tgisinternal
  ) then
    raise exception 'Reservation/profile account consistency guard missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='guest_profiles_account_campground_uidx'
  ) then
    raise exception 'Optional-account uniqueness index missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='guest_profiles'
      and policyname='guest_profiles_read'
      and qual like '%guest.read%'
  ) then
    raise exception 'guest.read profile policy missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='guest_profiles'
      and policyname='guest_profiles_update'
      and coalesce(with_check,'') like '%guest.manage%'
  ) then
    raise exception 'guest.manage profile update policy missing';
  end if;
  if has_table_privilege('authenticated','public.guest_profiles','select') then
    raise exception 'authenticated direct guest profile access must remain denied';
  end if;
  if has_table_privilege('anon','public.guest_profiles','select') then
    raise exception 'anon direct guest profile access must remain denied';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='guest_profiles'
      and column_name='save_stay_preferences'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='guest_profiles'
      and column_name='allow_staff_profile_lookup'
  ) then
    raise exception 'Build 048 privacy controls missing';
  end if;
end
$$;
