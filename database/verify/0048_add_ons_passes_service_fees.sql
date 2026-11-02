-- iCamp Build 040 verification.
do $verify$
declare
  force_rls boolean;
begin
  if to_regclass('public.booking_charge_catalog') is null then
    raise exception 'booking_charge_catalog table is missing';
  end if;

  select c.relforcerowsecurity
    into force_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'booking_charge_catalog';

  if force_rls is distinct from true then
    raise exception 'booking_charge_catalog must FORCE RLS';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.booking_charge_catalog',
    'DELETE'
  ) then
    raise exception 'booking_charge_catalog must not be deletable by icamp_app';
  end if;

  if not has_table_privilege(
    'icamp_app',
    'public.booking_charge_catalog',
    'SELECT'
  ) then
    raise exception 'icamp_app must be able to read booking charge catalog';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'booking_charge_catalog'
      and indexname = 'booking_charge_catalog_campground_fk_idx'
  ) then
    raise exception 'campground foreign-key index is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'booking_charge_catalog'
      and indexname = 'booking_charge_catalog_accommodation_fk_idx'
  ) then
    raise exception 'accommodation foreign-key index is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_charge_catalog'
      and policyname = 'booking_charge_catalog_read'
  ) then
    raise exception 'booking charge read policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_charge_catalog'
      and policyname = 'booking_charge_catalog_insert'
  ) then
    raise exception 'booking charge insert policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_charge_catalog'
      and policyname = 'booking_charge_catalog_update'
  ) then
    raise exception 'booking charge update policy is missing';
  end if;
end
$verify$;
