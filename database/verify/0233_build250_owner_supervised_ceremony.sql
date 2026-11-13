do $verify$ declare n integer; begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname='service_fulfillment_owner_ceremony_reviews'
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>1 then raise exception 'Build 250 RLS and FORCE missing'; end if;
  select count(*) into n from pg_policies
  where schemaname='public'
    and tablename='service_fulfillment_owner_ceremony_reviews';
  if n<>2 then raise exception 'Build 250 owner-only read/insert policies missing'; end if;
  select count(*) into n from information_schema.table_privileges
  where table_schema='public'
    and table_name='service_fulfillment_owner_ceremony_reviews'
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build 250 immutable owner review must not be changed'; end if;
  select count(*) into n from pg_trigger
  where tgname='service_fulfillment_owner_ceremony_guard' and not tgisinternal;
  if n<>1 then raise exception 'Build 250 owner authority trigger missing'; end if;
  select count(*) into n from pg_indexes
  where schemaname='public'
    and tablename='service_fulfillment_owner_ceremony_reviews'
    and indexdef ilike '%source_health_nonce_digest_sha256%';
  if n<>1 then raise exception 'Build 250 signed source nonce replay uniqueness missing'; end if;
end $verify$;
