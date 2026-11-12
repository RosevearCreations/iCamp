do $verify$ declare t text; n integer; begin
  foreach t in array array[
    'service_fulfillment_field_witness_events',
    'service_fulfillment_forecast_checkpoints',
    'service_fulfillment_owner_shift_audit_events'
  ] loop
    select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
      where s.nspname='public' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity;
    if n<>1 then raise exception 'Build 245 private source RLS missing for %',t; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename=t;
    if n<>2 then raise exception 'Build 245 source policies missing for %',t; end if;
    select count(*) into n from information_schema.table_privileges
      where table_schema='public' and table_name=t and grantee='icamp_app'
        and privilege_type in ('UPDATE','DELETE');
    if n<>0 then raise exception 'Build 245 source evidence must be append-only for %',t; end if;
  end loop;
  select count(*) into n from pg_trigger
    where tgname in (
      'service_fulfillment_witness_guard',
      'service_fulfillment_forecast_checkpoint_guard',
      'service_fulfillment_owner_shift_audit_guard'
    ) and not tgisinternal;
  if n<>3 then raise exception 'Build 245 independent and owner guards missing'; end if;
end $verify$;
