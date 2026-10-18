-- iCamp Build 056 advisor-hardening verification.
do $verify$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='access_credential_events'
      and indexname='access_credential_events_scope_credential_fk_idx'
  ) then
    raise exception 'Build 056 scoped access credential event foreign-key index is missing';
  end if;
end
$verify$;
