-- iCamp Build 051 verification.
do $$
begin
  if to_regclass('public.campground_my_stay_settings') is null then
    raise exception 'Build 051 My Stay settings table missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='campground_my_stay_settings'
      and policyname='campground_my_stay_settings_read'
      and coalesce(qual,'') like '%guest_user_id%'
      and coalesce(qual,'') like '%confirmed%'
      and coalesce(qual,'') like '%checked_in%'
  ) then
    raise exception 'Build 051 guest stay-scoped read policy missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='campground_my_stay_settings'
      and policyname='campground_my_stay_settings_update'
      and coalesce(with_check,'') like '%campground.configuration%'
  ) then
    raise exception 'Build 051 campground configuration update boundary missing';
  end if;

  if exists(select 1 from pg_roles where rolname='anon')
    and has_table_privilege(
      'anon',
      'public.campground_my_stay_settings',
      'select'
    ) then
    raise exception 'anon direct My Stay settings access must remain denied';
  end if;

  if exists(select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege(
      'authenticated',
      'public.campground_my_stay_settings',
      'select'
    ) then
    raise exception 'authenticated direct My Stay settings access must remain denied';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='campground_my_stay_settings_created_by_fk_idx'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='campground_my_stay_settings_updated_by_fk_idx'
  ) then
    raise exception 'Build 051 actor foreign-key indexes incomplete';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='campground_my_stay_settings_scope_fk_idx'
  ) then
    raise exception 'Build 051 campground scope foreign-key index missing';
  end if;
end
$$;
