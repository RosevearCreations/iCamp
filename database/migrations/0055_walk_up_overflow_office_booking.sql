-- iCamp Build 046
-- Walk-Up, Overflow & Office Booking.

create table public.campground_overflow_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  code text not null
    check (code ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 2 and 120),
  notes text
    check (notes is null or char_length(trim(notes)) <= 1000),
  is_active boolean not null default true,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_overflow_areas_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint campground_overflow_areas_code_unique
    unique (campground_id, code),
  constraint campground_overflow_areas_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create trigger campground_overflow_areas_touch_row
before update on public.campground_overflow_areas
for each row execute function icamp_private.touch_row();

create index campground_overflow_areas_scope_idx
  on public.campground_overflow_areas (organization_id, campground_id);

create index campground_overflow_areas_active_idx
  on public.campground_overflow_areas (campground_id, is_active, display_name);

create index campground_overflow_areas_created_by_idx
  on public.campground_overflow_areas (created_by_user_id)
  where created_by_user_id is not null;

create index campground_overflow_areas_updated_by_idx
  on public.campground_overflow_areas (updated_by_user_id)
  where updated_by_user_id is not null;

create table public.campground_overflow_area_members (
  organization_id uuid not null,
  campground_id uuid not null,
  overflow_area_id uuid not null,
  accommodation_id uuid not null,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (overflow_area_id, accommodation_id),
  constraint campground_overflow_area_members_area_fk
    foreign key (organization_id, campground_id, overflow_area_id)
    references public.campground_overflow_areas(organization_id, campground_id, id)
    on update cascade
    on delete cascade,
  constraint campground_overflow_area_members_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index campground_overflow_area_members_area_fk_idx
  on public.campground_overflow_area_members
  (organization_id, campground_id, overflow_area_id);

create index campground_overflow_area_members_accommodation_idx
  on public.campground_overflow_area_members
  (organization_id, campground_id, accommodation_id);

create index campground_overflow_area_members_created_by_idx
  on public.campground_overflow_area_members (created_by_user_id)
  where created_by_user_id is not null;

create table public.reservation_office_intake (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  booking_mode text not null
    check (booking_mode in ('office','walk_up','overflow')),
  overflow_area_id uuid,
  office_note text
    check (office_note is null or char_length(trim(office_note)) <= 1000),
  source_channel text not null default 'web'
    check (source_channel in ('web','staff','ivr','sms','import','system')),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 16 and 240),
  recorded_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint reservation_office_intake_reservation_unique
    unique (reservation_id),
  constraint reservation_office_intake_idempotency_unique
    unique (campground_id, idempotency_key),
  constraint reservation_office_intake_reservation_fk
    foreign key (organization_id, campground_id, reservation_id)
    references public.reservations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_office_intake_area_fk
    foreign key (organization_id, campground_id, overflow_area_id)
    references public.campground_overflow_areas(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint reservation_office_intake_mode_shape_check
    check (
      (booking_mode = 'overflow' and overflow_area_id is not null)
      or
      (booking_mode in ('office','walk_up') and overflow_area_id is null)
    )
);

create index reservation_office_intake_scope_idx
  on public.reservation_office_intake
  (campground_id, booking_mode, created_at desc);

create index reservation_office_intake_reservation_fk_idx
  on public.reservation_office_intake
  (organization_id, campground_id, reservation_id);

create index reservation_office_intake_area_fk_idx
  on public.reservation_office_intake
  (organization_id, campground_id, overflow_area_id)
  where overflow_area_id is not null;

create index reservation_office_intake_recorded_by_idx
  on public.reservation_office_intake (recorded_by_user_id);

create or replace function icamp_private.guard_reservation_office_intake()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Reservation office intake evidence is append-only';
end;
$$;

create trigger reservation_office_intake_append_only
before update or delete on public.reservation_office_intake
for each row execute function icamp_private.guard_reservation_office_intake();

alter table public.campground_overflow_areas enable row level security;
alter table public.campground_overflow_areas force row level security;
alter table public.campground_overflow_area_members enable row level security;
alter table public.campground_overflow_area_members force row level security;
alter table public.reservation_office_intake enable row level security;
alter table public.reservation_office_intake force row level security;

revoke all on
  public.campground_overflow_areas,
  public.campground_overflow_area_members,
  public.reservation_office_intake
from public;

do $build046_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.campground_overflow_areas, public.campground_overflow_area_members, public.reservation_office_intake from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.campground_overflow_areas, public.campground_overflow_area_members, public.reservation_office_intake from authenticated';
  end if;
end
$build046_direct_roles$;

grant select, insert, update on public.campground_overflow_areas to icamp_app;
grant select, insert, delete on public.campground_overflow_area_members to icamp_app;
grant select, insert on public.reservation_office_intake to icamp_app;

create policy campground_overflow_areas_read
on public.campground_overflow_areas
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'campground.configuration')
);

create policy campground_overflow_areas_insert
on public.campground_overflow_areas
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy campground_overflow_areas_update
on public.campground_overflow_areas
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy campground_overflow_area_members_read
on public.campground_overflow_area_members
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'campground.configuration')
);

create policy campground_overflow_area_members_insert
on public.campground_overflow_area_members
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy campground_overflow_area_members_delete
on public.campground_overflow_area_members
for delete
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
);

create policy reservation_office_intake_read
on public.reservation_office_intake
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.cancel')
);

create policy reservation_office_intake_insert
on public.reservation_office_intake
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'reservation.create')
  and recorded_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.campground_overflow_areas is
  'Build 046 named overflow booking groups. Members remain canonical accommodations so Build 035 availability stays authoritative.';
comment on table public.campground_overflow_area_members is
  'Build 046 overflow-area membership for canonical accommodations.';
comment on table public.reservation_office_intake is
  'Build 046 append-only office, walk-up or overflow intake evidence linked to one canonical reservation.';
