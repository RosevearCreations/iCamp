-- iCamp Build 077
-- Camper Assistance Request Interface.
--
-- This build creates immutable guest-originated assistance intake linked to the
-- canonical checked-in reservation and accommodation. Build 078 owns triage,
-- assignment, escalation, guest follow-up and closure.

create table public.camper_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  accommodation_id uuid not null,
  guest_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  category text not null
    check (
      category in (
        'maintenance',
        'garbage',
        'septic',
        'electrical',
        'water',
        'wifi',
        'noise',
        'security',
        'rental',
        'store',
        'other'
      )
    ),
  severity text not null
    check (severity in ('routine','soon','urgent')),
  summary text not null
    check (char_length(trim(summary)) between 3 and 160),
  details text
    check (details is null or char_length(trim(details)) between 1 and 4000),
  contact_preference text not null default 'in_app'
    check (contact_preference in ('in_app','email','sms','phone','none')),
  source_channel text not null default 'web'
    check (source_channel in ('web','ivr','sms','staff','system')),
  client_request_id uuid not null,
  request_state text not null default 'submitted'
    check (request_state = 'submitted'),
  submitted_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1
    check (row_version >= 1),
  constraint camper_assistance_requests_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint camper_assistance_requests_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint camper_assistance_requests_accommodation_fk
    foreign key (organization_id,campground_id,accommodation_id)
    references public.accommodations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint camper_assistance_requests_client_unique
    unique (guest_user_id,campground_id,client_request_id)
);

create index camper_assistance_requests_guest_time_idx
  on public.camper_assistance_requests(
    guest_user_id,
    submitted_at desc
  );

create index camper_assistance_requests_campground_queue_idx
  on public.camper_assistance_requests(
    campground_id,
    request_state,
    severity,
    submitted_at
  );

create index camper_assistance_requests_reservation_fk_idx
  on public.camper_assistance_requests(
    organization_id,
    campground_id,
    reservation_id
  );

create index camper_assistance_requests_accommodation_fk_idx
  on public.camper_assistance_requests(
    organization_id,
    campground_id,
    accommodation_id
  );

create table public.camper_assistance_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  request_id uuid not null,
  event_kind text not null
    check (event_kind in ('submitted','media_attached')),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  source_channel text not null default 'web'
    check (source_channel in ('web','ivr','sms','staff','system')),
  summary text not null
    check (char_length(trim(summary)) between 3 and 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint camper_assistance_request_events_request_fk
    foreign key (organization_id,campground_id,request_id)
    references public.camper_assistance_requests(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict
);

create index camper_assistance_request_events_request_time_idx
  on public.camper_assistance_request_events(
    request_id,
    occurred_at desc
  );

create index camper_assistance_request_events_actor_fk_idx
  on public.camper_assistance_request_events(actor_user_id);

create table public.camper_assistance_request_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  request_id uuid not null,
  media_asset_id uuid not null
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint camper_assistance_request_media_request_fk
    foreign key (organization_id,campground_id,request_id)
    references public.camper_assistance_requests(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint camper_assistance_request_media_scope_asset_unique
    unique (request_id,media_asset_id)
);

create index camper_assistance_request_media_request_idx
  on public.camper_assistance_request_media(
    request_id,
    created_at
  );

create index camper_assistance_request_media_creator_fk_idx
  on public.camper_assistance_request_media(created_by_user_id);

create index camper_assistance_request_media_asset_fk_idx
  on public.camper_assistance_request_media(media_asset_id);

create or replace function icamp_private.validate_camper_assistance_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stay record;
begin
  select
    r.organization_id,
    r.campground_id,
    r.accommodation_id,
    r.guest_user_id,
    r.status
  into stay
  from public.reservations r
  where r.id = new.reservation_id;

  if not found then
    raise exception 'Assistance request reservation was not found';
  end if;

  if stay.organization_id <> new.organization_id
     or stay.campground_id <> new.campground_id
     or stay.accommodation_id <> new.accommodation_id
     or stay.guest_user_id is distinct from new.guest_user_id then
    raise exception 'Assistance request does not match the selected stay';
  end if;

  if stay.status <> 'checked_in' then
    raise exception 'Assistance requests require a checked-in stay';
  end if;

  return new;
end;
$$;

create trigger camper_assistance_requests_validate
before insert on public.camper_assistance_requests
for each row execute function icamp_private.validate_camper_assistance_request();

create or replace function icamp_private.prevent_camper_assistance_intake_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Camper assistance intake evidence is append-only';
end;
$$;

create trigger camper_assistance_requests_append_only
before update or delete on public.camper_assistance_requests
for each row execute function icamp_private.prevent_camper_assistance_intake_mutation();

create trigger camper_assistance_request_events_append_only
before update or delete on public.camper_assistance_request_events
for each row execute function icamp_private.prevent_camper_assistance_intake_mutation();

create trigger camper_assistance_request_media_append_only
before update or delete on public.camper_assistance_request_media
for each row execute function icamp_private.prevent_camper_assistance_intake_mutation();

alter table public.camper_assistance_requests enable row level security;
alter table public.camper_assistance_requests force row level security;
alter table public.camper_assistance_request_events enable row level security;
alter table public.camper_assistance_request_events force row level security;
alter table public.camper_assistance_request_media enable row level security;
alter table public.camper_assistance_request_media force row level security;

revoke all on
  public.camper_assistance_requests,
  public.camper_assistance_request_events,
  public.camper_assistance_request_media
from public;

do $build077_direct_roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format(
        'revoke all on public.camper_assistance_requests, public.camper_assistance_request_events, public.camper_assistance_request_media from %I',
        role_name
      );
    end if;
  end loop;
end
$build077_direct_roles$;

grant select,insert on
  public.camper_assistance_requests,
  public.camper_assistance_request_events,
  public.camper_assistance_request_media
to icamp_app;

create policy camper_assistance_requests_read
on public.camper_assistance_requests
for select
to icamp_app
using (
  guest_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  or icamp_private.has_campground_permission(campground_id,'reservation.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'security.incident.manage')
  or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
);

create policy camper_assistance_requests_insert
on public.camper_assistance_requests
for insert
to icamp_app
with check (
  guest_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.reservations r
    where r.id = camper_assistance_requests.reservation_id
      and r.organization_id = camper_assistance_requests.organization_id
      and r.campground_id = camper_assistance_requests.campground_id
      and r.accommodation_id = camper_assistance_requests.accommodation_id
      and r.guest_user_id = camper_assistance_requests.guest_user_id
      and r.status = 'checked_in'
  )
);

create policy camper_assistance_request_events_read
on public.camper_assistance_request_events
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_request_events.request_id
      and r.organization_id =
        camper_assistance_request_events.organization_id
      and r.campground_id =
        camper_assistance_request_events.campground_id
      and (
        r.guest_user_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(
          r.campground_id,
          'reservation.read'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'maintenance.read'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'security.incident.manage'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'campground.operations.manage'
        )
      )
  )
);

create policy camper_assistance_request_events_insert
on public.camper_assistance_request_events
for insert
to icamp_app
with check (
  actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_request_events.request_id
      and r.organization_id =
        camper_assistance_request_events.organization_id
      and r.campground_id =
        camper_assistance_request_events.campground_id
      and (
        r.guest_user_id = camper_assistance_request_events.actor_user_id
        or icamp_private.has_campground_permission(
          r.campground_id,
          'reservation.read'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'maintenance.read'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'security.incident.manage'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'campground.operations.manage'
        )
      )
  )
);

create policy camper_assistance_request_media_read
on public.camper_assistance_request_media
for select
to icamp_app
using (
  exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_request_media.request_id
      and r.organization_id =
        camper_assistance_request_media.organization_id
      and r.campground_id =
        camper_assistance_request_media.campground_id
      and (
        r.guest_user_id =
          nullif((select current_setting('icamp.user_id',true)),'')::uuid
        or icamp_private.has_campground_permission(
          r.campground_id,
          'reservation.read'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'maintenance.read'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'security.incident.manage'
        )
        or icamp_private.has_campground_permission(
          r.campground_id,
          'campground.operations.manage'
        )
      )
  )
);

create policy camper_assistance_request_media_insert
on public.camper_assistance_request_media
for insert
to icamp_app
with check (
  created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists (
    select 1
    from public.camper_assistance_requests r
    where r.id = camper_assistance_request_media.request_id
      and r.organization_id =
        camper_assistance_request_media.organization_id
      and r.campground_id =
        camper_assistance_request_media.campground_id
      and r.guest_user_id =
        camper_assistance_request_media.created_by_user_id
  )
);

comment on table public.camper_assistance_requests is
  'Build 077 immutable camper-assistance intake linked to a checked-in canonical reservation. Build 078 owns triage, assignment, escalation, communication and closure.';

comment on column public.camper_assistance_requests.severity is
  'Operational priority only. Urgent does not replace emergency services or campground emergency procedures.';

comment on table public.camper_assistance_request_media is
  'Build 077 links validated Build 008 internal media to a camper assistance request without creating a second media store.';
