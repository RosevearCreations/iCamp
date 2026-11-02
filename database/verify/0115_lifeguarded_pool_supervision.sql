-- Build 084: privileged access, append-only evidence and operating gates.
do $verify$
declare tab text;
begin
 foreach tab in array array['pool_swim_policies','pool_staff_qualifications','pool_swim_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Missing forced RLS on %',tab; end if;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE')
    or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Supervision evidence table is mutable: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='anon') and
    has_table_privilege('anon','public.'||tab,'SELECT') then
   raise exception 'Anonymous Data API access: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='authenticated') and
    has_table_privilege('authenticated','public.'||tab,'SELECT') then
   raise exception 'Authenticated Data API access: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='pool_swim_event_validate' and not tgisinternal)
   or not exists(select 1 from pg_trigger where tgname='pool_swim_events_immutable' and not tgisinternal)
   or not exists(select 1 from pg_trigger where tgname='pool_staff_qualification_validate' and not tgisinternal) then
  raise exception 'Missing supervision guards'; end if;
 if exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
   where r.role_kind='template' and r.role_code='pool_lifeguard' and p.permission_key='pool.supervision.manage') then
  raise exception 'Lifeguard role may not release holds or verify credentials'; end if;
 if not exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
   where r.role_kind='template' and r.role_code='pool_lifeguard' and p.permission_key='pool.supervision.attest') then
  raise exception 'Lifeguard template missing observation rights'; end if;
end $verify$;
