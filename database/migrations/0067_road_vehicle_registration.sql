-- iCamp Build 053
-- Road Vehicle Registration.

create table public.road_vehicle_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid,
  guest_profile_id uuid,
  guest_vehicle_profile_id uuid
    references public.guest_vehicle_profiles(id)
    on update cascade
    on delete restrict,
  host_accommodation_id uuid not null,
  host_accommodation_label text not null
    check (char_length(trim(host_accommodation_label)) between 1 and 200),
  vehicle_kind text not null
    check (
      vehicle_kind in (
        'car',
        'truck',
        'suv',
        'van',
        'motorcycle',
        'tow_vehicle',
        'other'
      )
    ),
  plate_number text not null
    check (
      char_length(trim(plate_number)) between 1 and 24
      and plate_number = upper(plate_number)
    ),
  plate_jurisdiction text not null
    check (
      char_length(trim(plate_jurisdiction)) between 1 and 40
      and plate_jurisdiction = upper(plate_jurisdiction)
    ),
  vehicle_description text not null
    check (char_length(trim(vehicle_description)) between 2 and 240),
  registered_owner_name text not null
    check (char_length(trim(registered_owner_name)) between 2 and 160),
  primary_driver_name text not null
    check (char_length(trim(primary_driver_name)) between 2 and 160),
  valid_from date not null,
  valid_until date not null,
  registration_status text not null default 'active'
    check (registration_status in ('active','revoked')),
  revoked_at timestamptz,
  revocation_reason text
    check (
      revocation_reason is null
      or char_length(trim(revocation_reason)) between 3 and 500
    ),
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','system')),
  notes text
    check (notes is null or char_length(notes) <= 2000),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 8 and 200),
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  updated_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint road_vehicle_registrations_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint road_vehicle_registrations_idempotency_unique
    unique (campground_id,idempotency_key),
  constraint road_vehicle_registrations_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint road_vehicle_registrations_guest_profile_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint road_vehicle_registrations_host_accommodation_fk
    foreign key (organization_id,campground_id,host_accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint road_vehicle_registrations_validity_check
    check (valid_until >= valid_from),
  constraint road_vehicle_registrations_revocation_shape_check
    check (
      (
        registration_status = 'active'
        and revoked_at is null
        and revocation_reason is null
      )
      or
      (
        registration_status = 'revoked'
        and revoked_at is not null
        and revocation_reason is not null
      )
    )
);

create index road_vehicle_registrations_list_idx
  on public.road_vehicle_registrations(
    campground_id,
    registration_status,
    valid_until,
    created_at desc
  );

create index road_vehicle_registrations_reservation_fk_idx
  on public.road_vehicle_registrations(
    organization_id,
    campground_id,
    reservation_id
  )
  where reservation_id is not null;

create index road_vehicle_registrations_guest_profile_fk_idx
  on public.road_vehicle_registrations(
    organization_id,
    campground_id,
    guest_profile_id
  )
  where guest_profile_id is not null;

create index road_vehicle_registrations_guest_vehicle_fk_idx
  on public.road_vehicle_registrations(guest_vehicle_profile_id)
  where guest_vehicle_profile_id is not null;

create index road_vehicle_registrations_host_accommodation_fk_idx
  on public.road_vehicle_registrations(
    organization_id,
    campground_id,
    host_accommodation_id
  );

create index road_vehicle_registrations_created_by_fk_idx
  on public.road_vehicle_registrations(created_by_user_id);

create index road_vehicle_registrations_updated_by_fk_idx
  on public.road_vehicle_registrations(updated_by_user_id);

create table public.road_vehicle_registration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  registration_id uuid not null,
  event_kind text not null
    check (event_kind in ('registered','revoked')),
  prior_status text
    check (prior_status is null or prior_status in ('active','revoked')),
  new_status text not null
    check (new_status in ('active','revoked')),
  reason text
    check (reason is null or char_length(trim(reason)) between 3 and 500),
  source_channel text not null
    check (source_channel in ('web','staff','ivr','sms','system')),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint road_vehicle_registration_events_registration_fk
    foreign key (organization_id,campground_id,registration_id)
    references public.road_vehicle_registrations(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict
);

create index road_vehicle_registration_events_registration_fk_idx
  on public.road_vehicle_registration_events(
    organization_id,
    campground_id,
    registration_id,
    occurred_at desc
  );

create index road_vehicle_registration_events_actor_fk_idx
  on public.road_vehicle_registration_events(actor_user_id,occurred_at desc);

create or replace function icamp_private.validate_road_vehicle_registration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reservation_accommodation_id uuid;
  reservation_guest_profile_id uuid;
  saved_vehicle_guest_profile_id uuid;
  saved_vehicle_campground_id uuid;
  saved_vehicle_state text;
begin
  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.reservation_id is distinct from new.reservation_id
      or old.guest_profile_id is distinct from new.guest_profile_id
      or old.guest_vehicle_profile_id is distinct from new.guest_vehicle_profile_id
      or old.host_accommodation_id is distinct from new.host_accommodation_id
      or old.host_accommodation_label is distinct from new.host_accommodation_label
      or old.vehicle_kind is distinct from new.vehicle_kind
      or old.plate_number is distinct from new.plate_number
      or old.plate_jurisdiction is distinct from new.plate_jurisdiction
      or old.vehicle_description is distinct from new.vehicle_description
      or old.registered_owner_name is distinct from new.registered_owner_name
      or old.primary_driver_name is distinct from new.primary_driver_name
      or old.valid_from is distinct from new.valid_from
      or old.valid_until is distinct from new.valid_until
      or old.idempotency_key is distinct from new.idempotency_key then
      raise exception 'Road vehicle registration identity and validity are immutable; revoke and re-register instead';
    end if;

    if old.registration_status = 'revoked'
      and new.registration_status is distinct from old.registration_status then
      raise exception 'A revoked road vehicle registration cannot be reactivated';
    end if;
  end if;

  if new.reservation_id is not null then
    select r.accommodation_id,r.guest_profile_id
      into reservation_accommodation_id,reservation_guest_profile_id
    from public.reservations r
    where r.organization_id = new.organization_id
      and r.campground_id = new.campground_id
      and r.id = new.reservation_id
      and r.status in ('pending','confirmed','checked_in');

    if not found then
      raise exception 'Road vehicle reservation is not active in this campground';
    end if;

    if reservation_accommodation_id is distinct from new.host_accommodation_id then
      raise exception 'Road vehicle host accommodation must match the linked reservation';
    end if;

    if new.guest_profile_id is not null
      and reservation_guest_profile_id is not null
      and new.guest_profile_id is distinct from reservation_guest_profile_id then
      raise exception 'Road vehicle guest profile must match the linked reservation';
    end if;
  end if;

  if new.guest_vehicle_profile_id is not null then
    select v.guest_profile_id,v.campground_id,v.profile_state
      into saved_vehicle_guest_profile_id,saved_vehicle_campground_id,saved_vehicle_state
    from public.guest_vehicle_profiles v
    where v.id = new.guest_vehicle_profile_id;

    if not found
      or saved_vehicle_campground_id is distinct from new.campground_id
      or saved_vehicle_state is distinct from 'active' then
      raise exception 'Saved vehicle profile is not active in this campground';
    end if;

    if new.guest_profile_id is null
      or new.guest_profile_id is distinct from saved_vehicle_guest_profile_id then
      raise exception 'Saved vehicle profile must belong to the registered guest profile';
    end if;
  end if;

  return new;
end;
$$;

create trigger road_vehicle_registrations_validate
before insert or update on public.road_vehicle_registrations
for each row execute function icamp_private.validate_road_vehicle_registration();

create trigger road_vehicle_registrations_touch_row
before update on public.road_vehicle_registrations
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_road_vehicle_registration_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Road vehicle registration events are append-only';
end;
$$;

create trigger road_vehicle_registration_events_append_only
before update or delete on public.road_vehicle_registration_events
for each row execute function icamp_private.guard_road_vehicle_registration_event();

alter table public.road_vehicle_registrations enable row level security;
alter table public.road_vehicle_registrations force row level security;
alter table public.road_vehicle_registration_events enable row level security;
alter table public.road_vehicle_registration_events force row level security;

revoke all on
  public.road_vehicle_registrations,
  public.road_vehicle_registration_events
from public;

do $build053_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.road_vehicle_registrations, public.road_vehicle_registration_events from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.road_vehicle_registrations, public.road_vehicle_registration_events from authenticated';
  end if;
end
$build053_direct_roles$;

grant select,insert,update on public.road_vehicle_registrations to icamp_app;
grant select,insert on public.road_vehicle_registration_events to icamp_app;

create policy road_vehicle_registrations_read
on public.road_vehicle_registrations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.register')
);

create policy road_vehicle_registrations_insert
on public.road_vehicle_registrations
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'vehicle.register')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy road_vehicle_registrations_update
on public.road_vehicle_registrations
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.register')
)
with check (
  icamp_private.has_campground_permission(campground_id,'vehicle.register')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy road_vehicle_registration_events_read
on public.road_vehicle_registration_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.register')
);

create policy road_vehicle_registration_events_insert
on public.road_vehicle_registration_events
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'vehicle.register')
  and actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.road_vehicle_registrations is
  'Build 053 formal road-vehicle registration for campground-hosted cars, trucks, SUVs, vans, motorcycles and tow vehicles. Build 054 remains authoritative for non-stay day/week passes and extra-vehicle fees.';

comment on table public.road_vehicle_registration_events is
  'Build 053 append-only road-vehicle registration lifecycle evidence.';

comment on column public.road_vehicle_registrations.guest_vehicle_profile_id is
  'Optional link to a Build 048 reusable vehicle description. Plate/jurisdiction remain registration-only evidence and are never written back to the saved profile.';

comment on column public.road_vehicle_registrations.registration_status is
  'Administrative status. A still-active row is effectively expired after valid_until in the campground local date.';
