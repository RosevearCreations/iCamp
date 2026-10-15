-- iCamp Build 048
-- Guest Profiles & Saved Stay Information.

create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  user_account_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  first_name text not null
    check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null
    check (char_length(trim(last_name)) between 1 and 80),
  preferred_name text
    check (
      preferred_name is null
      or char_length(trim(preferred_name)) between 1 and 80
    ),
  contact_email text
    check (
      contact_email is null
      or char_length(trim(contact_email)) between 3 and 254
    ),
  contact_phone text
    check (
      contact_phone is null
      or char_length(trim(contact_phone)) between 7 and 40
    ),
  preferred_contact_channel text not null default 'email'
    check (preferred_contact_channel in ('email','sms','phone','none')),
  save_stay_preferences boolean not null default true,
  allow_staff_profile_lookup boolean not null default true,
  profile_state text not null default 'active'
    check (profile_state in ('active','archived')),
  archived_at timestamptz,
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
  privacy_updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint guest_profiles_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint guest_profiles_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict,
  constraint guest_profiles_archive_state_check
    check (
      (profile_state = 'archived' and archived_at is not null)
      or (profile_state = 'active' and archived_at is null)
    )
);

create unique index guest_profiles_account_campground_uidx
  on public.guest_profiles(campground_id,user_account_id)
  where user_account_id is not null;

create index guest_profiles_lookup_idx
  on public.guest_profiles(
    campground_id,
    profile_state,
    allow_staff_profile_lookup,
    last_name,
    first_name
  );

create index guest_profiles_email_idx
  on public.guest_profiles(campground_id,lower(contact_email))
  where contact_email is not null;

create table public.guest_rv_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  guest_profile_id uuid not null,
  nickname text not null
    check (char_length(trim(nickname)) between 1 and 80),
  rv_kind text not null
    check (
      rv_kind in (
        'motorhome',
        'travel_trailer',
        'fifth_wheel',
        'pop_up',
        'truck_camper',
        'other'
      )
    ),
  make text,
  model text,
  model_year smallint
    check (model_year is null or model_year between 1900 and 2200),
  length_feet numeric(6,2)
    check (length_feet is null or length_feet between 1 and 120),
  slide_out_count smallint not null default 0
    check (slide_out_count between 0 and 12),
  electrical_service_amps smallint
    check (
      electrical_service_amps is null
      or electrical_service_amps in (15,30,50)
    ),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  profile_state text not null default 'active'
    check (profile_state in ('active','archived')),
  archived_at timestamptz,
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
  constraint guest_rv_profiles_guest_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint guest_rv_profiles_archive_state_check
    check (
      (profile_state = 'archived' and archived_at is not null)
      or (profile_state = 'active' and archived_at is null)
    )
);

create index guest_rv_profiles_guest_idx
  on public.guest_rv_profiles(guest_profile_id,profile_state,updated_at desc);

create table public.guest_vehicle_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  guest_profile_id uuid not null,
  nickname text not null
    check (char_length(trim(nickname)) between 1 and 80),
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
  make text,
  model text,
  color text,
  model_year smallint
    check (model_year is null or model_year between 1900 and 2200),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  profile_state text not null default 'active'
    check (profile_state in ('active','archived')),
  archived_at timestamptz,
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
  constraint guest_vehicle_profiles_guest_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint guest_vehicle_profiles_archive_state_check
    check (
      (profile_state = 'archived' and archived_at is not null)
      or (profile_state = 'active' and archived_at is null)
    )
);

create index guest_vehicle_profiles_guest_idx
  on public.guest_vehicle_profiles(
    guest_profile_id,
    profile_state,
    updated_at desc
  );

create table public.guest_pet_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  guest_profile_id uuid not null,
  name text not null
    check (char_length(trim(name)) between 1 and 80),
  species text not null
    check (species in ('dog','cat','bird','other')),
  breed text,
  weight_kg numeric(6,2)
    check (weight_kg is null or weight_kg between 0.1 and 250),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  profile_state text not null default 'active'
    check (profile_state in ('active','archived')),
  archived_at timestamptz,
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
  constraint guest_pet_profiles_guest_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint guest_pet_profiles_archive_state_check
    check (
      (profile_state = 'archived' and archived_at is not null)
      or (profile_state = 'active' and archived_at is null)
    )
);

create index guest_pet_profiles_guest_idx
  on public.guest_pet_profiles(guest_profile_id,profile_state,updated_at desc);

create table public.guest_profile_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  guest_profile_id uuid not null,
  event_kind text not null
    check (
      event_kind in (
        'profile_created',
        'profile_updated',
        'privacy_updated',
        'account_linked',
        'rv_saved',
        'vehicle_saved',
        'pet_saved',
        'saved_item_archived',
        'reservation_linked',
        'seasonal_assignment_linked'
      )
    ),
  source_channel text not null
    check (source_channel in ('web','staff','ivr','sms','import','system')),
  summary text not null
    check (char_length(trim(summary)) between 3 and 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint guest_profile_events_guest_fk
    foreign key (organization_id,campground_id,guest_profile_id)
    references public.guest_profiles(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index guest_profile_events_guest_idx
  on public.guest_profile_events(guest_profile_id,occurred_at desc);

create index guest_profile_events_actor_idx
  on public.guest_profile_events(actor_user_id,occurred_at desc);

alter table public.reservations
  add column guest_profile_id uuid;

alter table public.reservations
  add constraint reservations_guest_profile_fk
  foreign key (organization_id,campground_id,guest_profile_id)
  references public.guest_profiles(organization_id,campground_id,id)
  on update cascade
  on delete restrict;

create index reservations_guest_profile_idx
  on public.reservations(guest_profile_id,arrival_date desc)
  where guest_profile_id is not null;

alter table public.seasonal_assignments
  add column guest_profile_id uuid;

alter table public.seasonal_assignments
  add constraint seasonal_assignments_guest_profile_fk
  foreign key (organization_id,campground_id,guest_profile_id)
  references public.guest_profiles(organization_id,campground_id,id)
  on update cascade
  on delete restrict;

create index seasonal_assignments_guest_profile_idx
  on public.seasonal_assignments(guest_profile_id,starts_on desc)
  where guest_profile_id is not null;

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
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id then
      raise exception 'Guest profile campground scope is immutable';
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

create trigger guest_profiles_validate_identity
before insert or update on public.guest_profiles
for each row execute function icamp_private.validate_guest_profile_identity();

create trigger guest_profiles_touch_row
before update on public.guest_profiles
for each row execute function icamp_private.touch_row();

create trigger guest_rv_profiles_touch_row
before update on public.guest_rv_profiles
for each row execute function icamp_private.touch_row();

create trigger guest_vehicle_profiles_touch_row
before update on public.guest_vehicle_profiles
for each row execute function icamp_private.touch_row();

create trigger guest_pet_profiles_touch_row
before update on public.guest_pet_profiles
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_guest_profile_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Guest profile evidence is append-only';
end;
$$;

create trigger guest_profile_events_append_only
before update or delete on public.guest_profile_events
for each row execute function icamp_private.guard_guest_profile_event();

create or replace function icamp_private.validate_reservation_guest_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile_user_id uuid;
begin
  if new.guest_profile_id is null then
    return new;
  end if;

  select user_account_id
    into profile_user_id
  from public.guest_profiles
  where organization_id = new.organization_id
    and campground_id = new.campground_id
    and id = new.guest_profile_id;

  if not found then
    raise exception 'Reservation guest profile is outside reservation scope';
  end if;

  if new.guest_user_id is not null
    and profile_user_id is not null
    and new.guest_user_id is distinct from profile_user_id then
    raise exception 'Reservation guest account does not match linked guest profile';
  end if;

  return new;
end;
$$;

create trigger reservations_validate_guest_profile
before insert or update of guest_profile_id,guest_user_id
on public.reservations
for each row execute function icamp_private.validate_reservation_guest_profile();

alter table public.guest_profiles enable row level security;
alter table public.guest_profiles force row level security;
alter table public.guest_rv_profiles enable row level security;
alter table public.guest_rv_profiles force row level security;
alter table public.guest_vehicle_profiles enable row level security;
alter table public.guest_vehicle_profiles force row level security;
alter table public.guest_pet_profiles enable row level security;
alter table public.guest_pet_profiles force row level security;
alter table public.guest_profile_events enable row level security;
alter table public.guest_profile_events force row level security;

revoke all on
  public.guest_profiles,
  public.guest_rv_profiles,
  public.guest_vehicle_profiles,
  public.guest_pet_profiles,
  public.guest_profile_events
from public;

do $build048_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.guest_profiles, public.guest_rv_profiles, public.guest_vehicle_profiles, public.guest_pet_profiles, public.guest_profile_events from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.guest_profiles, public.guest_rv_profiles, public.guest_vehicle_profiles, public.guest_pet_profiles, public.guest_profile_events from authenticated';
  end if;
end
$build048_direct_roles$;

grant select,insert,update on
  public.guest_profiles,
  public.guest_rv_profiles,
  public.guest_vehicle_profiles,
  public.guest_pet_profiles
to icamp_app;

grant select,insert on public.guest_profile_events to icamp_app;

create policy guest_profiles_read
on public.guest_profiles
for select
to icamp_app
using (
  user_account_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  or icamp_private.has_campground_permission(campground_id,'guest.read')
  or icamp_private.has_campground_permission(campground_id,'guest.manage')
);

create policy guest_profiles_insert
on public.guest_profiles
for insert
to icamp_app
with check (
  (
    user_account_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and created_by_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and updated_by_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
  )
  or (
    icamp_private.has_campground_permission(campground_id,'guest.manage')
    and created_by_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and updated_by_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
  )
);

create policy guest_profiles_update
on public.guest_profiles
for update
to icamp_app
using (
  user_account_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  or icamp_private.has_campground_permission(campground_id,'guest.manage')
)
with check (
  (
    user_account_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
    or icamp_private.has_campground_permission(campground_id,'guest.manage')
  )
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy guest_rv_profiles_read
on public.guest_rv_profiles
for select
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
        or icamp_private.has_campground_permission(campground_id,'guest.read')
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_rv_profiles_write
on public.guest_rv_profiles
for all
to icamp_app
using (
  exists (
    select 1 from public.guest_profiles g
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
  and created_by_user_id is not null
  and exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_vehicle_profiles_read
on public.guest_vehicle_profiles
for select
to icamp_app
using (
  exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.read')
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_vehicle_profiles_write
on public.guest_vehicle_profiles
for all
to icamp_app
using (
  exists (
    select 1 from public.guest_profiles g
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
  and created_by_user_id is not null
  and exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_pet_profiles_read
on public.guest_pet_profiles
for select
to icamp_app
using (
  exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.read')
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_pet_profiles_write
on public.guest_pet_profiles
for all
to icamp_app
using (
  exists (
    select 1 from public.guest_profiles g
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
  and created_by_user_id is not null
  and exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_profile_events_read
on public.guest_profile_events
for select
to icamp_app
using (
  exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.read')
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

create policy guest_profile_events_insert
on public.guest_profile_events
for insert
to icamp_app
with check (
  actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1 from public.guest_profiles g
    where g.id = guest_profile_id
      and g.campground_id = campground_id
      and (
        g.user_account_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(campground_id,'guest.manage')
      )
  )
);

comment on table public.guest_profiles is
  'Build 048 canonical campground guest profile. Authentication linkage is optional; messaging consent remains owned by Build 014.';
comment on table public.guest_rv_profiles is
  'Reusable Build 048 RV stay preferences. Formal road-vehicle registration and plate data remain Build 053.';
comment on table public.guest_vehicle_profiles is
  'Reusable Build 048 vehicle descriptions for stay planning; not a gate/road registration record.';
comment on table public.guest_pet_profiles is
  'Reusable Build 048 pet stay information without medical or payment data.';
comment on table public.guest_profile_events is
  'Append-only Build 048 profile/privacy/saved-item linkage evidence.';
comment on column public.guest_profiles.save_stay_preferences is
  'Guest-controlled retention preference for reusable stay details.';
comment on column public.guest_profiles.allow_staff_profile_lookup is
  'Guest-controlled discoverability preference for ordinary future-stay profile lookup; authorization remains server-enforced.';
comment on column public.reservations.guest_profile_id is
  'Optional Build 048 canonical guest profile linkage for reservation history.';
comment on column public.seasonal_assignments.guest_profile_id is
  'Optional Build 048 canonical guest profile linkage for seasonal/yearly stay history.';
