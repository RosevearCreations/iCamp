do $verify$ declare tab text; api_role text; begin
 foreach tab in array array['permanent_unit_ownership_events','permanent_unit_sale_listings','permanent_unit_buyer_inquiries'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Permanent-unit evidence table lacks FORCE RLS: %',tab; end if;
  foreach api_role in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=api_role) then
    if has_table_privilege(api_role,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then
     raise exception 'Direct Data API grant on private permanent-unit table % to %',tab,api_role;
    end if;
   end if;
  end loop;
 end loop;
 if has_table_privilege('icamp_app','public.permanent_unit_ownership_events','UPDATE')
  or has_table_privilege('icamp_app','public.permanent_unit_buyer_inquiries','UPDATE') then
  raise exception 'Append-only ownership/inquiry records cannot be updated'; end if;
 if not exists(select 1 from pg_trigger where tgname='permanent_unit_listing_validate' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgname='permanent_unit_inquiry_validate' and not tgisinternal) then
  raise exception 'Listing/inquiry gates are missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='permanent_unit_one_approved_listing_idx') then
  raise exception 'One-approved-listing constraint missing'; end if;
end $verify$;
