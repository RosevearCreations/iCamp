-- iCamp Build 033 verification.
do $verify$
declare
  rules_rls boolean;
  rules_force boolean;
begin
  if to_regclass('public.capacity_limit_rules') is null then
    raise exception 'capacity_limit_rules table is missing';
  end if;

  select relrowsecurity, relforcerowsecurity
    into rules_rls, rules_force
  from pg_class
  where oid = 'public.capacity_limit_rules'::regclass;

  if not rules_rls or not rules_force then
    raise exception 'capacity_limit_rules must enable and force RLS';
  end if;

  if has_table_privilege('icamp_app', 'public.capacity_limit_rules', 'DELETE') then
    raise exception 'capacity_limit_rules must not be deletable by icamp_app';
  end if;

  if to_regclass('public.capacity_limit_rules_scope_idx') is null
    or to_regclass('public.capacity_limit_rules_section_fk_idx') is null
    or to_regclass('public.capacity_limit_rules_accommodation_fk_idx') is null
    or to_regclass('public.capacity_limit_rules_type_idx') is null
    or to_regclass('public.capacity_limit_rules_created_by_fk_idx') is null
    or to_regclass('public.capacity_limit_rules_updated_by_fk_idx') is null
  then
    raise exception 'Build 033 foreign-key/query indexes are incomplete';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.capacity_limit_rules'::regclass
      and tgname = 'capacity_limit_rules_guard_mutation'
      and not tgisinternal
  ) then
    raise exception 'capacity append-preservation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.capacity_limit_rules'::regclass
      and tgname = 'capacity_limit_rules_no_ambiguity'
      and not tgisinternal
  ) then
    raise exception 'capacity ambiguity trigger is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'capacity_limit_rules'
      and policyname = 'capacity_limit_rules_read'
  ) then
    raise exception 'capacity rules read policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'capacity_limit_rules'
      and policyname = 'capacity_limit_rules_insert'
  ) then
    raise exception 'capacity rules insert policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'capacity_limit_rules'
      and policyname = 'capacity_limit_rules_archive'
  ) then
    raise exception 'capacity rules archive policy is missing';
  end if;
end
$verify$;
