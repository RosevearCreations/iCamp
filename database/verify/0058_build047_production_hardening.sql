-- iCamp Build 047 production-hardening verification.
do $build047_hardening_verify$
declare
  rate_kind_constraint text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='seasonal_assignments'
      and column_name='winterization_required'
  ) then
    raise exception 'Build 047 winterization handoff flag missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='seasonal_assignment_events'
      and column_name='source_channel'
  ) then
    raise exception 'Build 047 lifecycle source channel missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='seasonal_assignments_guard_identity'
      and not tgisinternal
  ) then
    raise exception 'Build 047 immutable assignment identity trigger missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='seasonal_assignment_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 047 lifecycle evidence must remain append-only';
  end if;

  if has_table_privilege('icamp_app','public.seasonal_assignment_events','update')
    or has_table_privilege('icamp_app','public.seasonal_assignment_events','delete') then
    raise exception 'Build 047 lifecycle evidence must not be mutable by icamp_app';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='seasonal_assignments'
      and policyname='seasonal_assignments_write'
      and coalesce(with_check,'') like '%seasonal.manage%'
  ) then
    raise exception 'Build 047 seasonal.manage assignment policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='seasonal_assignment_events'
      and policyname='seasonal_assignment_events_write'
      and coalesce(with_check,'') like '%seasonal.manage%'
  ) then
    raise exception 'Build 047 seasonal.manage lifecycle-event policy missing';
  end if;

  select pg_get_constraintdef(oid)
  into rate_kind_constraint
  from pg_constraint
  where conrelid='public.rate_plans'::regclass
    and conname='rate_plans_accommodation_kind_check';

  if rate_kind_constraint is null
    or position('permanent_unit' in rate_kind_constraint) = 0 then
    raise exception 'Build 047 permanent-unit rate-plan integration missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='seasonal_assignments_no_live_conflict'
      and not tgisinternal
  ) then
    raise exception 'Build 035 seasonal availability authority missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
    and has_table_privilege(
      'anon',
      'public.seasonal_assignment_events',
      'select'
    ) then
    raise exception 'anon direct lifecycle access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege(
      'authenticated',
      'public.seasonal_assignment_events',
      'select'
    ) then
    raise exception 'authenticated direct lifecycle access must remain denied';
  end if;
end
$build047_hardening_verify$;
