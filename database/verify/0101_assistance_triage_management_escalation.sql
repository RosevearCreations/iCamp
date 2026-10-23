-- Verify iCamp Build 078 — Assistance Triage & Management Escalation.

do $verify$
declare
  table_name text;
  expected_permission text;
begin
  foreach table_name in array array[
    'camper_assistance_cases',
    'camper_assistance_case_events',
    'camper_assistance_escalations'
  ]
  loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Build 078 table % is missing', table_name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=table_name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Build 078 table % must enable and force RLS', table_name;
    end if;

    if has_table_privilege('anon','public.' || table_name,'SELECT')
       or has_table_privilege('authenticated','public.' || table_name,'SELECT') then
      raise exception 'Build 078 table % exposes direct browser SELECT', table_name;
    end if;
  end loop;

  foreach expected_permission in array array[
    'assistance.triage',
    'assistance.escalate',
    'assistance.communicate',
    'assistance.close'
  ]
  loop
    if not exists (
      select 1
      from icamp_private.permission_catalog p
      where p.permission_key=expected_permission
    ) then
      raise exception 'Build 078 permission % is missing', expected_permission;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='camper_assistance_escalations_active_case_idx'
  ) then
    raise exception 'Build 078 active escalation uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='camper_assistance_case_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 078 append-only event trigger is missing';
  end if;

  if exists (
    select 1
    from public.camper_assistance_requests r
    left join public.camper_assistance_cases c on c.request_id=r.id
    where c.id is null
  ) then
    raise exception 'Build 078 must backfill a case for every assistance request';
  end if;
end
$verify$;
