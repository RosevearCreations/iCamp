-- iCamp Build 047 verification
do $build047_verify$
begin
  if to_regclass('public.seasonal_assignments') is null then
    raise exception 'seasonal_assignments missing';
  end if;
  if to_regclass('public.seasonal_assignment_events') is null then
    raise exception 'seasonal_assignment_events missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='seasonal_assignments'
      and column_name='assignment_kind'
  ) then raise exception 'assignment_kind missing'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='seasonal_assignments'
      and column_name='charge_amount_cents'
  ) then raise exception 'charge snapshot missing'; end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='seasonal_assignment_events'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'seasonal_assignment_events must FORCE RLS'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='seasonal_assignments_no_live_conflict' and not tgisinternal
  ) then raise exception 'Build 035 seasonal availability conflict authority missing'; end if;
end
$build047_verify$;
