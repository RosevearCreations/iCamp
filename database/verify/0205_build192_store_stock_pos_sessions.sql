do $verify_build192$
declare t text;
begin
 foreach t in array array['store_stock_locations','store_stock_balances','store_stock_reorder_rules','store_pos_sessions','store_stock_events','store_stock_counts','store_stock_count_reviews','store_pos_session_reviews'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'Build192 % must FORCE RLS',t;end if;
  if (exists(select 1 from pg_roles where rolname='anon') and has_table_privilege('anon',format('icamp_private.%I',t),'SELECT'))
   or (exists(select 1 from pg_roles where rolname='authenticated') and has_table_privilege('authenticated',format('icamp_private.%I',t),'SELECT')) then
    raise exception 'Build192 % has guest or anonymous data access',t;end if;
 end loop;
 foreach t in array array['store_stock_balances','store_stock_events','store_stock_count_reviews'] loop
   if has_table_privilege('icamp_app',format('icamp_private.%I',t),'UPDATE')
     or has_table_privilege('icamp_app',format('icamp_private.%I',t),'DELETE')
     or has_table_privilege('icamp_app',format('icamp_private.%I',t),'INSERT') then
     raise exception 'Build192 % direct mutations must be private',t;end if;
 end loop;
 if not exists(select 1 from icamp_private.permission_catalog where permission_key='inventory.audit') then
   raise exception 'Independent count / register audit permission not installed';end if;
 if not exists(select 1 from pg_policies where schemaname='icamp_private'
   and tablename='store_catalog_products' and policyname='store_products_staff_stock_read') then
   raise exception 'Existing store catalog scoped read policy not extended';end if;
 if not exists(select 1 from pg_indexes where schemaname='icamp_private'
   and indexname='store_pos_one_open_register_idx') then
   raise exception 'Only one open register per campground enforced';end if;
 if not exists(select 1 from pg_trigger where tgrelid='icamp_private.store_stock_events'::regclass
   and tgname='store_stock_events_immutable' and not tgisinternal) then
   raise exception 'Stock ledger must be immutable';end if;
 if exists(select 1 from pg_proc p,
     lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) access
   where p.oid='icamp_private.post_store_stock_operation(uuid,uuid,uuid,uuid,text,integer,bigint,text,text,uuid,bigint,uuid,integer)'::regprocedure
     and access.grantee=0 and access.privilege_type='EXECUTE') then
   raise exception 'Public stock posting must remain forbidden';end if;
 if not has_function_privilege('icamp_app','icamp_private.post_store_stock_operation(uuid,uuid,uuid,uuid,text,integer,bigint,text,text,uuid,bigint,uuid,integer)','EXECUTE') then
   raise exception 'Authorized stock posting function unavailable';end if;
end $verify_build192$;
