do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_continuity_resolution_followups'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 132 forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_continuity_resolution_followups','UPDATE,DELETE') then
  raise exception 'Build 132 closure follow-up must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_continuity_resolution_followups'
   and t.tgname='continuity_resolution_followup_guard' and not t.tgisinternal) then
  raise exception 'Build 132 source linkage guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_continuity_resolution_followups'
   and t.tgname='continuity_resolution_followup_immutable' and not t.tgisinternal) then
  raise exception 'Build 132 append-only guard missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and indexname='continuity_resolution_initial_recheck_idx') then
  raise exception 'Build 132 initial recheck must not be duplicated'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_reopened_exception_aging_reviews'
   and t.tgname='zz_continuity_resolution_prevent_aging_fork' and not t.tgisinternal) then
  raise exception 'Build 132 must prevent competing older Build 131 chains'; end if;
end $verify$;
