do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_financing_applications','permanent_unit_financing_evidence','permanent_unit_financing_triage'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Financing intake table missing FORCE RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Direct API privileges found on private financing table: % to %',tab,role_name; end if;
  end loop;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Financing history must be append-only: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Financing immutable trigger missing: %',tab; end if;
 end loop;
 foreach tab in array array['financing_intake_open_guard','financing_evidence_guard','financing_triage_guard'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='icamp_private' and p.proname=tab and not p.prosecdef) then
   raise exception 'Invoker financing validation function missing: %',tab; end if;
 end loop;
end $verify$;
