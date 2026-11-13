do $verify$ declare t text; n integer; begin
  foreach t in array array[
    'service_fulfillment_device_signature_verifications',
    'service_fulfillment_calibration_closure_events',
    'service_fulfillment_owner_dossier_snapshots'
  ] loop
    select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
      where s.nspname='public' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity;
    if n<>1 then raise exception 'Build 247 RLS force missing for %',t; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename=t;
    if n<>2 then raise exception 'Build 247 RLS policies missing for %',t; end if;
    select count(*) into n from information_schema.table_privileges
      where table_schema='public' and table_name=t and grantee='icamp_app'
        and privilege_type in ('UPDATE','DELETE');
    if n<>0 then raise exception 'Build 247 immutable ledger cannot allow updates or deletes %',t; end if;
  end loop;
  select count(*) into n from pg_trigger where tgname in (
    'service_fulfillment_device_signature_guard',
    'service_fulfillment_calibration_closure_guard',
    'service_fulfillment_owner_dossier_guard'
  ) and not tgisinternal;
  if n<>3 then raise exception 'Build 247 evidence custody triggers absent'; end if;
  select count(*) into n from pg_indexes
    where schemaname='public' and tablename='service_fulfillment_device_signature_verifications'
      and indexdef ilike '%signer_key_id, nonce_digest_sha256%';
  if n<1 then raise exception 'Build 247 durable nonce replay uniqueness missing'; end if;
end $verify$;
