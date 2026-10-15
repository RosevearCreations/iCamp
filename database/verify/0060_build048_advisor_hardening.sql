-- iCamp Build 048 advisor hardening verification
do $$
declare
  duplicate_policy_count integer;
  required_index_count integer;
begin
  if exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename in (
        'guest_rv_profiles',
        'guest_vehicle_profiles',
        'guest_pet_profiles'
      )
      and policyname in (
        'guest_rv_profiles_write',
        'guest_vehicle_profiles_write',
        'guest_pet_profiles_write'
      )
  ) then
    raise exception 'Legacy Build 048 FOR ALL saved-item policies still exist';
  end if;

  select count(*)
    into duplicate_policy_count
  from pg_policies
  where schemaname='public'
    and tablename in (
      'guest_rv_profiles',
      'guest_vehicle_profiles',
      'guest_pet_profiles'
    )
    and cmd='SELECT';

  if duplicate_policy_count <> 3 then
    raise exception 'Each saved-item table must have exactly one SELECT policy';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='guest_rv_profiles_guard_identity'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgname='guest_vehicle_profiles_guard_identity'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgname='guest_pet_profiles_guard_identity'
      and not tgisinternal
  ) then
    raise exception 'Saved guest stay identity guards are incomplete';
  end if;

  select count(*)
    into required_index_count
  from pg_indexes
  where schemaname='public'
    and indexname in (
      'guest_profiles_user_account_fk_idx',
      'guest_profiles_created_by_fk_idx',
      'guest_profiles_updated_by_fk_idx',
      'guest_rv_profiles_scope_guest_fk_idx',
      'guest_rv_profiles_created_by_fk_idx',
      'guest_rv_profiles_updated_by_fk_idx',
      'guest_vehicle_profiles_scope_guest_fk_idx',
      'guest_vehicle_profiles_created_by_fk_idx',
      'guest_vehicle_profiles_updated_by_fk_idx',
      'guest_pet_profiles_scope_guest_fk_idx',
      'guest_pet_profiles_created_by_fk_idx',
      'guest_pet_profiles_updated_by_fk_idx',
      'guest_profile_events_scope_guest_fk_idx',
      'reservations_guest_profile_scope_fk_idx',
      'seasonal_assignments_guest_profile_scope_fk_idx'
    );

  if required_index_count <> 15 then
    raise exception 'Build 048 foreign-key covering indexes are incomplete';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='guest_rv_profiles'
      and policyname='guest_rv_profiles_insert'
      and cmd='INSERT'
  ) or not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='guest_rv_profiles'
      and policyname='guest_rv_profiles_update'
      and cmd='UPDATE'
  ) then
    raise exception 'Precise RV insert/update policies are missing';
  end if;
end
$$;
