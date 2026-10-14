-- iCamp Build 041 verification.
do $verify$
declare
  details_force_rls boolean;
  lines_force_rls boolean;
begin
  if to_regclass('public.reservation_checkout_details') is null then
    raise exception 'reservation_checkout_details table is missing';
  end if;

  if to_regclass('public.reservation_charge_lines') is null then
    raise exception 'reservation_charge_lines table is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservation_holds'
      and column_name = 'checkout_user_id'
  ) then
    raise exception 'reservation_holds.checkout_user_id is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'originating_hold_id'
  ) then
    raise exception 'reservations.originating_hold_id is missing';
  end if;

  select c.relforcerowsecurity
    into details_force_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reservation_checkout_details';

  select c.relforcerowsecurity
    into lines_force_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reservation_charge_lines';

  if details_force_rls is distinct from true
    or lines_force_rls is distinct from true
  then
    raise exception 'Build 041 checkout snapshot tables must FORCE RLS';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.reservation_checkout_details',
    'INSERT'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_checkout_details',
    'UPDATE'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_checkout_details',
    'DELETE'
  ) then
    raise exception 'checkout details must remain immutable to icamp_app';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.reservation_charge_lines',
    'INSERT'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_charge_lines',
    'UPDATE'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_charge_lines',
    'DELETE'
  ) then
    raise exception 'reservation charge lines must remain immutable to icamp_app';
  end if;

  if not has_table_privilege(
    'icamp_app',
    'public.reservation_checkout_details',
    'SELECT'
  ) or not has_table_privilege(
    'icamp_app',
    'public.reservation_charge_lines',
    'SELECT'
  ) then
    raise exception 'icamp_app must be able to read Build 041 checkout evidence';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reservation_holds'
      and indexname = 'reservation_holds_active_guest_window_uidx'
  ) then
    raise exception 'guest checkout hold uniqueness index is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reservations'
      and indexname = 'reservations_originating_hold_uidx'
  ) then
    raise exception 'reservation hold-conversion idempotency index is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reservation_checkout_details'
      and policyname = 'reservation_checkout_details_read'
  ) then
    raise exception 'checkout details read policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reservation_charge_lines'
      and policyname = 'reservation_charge_lines_read'
  ) then
    raise exception 'reservation charge lines read policy is missing';
  end if;
end
$verify$;
