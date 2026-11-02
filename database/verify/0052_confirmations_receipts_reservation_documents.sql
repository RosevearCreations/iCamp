-- iCamp Build 043 verification
-- Confirmations, Receipts & Reservation Documents.

do $verify_build043$
declare
  table_name text;
  rls_enabled boolean;
  rls_forced boolean;
  app_insert boolean;
  app_update boolean;
  app_delete boolean;
  missing_fk_indexes integer;
begin
  foreach table_name in array array[
    'reservation_confirmations',
    'reservation_invoices',
    'reservation_receipts'
  ]
  loop
    select c.relrowsecurity, c.relforcerowsecurity
      into rls_enabled, rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = table_name;

    if not coalesce(rls_enabled, false) or not coalesce(rls_forced, false) then
      raise exception 'Build 043 table % must FORCE RLS', table_name;
    end if;

    select
      has_table_privilege('icamp_app', format('public.%I', table_name), 'INSERT'),
      has_table_privilege('icamp_app', format('public.%I', table_name), 'UPDATE'),
      has_table_privilege('icamp_app', format('public.%I', table_name), 'DELETE')
      into app_insert, app_update, app_delete;

    if app_insert or app_update or app_delete then
      raise exception 'Build 043 document table % must remain trusted-server write only', table_name;
    end if;
  end loop;

  if not has_table_privilege(
    'icamp_app',
    'public.reservation_confirmations',
    'SELECT'
  ) then
    raise exception 'Build 043 confirmations must be readable through authorized icamp_app RLS';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_confirmations_reservation_unique'
  ) then
    raise exception 'Build 043 must allow only one confirmation per reservation';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_receipts_payment_unique'
  ) then
    raise exception 'Build 043 must allow only one receipt per captured payment';
  end if;

  select count(*)::integer
    into missing_fk_indexes
  from (
    values
      ('reservation_confirmations_scope_fk_idx'),
      ('reservation_confirmations_schedule_fk_idx'),
      ('reservation_invoices_scope_fk_idx'),
      ('reservation_invoices_confirmation_fk_idx'),
      ('reservation_receipts_scope_fk_idx')
  ) required(index_name)
  where not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = required.index_name
  );

  if missing_fk_indexes <> 0 then
    raise exception 'Build 043 foreign-key coverage indexes are incomplete';
  end if;
end
$verify_build043$;
