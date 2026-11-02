do $verify_build177$
declare
  p record;
  plan_policy_count integer;
  review_policy_count integer;
begin
  for p in select oid,relname,relrowsecurity,relforcerowsecurity
    from pg_class where oid in (
      'public.guest_arrival_plans'::regclass,
      'public.guest_arrival_staff_reviews'::regclass
    ) loop
    if not p.relrowsecurity or not p.relforcerowsecurity then
      raise exception 'Build 177 %. RLS must be enabled and forced', p.relname;
    end if;
    if exists(select 1 from pg_roles where rolname='anon') then
      if has_table_privilege('anon',p.oid,'SELECT') then
        raise exception 'Build 177 % exposes anonymous reads',p.relname;
      end if;
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      if has_table_privilege('authenticated',p.oid,'SELECT') then
        raise exception 'Build 177 % exposes authenticated client reads',p.relname;
      end if;
    end if;
  end loop;
  select count(*) into plan_policy_count from pg_policies
    where schemaname='public' and tablename='guest_arrival_plans';
  select count(*) into review_policy_count from pg_policies
    where schemaname='public' and tablename='guest_arrival_staff_reviews';
  if plan_policy_count<>3 or review_policy_count<>3 then
    raise exception 'Build 177 owner/staff policy count mismatch: % / %',
      plan_policy_count,review_policy_count;
  end if;
  if not exists(select 1 from pg_constraint where
    conrelid='public.guest_arrival_staff_reviews'::regclass
    and conname='guest_arrival_reviews_plan_owner_fk') then
    raise exception 'Staff receipt must be tied to actual plan and owner';
  end if;
  if not exists(select 1 from pg_trigger where
    tgrelid='public.guest_arrival_plans'::regclass
    and tgname='build177_guard_arrival_plan_identity') then
    raise exception 'Guest plan identity trigger missing';
  end if;
end $verify_build177$;
