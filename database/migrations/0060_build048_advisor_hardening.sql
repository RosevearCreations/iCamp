-- iCamp Build 048 advisor hardening
-- Remove duplicate permissive SELECT policy work, cover Build 048 foreign keys,
-- and make saved-profile identity fields immutable.

drop policy if exists guest_rv_profiles_write on public.guest_rv_profiles;
drop policy if exists guest_vehicle_profiles_write on public.guest_vehicle_profiles;
drop policy if exists guest_pet_profiles_write on public.guest_pet_profiles;

create policy guest_rv_profiles_insert
on public.guest_rv_profiles
for insert
to icamp_app
with check (
  created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_rv_profiles_update
on public.guest_rv_profiles
for update
to icamp_app
using (
  exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
)
with check (
  updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_vehicle_profiles_insert
on public.guest_vehicle_profiles
for insert
to icamp_app
with check (
  created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_vehicle_profiles_update
on public.guest_vehicle_profiles
for update
to icamp_app
using (
  exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
)
with check (
  updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_pet_profiles_insert
on public.guest_pet_profiles
for insert
to icamp_app
with check (
  created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_pet_profiles_update
on public.guest_pet_profiles
for update
to icamp_app
using (
  exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
)
with check (
  updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create or replace function icamp_private.guard_guest_saved_item_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
    or old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.guest_profile_id is distinct from new.guest_profile_id
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at then
    raise exception 'Saved guest stay identity fields are immutable';
  end if;

  return new;
end;
$$;

create trigger guest_rv_profiles_guard_identity
before update on public.guest_rv_profiles
for each row execute function icamp_private.guard_guest_saved_item_identity();

create trigger guest_vehicle_profiles_guard_identity
before update on public.guest_vehicle_profiles
for each row execute function icamp_private.guard_guest_saved_item_identity();

create trigger guest_pet_profiles_guard_identity
before update on public.guest_pet_profiles
for each row execute function icamp_private.guard_guest_saved_item_identity();

create or replace function icamp_private.validate_guest_profile_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_kind text;
begin
  if tg_op = 'UPDATE' then
    if old.id is distinct from new.id
      or old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.created_by_user_id is distinct from new.created_by_user_id
      or old.created_at is distinct from new.created_at then
      raise exception 'Guest profile identity fields are immutable';
    end if;

    if old.user_account_id is not null
      and old.user_account_id is distinct from new.user_account_id then
      raise exception 'A linked guest account cannot be reassigned';
    end if;
  end if;

  if new.user_account_id is not null then
    select account_type
      into account_kind
    from icamp_private.user_accounts
    where id = new.user_account_id;

    if account_kind is distinct from 'guest' then
      raise exception 'Guest profiles may link only to guest accounts';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and (
      old.save_stay_preferences is distinct from new.save_stay_preferences
      or old.allow_staff_profile_lookup is distinct from new.allow_staff_profile_lookup
    ) then
    new.privacy_updated_at = statement_timestamp();
  end if;

  return new;
end;
$$;

create index guest_profiles_user_account_fk_idx
  on public.guest_profiles(user_account_id)
  where user_account_id is not null;

create index guest_profiles_created_by_fk_idx
  on public.guest_profiles(created_by_user_id);

create index guest_profiles_updated_by_fk_idx
  on public.guest_profiles(updated_by_user_id);

create index guest_rv_profiles_scope_guest_fk_idx
  on public.guest_rv_profiles(organization_id,campground_id,guest_profile_id);

create index guest_rv_profiles_created_by_fk_idx
  on public.guest_rv_profiles(created_by_user_id);

create index guest_rv_profiles_updated_by_fk_idx
  on public.guest_rv_profiles(updated_by_user_id);

create index guest_vehicle_profiles_scope_guest_fk_idx
  on public.guest_vehicle_profiles(
    organization_id,
    campground_id,
    guest_profile_id
  );

create index guest_vehicle_profiles_created_by_fk_idx
  on public.guest_vehicle_profiles(created_by_user_id);

create index guest_vehicle_profiles_updated_by_fk_idx
  on public.guest_vehicle_profiles(updated_by_user_id);

create index guest_pet_profiles_scope_guest_fk_idx
  on public.guest_pet_profiles(organization_id,campground_id,guest_profile_id);

create index guest_pet_profiles_created_by_fk_idx
  on public.guest_pet_profiles(created_by_user_id);

create index guest_pet_profiles_updated_by_fk_idx
  on public.guest_pet_profiles(updated_by_user_id);

create index guest_profile_events_scope_guest_fk_idx
  on public.guest_profile_events(
    organization_id,
    campground_id,
    guest_profile_id
  );

create index reservations_guest_profile_scope_fk_idx
  on public.reservations(organization_id,campground_id,guest_profile_id)
  where guest_profile_id is not null;

create index seasonal_assignments_guest_profile_scope_fk_idx
  on public.seasonal_assignments(
    organization_id,
    campground_id,
    guest_profile_id
  )
  where guest_profile_id is not null;
