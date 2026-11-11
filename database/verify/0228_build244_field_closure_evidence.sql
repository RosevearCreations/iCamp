do $verify$ declare n integer; begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
    where s.nspname='public' and c.relname='service_fulfillment_field_closure_events'
      and c.relrowsecurity and c.relforcerowsecurity;
  if n<>1 then raise exception 'Build 244 field closure RLS missing'; end if;
  select count(*) into n from pg_policies
    where schemaname='public' and tablename='service_fulfillment_field_closure_events';
  if n<>2 then raise exception 'Build 244 field closure source policies missing'; end if;
  select count(*) into n from information_schema.table_privileges
    where table_schema='public' and table_name='service_fulfillment_field_closure_events'
      and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build 244 field evidence is mutable'; end if;
  select count(*) into n from pg_trigger
    where tgname='service_fulfillment_field_closure_guard' and not tgisinternal;
  if n<>1 then raise exception 'Build 244 current source guard missing'; end if;
end $verify$;
