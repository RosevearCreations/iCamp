-- iCamp Build 054 advisor hardening verification.
do $verify$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='vehicle_pass_payments'
      and indexname='vehicle_pass_payments_scope_pass_fk_idx'
  ) then
    raise exception 'Build 054 vehicle-pass payment composite foreign-key index is missing';
  end if;
end
$verify$;
