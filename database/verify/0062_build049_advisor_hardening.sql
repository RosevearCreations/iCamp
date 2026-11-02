-- iCamp Build 049 advisor-hardening verification
do $$
declare
  required_index_count integer;
begin
  select count(*)
    into required_index_count
  from pg_indexes
  where schemaname='public'
    and indexname in (
      'reservation_check_ins_scope_reservation_fk_idx',
      'reservation_check_ins_scope_guest_profile_fk_idx'
    );

  if required_index_count <> 2 then
    raise exception 'Build 049 composite foreign-key covering indexes are incomplete';
  end if;
end
$$;
