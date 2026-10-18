-- iCamp Build 056 verification.
do $verify$
declare
  credential_force_rls boolean;
  event_force_rls boolean;
begin
  if to_regclass('public.access_credentials') is null then
    raise exception 'access_credentials table is missing';
  end if;
  if to_regclass('public.access_credential_events') is null then
    raise exception 'access_credential_events table is missing';
  end if;

  select c.relforcerowsecurity into credential_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='access_credentials';

  select c.relforcerowsecurity into event_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='access_credential_events';

  if credential_force_rls is distinct from true
    or event_force_rls is distinct from true then
    raise exception 'Build 056 public tables must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app','public.access_credentials','DELETE') then
    raise exception 'access credentials must not be directly deletable';
  end if;

  if has_table_privilege('icamp_app','public.access_credential_events','UPDATE')
    or has_table_privilege('icamp_app','public.access_credential_events','DELETE') then
    raise exception 'access credential events must remain append-only';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='access_credentials'
      and indexname='access_credentials_subject_idx'
  ) then
    raise exception 'credential subject lookup index is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_credentials'
      and policyname='access_credentials_issue'
  ) then
    raise exception 'credential issue policy is missing';
  end if;

  if not exists (
    select 1 from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id=rp.role_id
    where r.role_kind='template'
      and r.role_code='front_desk'
      and rp.permission_key='access.credential.issue'
  ) then
    raise exception 'front desk must receive access.credential.issue';
  end if;

  if not exists (
    select 1 from icamp_private.role_permissions rp
    join icamp_private.roles r on r.id=rp.role_id
    where r.role_kind='template'
      and r.role_code='campground_manager'
      and rp.permission_key='access.credential.revoke'
  ) then
    raise exception 'campground manager must receive access.credential.revoke';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege('anon','public.access_credentials','SELECT')
      or has_table_privilege('anon','public.access_credentials','INSERT') then
      raise exception 'anon direct credential access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege('authenticated','public.access_credentials','SELECT')
      or has_table_privilege('authenticated','public.access_credentials','INSERT') then
      raise exception 'authenticated direct credential access must remain denied';
    end if;
  end if;
end
$verify$;
