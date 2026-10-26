do $verify$ declare role_name text; begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_oversight_reassessments'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 110 reassessment requires forced private row-level security'; end if;
 if has_table_privilege('icamp_app','public.owner_export_oversight_reassessments','UPDATE,DELETE') then
  raise exception 'Owner reassessment audit must be append-only'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name)
   and has_table_privilege(role_name,'public.owner_export_oversight_reassessments','SELECT,INSERT') then
   raise exception 'Public client and service role % must not read owner reassessments',role_name;
  end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='owner_export_oversight_reassessment_immutable' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='owner_export_oversight_reassessment_guard' and not tgisinternal) then
  raise exception 'Owner reassessment immutability and authorization guards are missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='public'
  and tablename='owner_export_oversight_reassessments'
  and policyname='owner_export_oversight_reassessment_read'
  and qual like '%source_campground_id%' and qual like '%target_campground_id%') then
  raise exception 'Both campground owner permissions must protect reassessment reads'; end if;
 if position('109109' in pg_get_functiondef('icamp_private.owner_export_oversight_reassessment_guard()'::regprocedure))=0
  or position('decided_by_user_id' in pg_get_functiondef('icamp_private.owner_export_oversight_reassessment_guard()'::regprocedure))=0
  or position('observed_unclosed_cases' in pg_get_functiondef('icamp_private.owner_export_oversight_reassessment_guard()'::regprocedure))=0
  or position('closure_recommended' in pg_get_functiondef('icamp_private.owner_export_oversight_reassessment_guard()'::regprocedure))=0 then
  raise exception 'Reassessment independence, concurrency and evidence checks are missing'; end if;
end $verify$;
