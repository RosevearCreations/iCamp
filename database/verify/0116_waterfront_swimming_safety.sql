-- Build 085: fail if tenant evidence is mutable, exposed or missing guards.
do $verify$
declare tab text;
begin
 foreach tab in array array['waterfront_swim_zone_versions','waterfront_staff_training_events','waterfront_swim_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Missing forced RLS on %',tab; end if;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE')
   or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Waterfront safety evidence is mutable: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='anon') and
   has_table_privilege('anon','public.'||tab,'SELECT') then
   raise exception 'Anonymous Data API access to %',tab; end if;
  if exists(select 1 from pg_roles where rolname='authenticated') and
   has_table_privilege('authenticated','public.'||tab,'SELECT') then
   raise exception 'Authenticated Data API access to %',tab; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='waterfront_zone_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='waterfront_training_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='waterfront_event_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='waterfront_events_immutable' and not tgisinternal) then
   raise exception 'Required waterfront validation and immutability triggers missing'; end if;
 if exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
  where r.role_kind='template' and r.role_code='waterfront_attendant'
    and p.permission_key='waterfront.swim.manage') then
   raise exception 'Waterfront attendant may not manage reopening or training'; end if;
 if not exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
  where r.role_kind='template' and r.role_code='waterfront_attendant'
    and p.permission_key='waterfront.swim.monitor') then
   raise exception 'Waterfront attendant missing emergency closure permission'; end if;
end $verify$;
