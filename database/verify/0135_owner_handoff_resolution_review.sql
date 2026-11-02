do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_resolution_reassessments','permanent_unit_finance_owner_resolution_acceptances'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Owner reassessment/acceptance table missing forced RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,format('public.%I',tab),'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Unexpected public grant on %',tab; end if;
  end loop;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Owner reassessment/acceptance ledger permits mutation: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Owner reassessment/acceptance ledger missing immutability trigger: %',tab; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=tab
   and policyname=tab||'_read' and qual like '%source_campground_id%' and qual like '%target_campground_id%') then
   raise exception 'Both owner campground permissions required for %',tab; end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.permanent_unit_finance_owner_resolution_acceptances'::regclass
  and contype='u' and pg_get_constraintdef(oid) like '%(resolution_id)%') then
  raise exception 'Only one independent acceptance is allowed per owner resolution'; end if;
 if position('resolved_by_user_id=new.reviewed_by_user_id' in pg_get_functiondef('icamp_private.finance_owner_resolution_review_guard()'::regprocedure))=0
  or position('new.accepted_by_user_id=latest.reviewed_by_user_id' in pg_get_functiondef('icamp_private.finance_owner_resolution_acceptance_guard()'::regprocedure))=0 then
  raise exception 'Owner reviewer and acceptor separation check missing'; end if;
end $verify$;
