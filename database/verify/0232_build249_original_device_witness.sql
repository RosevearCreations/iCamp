do $verify$ declare n integer; begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname='service_fulfillment_original_device_witness_admissions'
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>1 then raise exception 'Build 249 RLS and FORCE missing'; end if;
  select count(*) into n from pg_policies
  where schemaname='public'
    and tablename='service_fulfillment_original_device_witness_admissions';
  if n<>2 then raise exception 'Build 249 read/insert policies missing'; end if;
  select count(*) into n from information_schema.table_privileges
  where table_schema='public'
    and table_name='service_fulfillment_original_device_witness_admissions'
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build 249 immutable witness cannot be updated or deleted'; end if;
  select count(*) into n from pg_trigger
  where tgname='service_fulfillment_original_device_witness_guard'
    and not tgisinternal;
  if n<>1 then raise exception 'Build 249 original-source witness trigger missing'; end if;
  select count(*) into n from pg_indexes
  where schemaname='public'
    and tablename='service_fulfillment_original_device_witness_admissions'
    and indexdef ilike '%signature_verification_id%';
  if n<1 then raise exception 'Build 249 witness idempotency uniqueness missing'; end if;
end $verify$;
