do $verify$ declare tab text; idx text; begin
 for tab,idx in select * from (values
  ('owner_export_exception_cases','owner_export_cases_pair_opened_idx'),
  ('owner_export_exception_outcomes','owner_export_outcomes_pair_recorded_idx'),
  ('owner_export_exception_reviews','owner_export_reviews_pair_reviewed_idx')
 ) names(tab,idx) loop
  if not exists(select 1 from pg_indexes where schemaname='public'
   and tablename=tab and indexname=idx and indexdef like '%source_campground_id%'
   and indexdef like '%target_campground_id%') then
   raise exception 'Owner oversight time-window index missing: %',idx; end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Owner oversight audit table missing forced RLS: %',tab; end if;
  if has_table_privilege('icamp_app',format('public.%I',tab),'UPDATE,DELETE') then
   raise exception 'Owner oversight cannot change immutable audit grants: %',tab; end if;
 end loop;
end $verify$;
