do $verify$ declare tab text; func text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_followup_tasks','permanent_unit_finance_followup_evidence','permanent_unit_finance_followup_reassessments','permanent_unit_finance_escalation_closures'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then raise exception 'Missing FORCE RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) and has_table_privilege(role_name,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Public finance follow-up privilege: % / %',tab,role_name; end if;
  end loop;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or has_table_privilege('icamp_app','public.'||tab,'DELETE') then raise exception 'Mutable follow-up ledger: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then raise exception 'Missing append-only trigger: %',tab; end if;
 end loop;
 foreach func in array array['finance_followup_task_guard','finance_followup_evidence_guard','finance_followup_reassessment_guard','finance_escalation_closure_guard'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='icamp_private' and p.proname=func and not p.prosecdef) then raise exception 'Missing invoker guard: %',func; end if;
 end loop;
end $verify$;
