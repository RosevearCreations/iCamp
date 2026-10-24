do $verify$ declare tab text; begin
 foreach tab in array array['winter_readiness_templates','winter_readiness_assessments',
  'winter_readiness_observations','winter_readiness_decisions'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Winter-readiness table lacks enforced RLS: %',tab; end if;
  if has_table_privilege('anon','public.'||tab,'SELECT')
   or has_table_privilege('authenticated','public.'||tab,'INSERT')
   or has_table_privilege('service_role','public.'||tab,'SELECT') then
   raise exception 'Unsafe Data API grant on %',tab; end if;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Mutable winter-readiness evidence grant: %',tab; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='winter_readiness_assessment_validate' and not tgisinternal) or
  not exists(select 1 from pg_trigger where tgname='winter_readiness_decision_validate' and not tgisinternal) then
  raise exception 'Winter-readiness authorization triggers missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='winter_readiness_decisions_assessment_fk_idx') then
  raise exception 'Winter readiness scoped FK index missing'; end if;
end $verify$;
