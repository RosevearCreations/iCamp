-- iCamp Build 057 verification.
do $verify$
declare
  force_rls boolean;
begin
  if to_regclass('public.access_devices') is null then
    raise exception 'access_devices table is missing';
  end if;

  select c.relforcerowsecurity into force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='access_devices';

  if force_rls is distinct from true then
    raise exception 'access_devices must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app','public.access_devices','DELETE') then
    raise exception 'access devices must not be directly deletable';
  end if;

  if not has_table_privilege('icamp_app','public.access_devices','SELECT')
    or not has_table_privilege('icamp_app','public.access_devices','INSERT')
    or not has_table_privilege('icamp_app','public.access_devices','UPDATE') then
    raise exception 'icamp_app access-device grants are incomplete';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='access_devices'
      and indexname='access_devices_parent_controller_idx'
  ) then
    raise exception 'parent controller FK lookup index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='access_devices'
      and indexname='access_devices_provider_reference_unique'
  ) then
    raise exception 'provider device reference uniqueness is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_devices'
      and policyname='access_devices_read'
  ) then
    raise exception 'access device read policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_devices'
      and policyname='access_devices_manage'
  ) then
    raise exception 'access device management policy is missing';
  end if;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='gate.state.read'
  ) then
    raise exception 'gate.state.read permission must exist';
  end if;

  if not exists (
    select 1 from icamp_private.permission_catalog
    where permission_key='campground.configuration'
  ) then
    raise exception 'campground.configuration permission must exist';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.access_devices','SELECT')
      or has_table_privilege('anon','public.access_devices','INSERT')
      or has_table_privilege('anon','public.access_devices','UPDATE') then
      raise exception 'anon direct access-device access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.access_devices','SELECT')
      or has_table_privilege('authenticated','public.access_devices','INSERT')
      or has_table_privilege('authenticated','public.access_devices','UPDATE') then
      raise exception 'authenticated direct access-device access must remain denied';
    end if;
  end if;
end
$verify$;
