-- iCamp Build 051
-- My Stay Guest Portal campground-controlled guest experience configuration.

create table public.campground_my_stay_settings (
  campground_id uuid primary key,
  organization_id uuid not null,
  guest_rules_summary text
    check (
      guest_rules_summary is null
      or char_length(guest_rules_summary) <= 4000
    ),
  wifi_network_name text
    check (
      wifi_network_name is null
      or char_length(wifi_network_name) <= 120
    ),
  wifi_access_instructions text
    check (
      wifi_access_instructions is null
      or char_length(wifi_access_instructions) <= 2000
    ),
  assistance_instructions text
    check (
      assistance_instructions is null
      or char_length(assistance_instructions) <= 2000
    ),
  store_url text
    check (
      store_url is null
      or (
        char_length(store_url) <= 2048
        and store_url ~ '^(https?://|/)'
      )
    ),
  rentals_url text
    check (
      rentals_url is null
      or (
        char_length(rentals_url) <= 2048
        and rentals_url ~ '^(https?://|/)'
      )
    ),
  events_url text
    check (
      events_url is null
      or (
        char_length(events_url) <= 2048
        and events_url ~ '^(https?://|/)'
      )
    ),
  local_interests_url text
    check (
      local_interests_url is null
      or (
        char_length(local_interests_url) <= 2048
        and local_interests_url ~ '^(https?://|/)'
      )
    ),
  assistance_url text
    check (
      assistance_url is null
      or (
        char_length(assistance_url) <= 2048
        and assistance_url ~ '^(https?://|/)'
      )
    ),
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
  row_version bigint not null default 1
    check (row_version >= 1),
  constraint campground_my_stay_settings_scope_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete cascade
);

create index campground_my_stay_settings_created_by_fk_idx
  on public.campground_my_stay_settings(created_by_user_id)
  where created_by_user_id is not null;

create index campground_my_stay_settings_updated_by_fk_idx
  on public.campground_my_stay_settings(updated_by_user_id)
  where updated_by_user_id is not null;

create trigger campground_my_stay_settings_touch_row
before update on public.campground_my_stay_settings
for each row execute function icamp_private.touch_row();

alter table public.campground_my_stay_settings enable row level security;
alter table public.campground_my_stay_settings force row level security;

revoke all on public.campground_my_stay_settings from public;

do $build051_direct_roles$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.campground_my_stay_settings from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.campground_my_stay_settings from authenticated';
  end if;
end
$build051_direct_roles$;

grant select,insert,update on public.campground_my_stay_settings to icamp_app;

create policy campground_my_stay_settings_read
on public.campground_my_stay_settings
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
  or exists (
    select 1
    from public.reservations r
    where r.campground_id =
      campground_my_stay_settings.campground_id
      and r.guest_user_id =
        nullif((select current_setting('icamp.user_id',true)),'')::uuid
      and r.status in ('confirmed','checked_in')
  )
);

create policy campground_my_stay_settings_insert
on public.campground_my_stay_settings
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy campground_my_stay_settings_update
on public.campground_my_stay_settings
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
)
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.campground_my_stay_settings is
  'Build 051 campground-controlled guest portal presentation and safe handoff links. It does not create canonical event, rental, store, local-interest, assistance or versioned-rule domain records.';

comment on column public.campground_my_stay_settings.wifi_access_instructions is
  'Authenticated confirmed/current-stay Wi-Fi access guidance. Avoid storing infrastructure administration secrets.';

comment on column public.campground_my_stay_settings.store_url is
  'Optional guest handoff only. Build 121 remains canonical online-store authority.';

comment on column public.campground_my_stay_settings.rentals_url is
  'Optional guest handoff only. Builds 112-116 remain canonical equipment-rental authority.';

comment on column public.campground_my_stay_settings.events_url is
  'Optional guest handoff only. Builds 097-106 remain canonical event/destination authority.';

comment on column public.campground_my_stay_settings.assistance_url is
  'Optional guest handoff only. Builds 078-079 remain canonical camper-assistance authority.';
