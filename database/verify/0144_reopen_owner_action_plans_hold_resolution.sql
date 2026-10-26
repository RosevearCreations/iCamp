do $verify$ declare name text; begin
 foreach name in array array['owner_export_reopen_action_plans','owner_export_reopen_hold_resolutions'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=name and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Build 113 missing forced RLS on %',name; end if;
  if has_table_privilege('icamp_app',format('public.%I',name),'UPDATE,DELETE') then
   raise exception 'Build 113 audit must be append-only: %',name; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='reopen_action_plan_guard' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='reopen_hold_resolution_guard' and not tgisinternal) then
  raise exception 'Build 113 independent owner guards are missing'; end if;
end $verify$;
