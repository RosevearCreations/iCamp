do $verify$ declare name text; begin
 foreach name in array array['owner_export_hold_recurrence_reviews','owner_export_hold_recurrence_decisions'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=name and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Build 115 forced owner RLS missing on %',name; end if;
  if has_table_privilege('icamp_app',format('public.%I',name),'UPDATE,DELETE') then
   raise exception 'Build 115 owner audit must be immutable: %',name; end if;
 end loop;
end $verify$;
