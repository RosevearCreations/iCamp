-- Verify Build 079's scoped, private, append-only waste operations model.
do $verify$
declare
 table_name text;
 expected_permission text;
begin
 foreach table_name in array array[
  'garbage_service_policies','garbage_pickup_requests','garbage_pickup_events'
 ] loop
  if not exists (
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=table_name
     and c.relrowsecurity and c.relforcerowsecurity
  ) then
   raise exception 'Build 079 table % must enable and force RLS',table_name;
  end if;
  if exists(select 1 from pg_roles where rolname='anon') and
    has_table_privilege('anon','public.'||table_name,'SELECT') then
   raise exception 'Build 079 direct anon SELECT on %',table_name;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') and
    has_table_privilege('authenticated','public.'||table_name,'SELECT') then
   raise exception 'Build 079 direct authenticated SELECT on %',table_name;
  end if;
 end loop;
 foreach expected_permission in array array[
  'garbage.read','garbage.configure','garbage.dispatch'
 ] loop
  if not exists(select 1 from icamp_private.permission_catalog p
    where p.permission_key=expected_permission) then
   raise exception 'Build 079 permission % missing',expected_permission;
  end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='garbage_pickup_guard' and not tgisinternal) then
  raise exception 'Build 079 pickup transition guard is missing';
 end if;
 if not exists(select 1 from pg_trigger where tgname='garbage_pickup_events_append_only' and not tgisinternal) then
  raise exception 'Build 079 append-only event guard is missing';
 end if;
end $verify$;
