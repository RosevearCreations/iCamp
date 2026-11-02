-- iCamp Build 054 verification.
do $verify$
declare
  policy_force_rls boolean;
  pass_force_rls boolean;
  event_force_rls boolean;
  payment_force_rls boolean;
begin
  if to_regclass('public.campground_vehicle_pass_policies') is null then
    raise exception 'campground_vehicle_pass_policies table is missing';
  end if;
  if to_regclass('public.vehicle_passes') is null then
    raise exception 'vehicle_passes table is missing';
  end if;
  if to_regclass('public.vehicle_pass_events') is null then
    raise exception 'vehicle_pass_events table is missing';
  end if;
  if to_regclass('public.vehicle_pass_payments') is null then
    raise exception 'vehicle_pass_payments table is missing';
  end if;
  if to_regclass('icamp_private.vehicle_pass_payment_provider_events') is null then
    raise exception 'vehicle_pass_payment_provider_events table is missing';
  end if;

  select c.relforcerowsecurity into policy_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='campground_vehicle_pass_policies';

  select c.relforcerowsecurity into pass_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='vehicle_passes';

  select c.relforcerowsecurity into event_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='vehicle_pass_events';

  select c.relforcerowsecurity into payment_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='vehicle_pass_payments';

  if policy_force_rls is distinct from true
    or pass_force_rls is distinct from true
    or event_force_rls is distinct from true
    or payment_force_rls is distinct from true then
    raise exception 'Build 054 public tables must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app','public.vehicle_pass_payments','INSERT')
    or has_table_privilege('icamp_app','public.vehicle_pass_payments','UPDATE')
    or has_table_privilege('icamp_app','public.vehicle_pass_payments','DELETE') then
    raise exception 'vehicle pass payments must remain trusted-server write only';
  end if;

  if has_table_privilege('icamp_app','public.vehicle_pass_events','UPDATE')
    or has_table_privilege('icamp_app','public.vehicle_pass_events','DELETE') then
    raise exception 'vehicle pass events must remain append-only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'icamp_private.vehicle_pass_payment_provider_events',
    'SELECT'
  ) then
    raise exception 'vehicle pass provider events must remain private';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='vehicle_passes'
      and policyname='vehicle_passes_read'
  ) then
    raise exception 'vehicle pass read policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='vehicle_passes'
      and policyname='vehicle_passes_insert'
  ) then
    raise exception 'vehicle.pass.issue insert boundary is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='vehicle_pass_payments'
      and policyname='vehicle_pass_payments_read'
  ) then
    raise exception 'vehicle pass payment read boundary is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='vehicle_passes'
      and indexname='vehicle_passes_open_extra_vehicle_uidx'
  ) then
    raise exception 'open extra-vehicle duplicate-prevention index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='vehicle_pass_payments'
      and indexname='vehicle_pass_payments_provider_reference_uidx'
  ) then
    raise exception 'vehicle pass provider reference uniqueness index is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='booking_charge_catalog'
      and policyname='booking_charge_catalog_read'
      and qual like '%vehicle.pass.issue%'
  ) then
    raise exception 'vehicle pass issuer must be able to read canonical Build 040 charges';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='road_vehicle_registrations'
      and policyname='road_vehicle_registrations_read'
      and qual like '%vehicle.pass.issue%'
  ) then
    raise exception 'vehicle pass issuer must be able to read Build 053 road registrations';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='reservations'
      and policyname='reservations_read'
      and qual like '%vehicle.pass.issue%'
  ) then
    raise exception 'vehicle pass issuer must be able to read required reservation facts';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.vehicle_passes','SELECT')
      or has_table_privilege('anon','public.vehicle_passes','INSERT')
      or has_table_privilege('anon','public.vehicle_pass_payments','SELECT') then
      raise exception 'anon direct vehicle-pass access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.vehicle_passes','SELECT')
      or has_table_privilege('authenticated','public.vehicle_passes','INSERT')
      or has_table_privilege('authenticated','public.vehicle_pass_payments','SELECT') then
      raise exception 'authenticated direct vehicle-pass access must remain denied';
    end if;
  end if;
end
$verify$;
