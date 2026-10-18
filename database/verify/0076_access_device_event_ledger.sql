-- iCamp Build 058 verification.
do $verify$
declare
  device_force_rls boolean;
  access_force_rls boolean;
begin
  if to_regclass('public.access_device_events') is null then
    raise exception 'access_device_events table is missing';
  end if;
  if to_regclass('public.access_events') is null then
    raise exception 'access_events table is missing';
  end if;

  select c.relforcerowsecurity into device_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='access_device_events';

  select c.relforcerowsecurity into access_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='access_events';

  if device_force_rls is distinct from true
    or access_force_rls is distinct from true then
    raise exception 'Build 058 ledgers must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app','public.access_device_events','UPDATE')
    or has_table_privilege('icamp_app','public.access_device_events','DELETE')
    or has_table_privilege('icamp_app','public.access_events','UPDATE')
    or has_table_privilege('icamp_app','public.access_events','DELETE') then
    raise exception 'Build 058 ledgers must remain append-only';
  end if;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='access.events.record'
  ) then
    raise exception 'access.events.record permission is missing';
  end if;

  if not exists (
    select 1
    from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id=rp.role_id
    where r.role_kind='template'
      and r.role_code='security'
      and rp.permission_key='access.events.record'
  ) then
    raise exception 'security role must receive access.events.record';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='access_device_events'
      and indexname='access_device_events_scope_device_fk_idx'
  ) then
    raise exception 'access-device event scoped FK index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='access_events'
      and indexname='access_events_scope_credential_fk_idx'
  ) then
    raise exception 'access-event credential FK index is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_events'
      and policyname='access_events_append'
  ) then
    raise exception 'access-event append policy is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.access_device_events','SELECT')
      or has_table_privilege('anon','public.access_events','SELECT') then
      raise exception 'anon direct Build 058 ledger access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.access_device_events','SELECT')
      or has_table_privilege('authenticated','public.access_events','SELECT') then
      raise exception 'authenticated direct Build 058 ledger access must remain denied';
    end if;
  end if;
end
$verify$;
