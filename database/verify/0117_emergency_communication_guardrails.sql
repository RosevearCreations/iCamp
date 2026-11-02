-- Build 086: confirm independent approvals, append-only history and private RLS.
do $verify$
declare tab text;
begin
 foreach tab in array array['emergency_notice_plans','emergency_notice_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Emergency notice table missing forced RLS: %',tab; end if;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or
   has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Emergency notice history must be immutable: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='anon') and
   has_table_privilege('anon','public.'||tab,'SELECT') then
   raise exception 'Emergency notice table is anonymous-readable: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='authenticated') and
   has_table_privilege('authenticated','public.'||tab,'SELECT') then
   raise exception 'Emergency notice table is directly authenticated-readable: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='emergency_notice_plan_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='emergency_notice_event_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='emergency_notice_plans_immutable' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='emergency_notice_events_immutable' and not tgisinternal) then
  raise exception 'Emergency notice validation or immutability trigger missing'; end if;
 if not exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
  where r.role_kind='template' and r.role_code='campground_manager' and p.permission_key='emergency.broadcast') then
  raise exception 'Campground manager emergency approval permission missing'; end if;
 if exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
  where r.role_kind='template' and r.role_code='security' and p.permission_key='emergency.broadcast') then
  raise exception 'Security-only role must not independently approve emergency notices'; end if;
end $verify$;
