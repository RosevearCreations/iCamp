do $verify_build188$
begin
 if not exists(select 1 from pg_class
  where oid='icamp_private.access_reconciliation_reviews'::regclass
    and relrowsecurity and relforcerowsecurity) then
  raise exception 'Build188 immutable review ledger requires forced RLS';
 end if;
 if has_table_privilege('anon','icamp_private.access_reconciliation_reviews','SELECT')
  or has_table_privilege('authenticated','icamp_private.access_reconciliation_reviews','INSERT') then
  raise exception 'Build188 evidence exposed to client roles';
 end if;
 if has_table_privilege('icamp_app','icamp_private.access_reconciliation_reviews','UPDATE')
  or has_table_privilege('icamp_app','icamp_private.access_reconciliation_reviews','DELETE') then
  raise exception 'Build188 reconciliation history is writable';
 end if;
 if not exists(select 1 from pg_trigger where tgname='guard_access_reconciliation_reviews'
  and tgrelid='icamp_private.access_reconciliation_reviews'::regclass and not tgisinternal) then
  raise exception 'Build188 review immutability trigger missing';
 end if;
 if not exists(select 1 from pg_policies where schemaname='icamp_private'
  and tablename='access_reconciliation_reviews' and cmd='INSERT'
  and with_check like '%access.reconciliation.review%') then
  raise exception 'Build188 independent permission check missing';
 end if;
 if not has_function_privilege('icamp_app','icamp_private.access_reconciliation_sources(uuid)','EXECUTE')
  or has_function_privilege('anon','icamp_private.access_reconciliation_sources(uuid)','EXECUTE') then
  raise exception 'Build188 scoped source function grants invalid';
 end if;
end $verify_build188$;
