-- Build 087 schema-level acceptance and private authorization guarantees.
do $verify$
declare tab text;
begin
 foreach tab in array array['winterization_templates','winterization_runs','winterization_step_events','winterization_reviews'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'Winterization table missing forced RLS: %',tab; end if;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or
     has_table_privilege('icamp_app','public.'||tab,'DELETE') then
    raise exception 'Winterization audit history is mutable: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='anon') and
     has_table_privilege('anon','public.'||tab,'SELECT') then
    raise exception 'Winterization records are exposed to anonymous API: %',tab; end if;
  if exists(select 1 from pg_roles where rolname='authenticated') and
     has_table_privilege('authenticated','public.'||tab,'SELECT') then
    raise exception 'Winterization records are directly authenticated-readable: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='winterization_review_validate' and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='winterization_step_validate' and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='seasonal_assignments_require_winterization' and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='winterization_templates_immutable' and not tgisinternal)
 then raise exception 'Required winterization validation or immutability trigger is absent'; end if;
 if not exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
  where r.role_code='maintenance_lead' and r.role_kind='template' and p.permission_key='winterization.signoff') then
  raise exception 'Maintenance lead winterization sign-off permission missing'; end if;
 if exists(select 1 from icamp_private.role_permissions p join icamp_private.roles r on r.id=p.role_id
  where r.role_code='maintenance' and r.role_kind='template' and p.permission_key='winterization.signoff') then
  raise exception 'Maintenance crew must not independently sign off winterization'; end if;
end $verify$;
