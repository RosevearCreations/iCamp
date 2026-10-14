-- iCamp Build 039 advisor-hardening verification.
do $verify$
declare
  rate_plan_select_policies integer;
  rate_rule_select_policies integer;
begin
  if to_regclass('public.rate_plans_accommodation_fk_idx') is null then
    raise exception 'rate_plans accommodation FK index missing';
  end if;
  if to_regclass('public.rate_plans_campground_scope_fk_idx') is null then
    raise exception 'rate_plans campground FK index missing';
  end if;
  if to_regclass('public.rate_rules_campground_scope_fk_idx') is null then
    raise exception 'rate_rules campground FK index missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_plans'
      and policyname = 'rate_plans_write'
  ) then
    raise exception 'legacy rate_plans_write policy still exists';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_rules'
      and policyname = 'rate_rules_write'
  ) then
    raise exception 'legacy rate_rules_write policy still exists';
  end if;

  select count(*) into rate_plan_select_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'rate_plans'
    and cmd = 'SELECT';

  select count(*) into rate_rule_select_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'rate_rules'
    and cmd = 'SELECT';

  if rate_plan_select_policies <> 1 then
    raise exception 'rate_plans must have exactly one SELECT policy, found %',
      rate_plan_select_policies;
  end if;
  if rate_rule_select_policies <> 1 then
    raise exception 'rate_rules must have exactly one SELECT policy, found %',
      rate_rule_select_policies;
  end if;

  if has_table_privilege('icamp_app', 'public.rate_plans', 'DELETE') then
    raise exception 'rate_plans must remain non-deletable by icamp_app';
  end if;
  if has_table_privilege('icamp_app', 'public.rate_rules', 'DELETE') then
    raise exception 'rate_rules must remain non-deletable by icamp_app';
  end if;
end
$verify$;
