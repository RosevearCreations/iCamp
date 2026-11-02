-- iCamp Build 062 verification.
do $verify$
declare
  name text;
begin
  foreach name in array array[
    'campground_credential_lifecycle_policies',
    'reservation_access_credential_assignments'
  ]
  loop
    if to_regclass('public.' || name) is null then
      raise exception 'Build 062 table % is missing', name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Build 062 table % must enable and FORCE RLS', name;
    end if;
  end loop;

  if has_table_privilege(
    'icamp_app',
    'public.reservation_access_credential_assignments',
    'DELETE'
  ) then
    raise exception 'Credential lifecycle assignments must not be directly deleted';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.access_credential_events'::regclass
      and conname='access_credential_events_event_kind_check'
      and pg_get_constraintdef(oid) like '%validity_extended%'
      and pg_get_constraintdef(oid) like '%replaced%'
  ) then
    raise exception 'Build 062 credential lifecycle event kinds are missing';
  end if;

  if to_regclass(
    'public.reservation_access_credential_assignments_reservation_idx'
  ) is null
    or to_regclass(
      'public.reservation_access_credential_assignments_check_in_idx'
    ) is null
    or to_regclass(
      'public.reservation_access_credential_assignments_provisioned_by_idx'
    ) is null then
    raise exception 'Build 062 scoped lifecycle indexes are missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='reservation_access_credential_assignments'
      and policyname='reservation_access_credential_assignments_insert'
  ) then
    raise exception 'Credential lifecycle issuance policy is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon') then
    if has_table_privilege(
      'anon',
      'public.reservation_access_credential_assignments',
      'SELECT'
    ) then
      raise exception 'anon direct credential lifecycle access must remain denied';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated') then
    if has_table_privilege(
      'authenticated',
      'public.reservation_access_credential_assignments',
      'SELECT'
    ) then
      raise exception 'authenticated direct credential lifecycle access must remain denied';
    end if;
  end if;
end
$verify$;
