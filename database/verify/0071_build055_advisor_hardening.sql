-- iCamp Build 055 advisor-hardening verification.
do $verify$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='visitor_registrations'
      and indexname='visitor_registrations_scope_accommodation_fk_idx'
  ) then
    raise exception 'Build 055 host-accommodation composite foreign-key index is missing';
  end if;
end
$verify$;
