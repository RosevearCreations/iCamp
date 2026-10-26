do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_signoff_independent_closeout_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 124 independent closeout forced RLS missing'; end if;
 if has_table_privilege('icamp_app','public.owner_export_signoff_independent_closeout_reviews','UPDATE,DELETE') then
  raise exception 'Build 124 independent closeout reviews must be append-only'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_signoff_independent_closeout_reviews'
   and t.tgname='signoff_independent_closeout_guard' and not t.tgisinternal) then
  raise exception 'Build 124 independent reviewer guard missing'; end if;
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_signoff_independent_closeout_reviews'
   and t.tgname='signoff_independent_closeout_immutable' and not t.tgisinternal) then
  raise exception 'Build 124 immutable closeout guard missing'; end if;
end $verify$;
