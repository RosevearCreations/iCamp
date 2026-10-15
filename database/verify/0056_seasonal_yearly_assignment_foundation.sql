-- iCamp Build 047 verification.
do $verify$
declare
  force_rls_count integer;
  kind_constraint text;
begin
  if to_regclass('public.seasonal_assignments') is null then
    raise exception 'seasonal_assignments missing';
  end if;
  if to_regclass('public.seasonal_assignment_charges') is null then
    raise exception 'seasonal_assignment_charges missing';
  end if;
  if to_regclass('public.seasonal_assignment_events') is null then
    raise exception 'seasonal_assignment_events missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='seasonal_assignments'
      and column_name='assignment_kind'
  ) then
    raise exception 'assignment_kind missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='seasonal_assignments'
      and column_name='winterization_required'
  ) then
    raise exception 'winterization_required handoff missing';
  end if;

  select count(*) into force_rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'seasonal_assignments',
      'seasonal_assignment_charges',
      'seasonal_assignment_events'
    )
    and c.relrowsecurity
    and c.relforcerowsecurity;

  if force_rls_count <> 3 then
    raise exception 'Build 047 tables must FORCE RLS';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='seasonal_assignment_charges_append_only'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname='seasonal_assignment_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 047 evidence must remain append-only';
  end if;

  if has_table_privilege('icamp_app','public.seasonal_assignment_charges','update')
    or has_table_privilege('icamp_app','public.seasonal_assignment_charges','delete')
    or has_table_privilege('icamp_app','public.seasonal_assignment_events','update')
    or has_table_privilege('icamp_app','public.seasonal_assignment_events','delete') then
    raise exception 'Build 047 immutable evidence must not be mutable by icamp_app';
  end if;

  if not has_table_privilege('icamp_app','public.seasonal_assignment_charges','insert')
    or not has_table_privilege('icamp_app','public.seasonal_assignment_events','insert') then
    raise exception 'Build 047 evidence insert grants are missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
    and (
      has_table_privilege('anon','public.seasonal_assignment_charges','select')
      or has_table_privilege('anon','public.seasonal_assignment_events','select')
    ) then
    raise exception 'anon direct access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
    and (
      has_table_privilege('authenticated','public.seasonal_assignment_charges','select')
      or has_table_privilege('authenticated','public.seasonal_assignment_events','select')
    ) then
    raise exception 'direct authenticated access must remain denied';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.seasonal_assignments'::regclass
      and conname='seasonal_assignments_scope_id_unique'
  ) then
    raise exception 'seasonal assignment future-integration scope key missing';
  end if;

  select pg_get_constraintdef(oid)
    into kind_constraint
  from pg_constraint
  where conrelid='public.rate_plans'::regclass
    and conname='rate_plans_accommodation_kind_check';

  if kind_constraint is null or position('permanent_unit' in kind_constraint) = 0 then
    raise exception 'rate plans must support permanent-unit long-term pricing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='seasonal_assignments'
      and policyname='seasonal_assignments_write'
      and coalesce(with_check,'') like '%seasonal.manage%'
  ) then
    raise exception 'seasonal.manage write policy missing';
  end if;
end
$verify$;
