do $verify_build188_fk$
begin
 if not exists(select 1 from pg_indexes
  where schemaname='icamp_private' and tablename='access_reconciliation_reviews'
   and indexname='access_reconciliation_reviews_credential_fk_idx') then
  raise exception 'Build188 scoped credential foreign key index missing';
 end if;
end $verify_build188_fk$;
