do $verify$ declare n integer; begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where s.nspname='public' and c.relname='service_fulfillment_supervisor_review_events'
    and c.relrowsecurity and c.relforcerowsecurity;
  if n <> 1 then raise exception 'Build 242 review table RLS not forced'; end if;
  select count(*) into n from pg_policies where schemaname='public'
    and tablename='service_fulfillment_supervisor_review_events';
  if n <> 2 then raise exception 'Build 242 review policies not scoped'; end if;
  select count(*) into n from information_schema.table_privileges
  where table_schema='public' and table_name='service_fulfillment_supervisor_review_events'
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n <> 0 then raise exception 'Build 242 source review must be append only'; end if;
  select count(*) into n from pg_trigger where tgname='service_fulfillment_supervisor_review_guard'
    and not tgisinternal;
  if n <> 1 then raise exception 'Build 242 source reviewer guard missing'; end if;
end $verify$;
