-- Build 083: migration and protective permission verification.
do $verify$
declare name text;
begin
 foreach name in array array['safety_enforcement_cases','safety_enforcement_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=name
      and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Missing forced RLS on %',name;
  end if;
  if exists(select 1 from pg_roles where rolname='anon') then
   if has_table_privilege('anon','public.'||name,'SELECT') then
    raise exception 'Direct anonymous Data API reads prohibited on %',name;
   end if;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
   if has_table_privilege('authenticated','public.'||name,'SELECT') then
    raise exception 'Direct authenticated Data API reads prohibited on %',name;
   end if;
  end if;
 end loop;
 if has_table_privilege('icamp_app','public.safety_enforcement_events','INSERT') then
  raise exception 'Audit events must only be inserted by internal trigger'; end if;
 if not exists(select 1 from pg_trigger where tgname='safety_enforcement_audit' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='safety_enforcement_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='safety_enforcement_events_immutable' and not tgisinternal)
  then raise exception 'Missing case validation, audit or immutability'; end if;
 if exists(select 1 from icamp_private.role_permissions rp
   join icamp_private.roles r on r.id=rp.role_id
   where r.role_kind='template' and r.role_code='security'
     and rp.permission_key='safety.suspension.review') then
  raise exception 'Security-only staff must not hold management review authority'; end if;
 if not exists(select 1 from icamp_private.role_permissions rp
   join icamp_private.roles r on r.id=rp.role_id
   where r.role_kind='template' and r.role_code='campground_manager'
     and rp.permission_key='safety.suspension.review') then
  raise exception 'Campground manager review authority missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
   and indexname='safety_enforcement_campground_queue_idx') then
  raise exception 'Campground enforcement queue index missing'; end if;
 foreach name in array array[
  'safety_enforcement_scope_reservation_fk_idx',
  'safety_enforcement_scope_facility_fk_idx',
  'safety_enforcement_scope_zone_fk_idx',
  'safety_enforcement_scope_event_case_fk_idx'
 ] loop
  if not exists(select 1 from pg_indexes where schemaname='public'
   and indexname=name) then
   raise exception 'Composite tenant FK index missing: %',name; end if;
 end loop;
end $verify$;
