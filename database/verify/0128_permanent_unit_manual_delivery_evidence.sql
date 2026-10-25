do $verify$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_manual_delivery_receipts','permanent_unit_applicant_acknowledgements','permanent_unit_delivery_exception_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity) then
   raise exception 'Private receipt table lacks FORCE RLS: %',tab; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name)
    and has_table_privilege(role_name,'public.'||tab,'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Data API access to restricted receipt table: % / %',tab,role_name; end if;
  end loop;
  if has_table_privilege('icamp_app','public.'||tab,'UPDATE') or has_table_privilege('icamp_app','public.'||tab,'DELETE') then
   raise exception 'Receipt evidence is mutable: %',tab; end if;
  if not exists(select 1 from pg_trigger where tgname=tab||'_immutable' and not tgisinternal) then
   raise exception 'Append-only trigger absent: %',tab; end if;
 end loop;
 foreach tab in array array['delivery_exception_guard','manual_delivery_receipt_guard','applicant_ack_guard'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='icamp_private' and p.proname=tab and not p.prosecdef) then
   raise exception 'Invoker-only receipt guard missing: %',tab; end if;
 end loop;
end $verify$;
