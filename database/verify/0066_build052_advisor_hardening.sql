-- iCamp Build 052 advisor-hardening verification.

do $verify_build052_advisor_hardening$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='reservation_stay_adjustments'
      and indexname='reservation_stay_adjustments_reservation_idx'
      and indexdef ilike '%(organization_id, campground_id, reservation_id, occurred_at desc)%'
  ) then
    raise exception 'Build 052 scoped reservation covering index is missing';
  end if;
end
$verify_build052_advisor_hardening$;
