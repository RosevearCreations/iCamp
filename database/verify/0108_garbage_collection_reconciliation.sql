do $verify$ declare t text; p text; begin
 foreach t in array array['garbage_collection_routes','garbage_collection_proofs','garbage_tag_finance_reviews'] loop
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity)
    then raise exception 'Build 081 table % must force RLS',t; end if;
  if exists(select 1 from pg_roles where rolname='anon') and has_table_privilege('anon','public.'||t,'SELECT')
    then raise exception 'Direct anonymous read forbidden on %',t; end if;
 end loop;
 foreach p in array array['garbage.routes.manage','garbage.finance.reconcile'] loop
  if not exists(select 1 from icamp_private.permission_catalog where permission_key=p)
    then raise exception 'Build 081 permission % missing',p; end if;
 end loop;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='garbage_collected_pickup_once_idx')
  then raise exception 'Completed collection must be unique per pickup'; end if;
 if (select count(*) from pg_trigger where tgname in
  ('garbage_route_append_only','garbage_proof_append_only','garbage_finance_review_append_only') and not tgisinternal)<>3
  then raise exception 'Append-only collection/finance triggers missing'; end if;
end $verify$;
