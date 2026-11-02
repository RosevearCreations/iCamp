-- iCamp Build 060 advisor hardening verification.
do $verify$
declare
  duplicate_count integer;
begin
  select count(*) into duplicate_count
  from (
    select schemaname, tablename, roles, cmd, count(*) as policy_count
    from pg_policies
    where schemaname='public'
      and tablename in (
        'access_zones',
        'access_zone_devices',
        'access_schedules',
        'access_rules'
      )
      and permissive='PERMISSIVE'
    group by schemaname, tablename, roles, cmd
    having count(*) > 1
  ) duplicates;

  if duplicate_count <> 0 then
    raise exception 'Build 060 access-policy tables still have duplicate permissive policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_zones'
      and policyname='access_zones_read'
      and cmd='SELECT'
  ) then
    raise exception 'access_zones read policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_zone_devices'
      and policyname='access_zone_devices_delete'
      and cmd='DELETE'
  ) then
    raise exception 'access_zone_devices delete management policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_schedules'
      and policyname='access_schedules_update'
      and cmd='UPDATE'
  ) then
    raise exception 'access_schedules update management policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='access_rules'
      and policyname='access_rules_create'
      and cmd='INSERT'
  ) then
    raise exception 'access_rules insert management policy is missing';
  end if;
end
$verify$;
