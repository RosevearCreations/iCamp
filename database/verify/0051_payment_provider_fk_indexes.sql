-- iCamp Build 042 advisor hardening verification.
do $verify$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'reservation_payment_schedules'
      and indexname = 'reservation_payment_schedules_scope_fk_idx'
  ) then
    raise exception 'reservation payment schedule scope FK index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'reservation_payments'
      and indexname = 'reservation_payments_reservation_scope_fk_idx'
  ) then
    raise exception 'reservation payment reservation scope FK index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'reservation_payments'
      and indexname = 'reservation_payments_schedule_scope_fk_idx'
  ) then
    raise exception 'reservation payment schedule scope FK index is missing';
  end if;
end
$verify$;
