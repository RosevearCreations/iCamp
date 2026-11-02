-- iCamp Build 045 verification
-- Cancellation, Refund & Adjustment Safeguards.

do $verify_build045$
declare
  t text;
  rls_enabled boolean;
  rls_forced boolean;
begin
  foreach t in array array[
    'campground_cancellation_refund_policies',
    'reservation_refunds',
    'reservation_financial_adjustments'
  ]
  loop
    select c.relrowsecurity, c.relforcerowsecurity
      into rls_enabled, rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = t;

    if not coalesce(rls_enabled, false) or not coalesce(rls_forced, false) then
      raise exception 'Build 045 table % must FORCE RLS', t;
    end if;
  end loop;

  if has_table_privilege('icamp_app', 'public.reservation_financial_adjustments', 'UPDATE')
     or has_table_privilege('icamp_app', 'public.reservation_financial_adjustments', 'DELETE') then
    raise exception 'Build 045 financial adjustments must remain append-only';
  end if;

  if has_table_privilege('icamp_app', 'icamp_private.refund_provider_events', 'SELECT')
     or has_table_privilege('icamp_app', 'icamp_private.refund_provider_events', 'INSERT') then
    raise exception 'Build 045 refund provider events must remain private';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reservation_refunds_idempotency_unique'
  ) then
    raise exception 'Build 045 refund idempotency constraint is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'reservation_financial_adjustments_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 045 financial-adjustment append-only trigger is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'reservation_refunds_scope_fk_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'reservation_refunds_original_payment_fk_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'reservation_financial_adjustments_scope_fk_idx'
  ) then
    raise exception 'Build 045 foreign-key coverage indexes are incomplete';
  end if;
end
$verify_build045$;
