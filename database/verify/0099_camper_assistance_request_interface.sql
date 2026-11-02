-- Verify iCamp Build 077 — Camper Assistance Request Interface.

do $verify$
declare
  target_table text;
  forced boolean;
begin
  foreach target_table in array array[
    'camper_assistance_requests',
    'camper_assistance_request_events',
    'camper_assistance_request_media'
  ]
  loop
    if to_regclass('public.' || target_table) is null then
      raise exception 'Build 077 table % is missing', target_table;
    end if;

    select c.relrowsecurity and c.relforcerowsecurity
    into forced
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=target_table;

    if forced is distinct from true then
      raise exception 'Build 077 table % must force RLS', target_table;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conname='camper_assistance_requests_client_unique'
  ) then
    raise exception 'Build 077 idempotency constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='camper_assistance_requests_validate'
      and not tgisinternal
  ) then
    raise exception 'Build 077 active-stay validation trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='camper_assistance_requests'
      and policyname='camper_assistance_requests_insert'
  ) then
    raise exception 'Build 077 guest insert policy is missing';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grants
    where grants.table_schema='public'
      and grants.table_name in (
        'camper_assistance_requests',
        'camper_assistance_request_events',
        'camper_assistance_request_media'
      )
      and grants.grantee in ('anon','authenticated')
  ) then
    raise exception 'Build 077 must not grant direct Data API access';
  end if;
end
$verify$;
