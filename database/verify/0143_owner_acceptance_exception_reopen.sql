do $verify$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='owner_export_acceptance_exception_reviews'
   and c.relrowsecurity and c.relforcerowsecurity) then
  raise exception 'Build 112 post-acceptance reviews require forced private RLS'; end if;
 if has_table_privilege('icamp_app','public.owner_export_acceptance_exception_reviews','UPDATE,DELETE') then
  raise exception 'Build 112 reviews must remain append-only'; end if;
 if not exists(select 1 from pg_trigger where tgname='owner_acceptance_exception_review_guard' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='owner_acceptance_exception_review_immutable' and not tgisinternal) then
  raise exception 'Build 112 audit guards are missing'; end if;
end $verify$;
