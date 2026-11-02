-- Verify iCamp Build 078 advisor hardening.

do $verify$
declare
  table_name text;
  policy_count integer;
begin
  foreach table_name in array array[
    'camper_assistance_requests',
    'camper_assistance_request_events',
    'camper_assistance_request_media'
  ]
  loop
    select count(*)
    into policy_count
    from pg_policies
    where schemaname='public'
      and tablename=table_name
      and roles @> array['icamp_app']::name[]
      and cmd='SELECT';

    if policy_count <> 1 then
      raise exception
        'Build 078 expected one icamp_app SELECT policy on %, found %',
        table_name,
        policy_count;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname='public'
      and policyname like '%build078_staff_read%'
  ) then
    raise exception 'Build 078 duplicate staff-read policies remain';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='camper_assistance_requests'
      and policyname='camper_assistance_requests_read'
      and qual like '%assistance.triage%'
      and qual like '%assistance.close%'
  ) then
    raise exception 'Build 078 consolidated request read policy is incomplete';
  end if;
end
$verify$;
