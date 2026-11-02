do $verify_build191$
declare t text;
begin
 foreach t in array array['vendor_profiles','vendor_contracts','vendor_recurring_plans','vendor_service_requests','vendor_service_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception 'Build191 % must FORCE RLS',t;end if;
  if has_table_privilege('icamp_app',format('icamp_private.%I',t),'UPDATE')
    or has_table_privilege('icamp_app',format('icamp_private.%I',t),'DELETE')
    or (exists(select 1 from pg_roles where rolname='anon') and has_table_privilege('anon',format('icamp_private.%I',t),'SELECT'))
    or (exists(select 1 from pg_roles where rolname='authenticated') and has_table_privilege('authenticated',format('icamp_private.%I',t),'SELECT')) then
    raise exception 'Build191 vendor evidence grants unsafe: %',t;end if;
  if not exists(select 1 from pg_trigger tr join pg_class c on c.oid=tr.tgrelid
    where c.oid=format('icamp_private.%I',t)::regclass and tr.tgname=t||'_immutable' and not tr.tgisinternal) then
    raise exception 'Build191 immutable evidence trigger missing: %',t;end if;
 end loop;
 if not exists(select 1 from icamp_private.permission_catalog where permission_key='vendor.invoice.review') then
    raise exception 'Build191 independent invoice intake review permission missing';end if;
 if not exists(select 1 from pg_indexes where schemaname='icamp_private'
   and indexname='vendor_service_request_work_order_fk_idx') then raise exception 'Vendor scoped work order FK index missing';end if;
 if not exists(select 1 from pg_trigger where tgrelid='icamp_private.media_assets'::regclass
   and tgname='vendor_media_retention' and not tgisinternal) then raise exception 'Vendor confidential media retention guard missing';end if;
 if not exists(select 1 from pg_policies where schemaname='icamp_private'
  and tablename='vendor_service_events' and cmd='INSERT' and with_check like '%vendor.invoice.review%') then
  raise exception 'Invoice review insert policy missing';end if;
end $verify_build191$;
