-- iCamp Build 042 verification.
do $verify$
declare
  policy_force_rls boolean;
  schedule_force_rls boolean;
  payments_force_rls boolean;
begin
  if to_regclass('public.campground_payment_policies') is null then
    raise exception 'campground_payment_policies table is missing';
  end if;

  if to_regclass('public.reservation_payment_schedules') is null then
    raise exception 'reservation_payment_schedules table is missing';
  end if;

  if to_regclass('public.reservation_payments') is null then
    raise exception 'reservation_payments table is missing';
  end if;

  if to_regclass('icamp_private.payment_provider_events') is null then
    raise exception 'payment_provider_events table is missing';
  end if;

  select c.relforcerowsecurity
    into policy_force_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'campground_payment_policies';

  select c.relforcerowsecurity
    into schedule_force_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reservation_payment_schedules';

  select c.relforcerowsecurity
    into payments_force_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reservation_payments';

  if policy_force_rls is distinct from true
    or schedule_force_rls is distinct from true
    or payments_force_rls is distinct from true
  then
    raise exception 'Build 042 public payment tables must FORCE RLS';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.reservation_payment_schedules',
    'INSERT'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_payment_schedules',
    'UPDATE'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_payment_schedules',
    'DELETE'
  ) then
    raise exception 'payment schedules must remain immutable to icamp_app';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.reservation_payments',
    'INSERT'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_payments',
    'UPDATE'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_payments',
    'DELETE'
  ) then
    raise exception 'payment attempts must be trusted-server write only';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.campground_payment_policies',
    'DELETE'
  ) then
    raise exception 'payment policy delete privilege must not exist';
  end if;

  if not has_table_privilege(
    'icamp_app',
    'public.campground_payment_policies',
    'SELECT'
  ) or not has_table_privilege(
    'icamp_app',
    'public.campground_payment_policies',
    'INSERT'
  ) or not has_table_privilege(
    'icamp_app',
    'public.campground_payment_policies',
    'UPDATE'
  ) then
    raise exception 'campground payment policy management grants are incomplete';
  end if;

  if has_table_privilege(
    'icamp_app',
    'icamp_private.payment_provider_events',
    'SELECT'
  ) then
    raise exception 'provider event ledger must remain private';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reservation_payments'
      and indexname = 'reservation_payments_provider_reference_uidx'
  ) then
    raise exception 'payment provider reference uniqueness index is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reservation_payment_schedules'
      and policyname = 'reservation_payment_schedules_read'
  ) then
    raise exception 'guest/staff payment schedule read policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reservation_payments'
      and policyname = 'reservation_payments_read'
  ) then
    raise exception 'guest/staff payment attempt read policy is missing';
  end if;
end
$verify$;
