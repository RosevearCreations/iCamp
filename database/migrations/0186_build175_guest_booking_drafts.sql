-- Build 175: optional consent-based guest-owned booking drafts.
-- Drafts are selections, never reservations, holds, invoices, payment intents or messages.
create table public.guest_booking_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  user_account_id uuid not null
    references icamp_private.user_accounts(id) on delete cascade,
  arrival_date date not null,
  departure_date date not null,
  selections jsonb not null default '[]'::jsonb,
  saved_quote jsonb not null,
  consented_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '7 days'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  constraint guest_booking_drafts_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  constraint guest_booking_drafts_accommodation_fk
    foreign key (organization_id,campground_id,accommodation_id)
    references public.accommodations(organization_id,campground_id,id) on delete restrict,
  constraint guest_booking_drafts_unique_selection
    unique (user_account_id,campground_id,accommodation_id,arrival_date,departure_date),
  constraint guest_booking_drafts_valid_dates
    check (departure_date > arrival_date and departure_date <= arrival_date + 90),
  constraint guest_booking_drafts_expiry
    check (expires_at > consented_at and expires_at <= consented_at + interval '7 days'),
  constraint guest_booking_drafts_selections_shape
    check (jsonb_typeof(selections) = 'array' and jsonb_array_length(selections) <= 3),
  constraint guest_booking_drafts_quote_shape
    check (jsonb_typeof(saved_quote) = 'object')
);

create index guest_booking_drafts_owner_active_idx
  on public.guest_booking_drafts (user_account_id, expires_at desc, updated_at desc);

create trigger guest_booking_drafts_touch_row before update
  on public.guest_booking_drafts for each row
  execute function icamp_private.touch_row();

alter table public.guest_booking_drafts enable row level security;
alter table public.guest_booking_drafts force row level security;
revoke all on public.guest_booking_drafts from public;
do $restrict_guest_booking_drafts$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.guest_booking_drafts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.guest_booking_drafts from authenticated';
  end if;
end $restrict_guest_booking_drafts$;
grant select,insert,update,delete on public.guest_booking_drafts to icamp_app;

create policy guest_booking_drafts_owner_read
  on public.guest_booking_drafts for select to icamp_app
  using (user_account_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy guest_booking_drafts_owner_insert
  on public.guest_booking_drafts for insert to icamp_app
  with check (user_account_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy guest_booking_drafts_owner_update
  on public.guest_booking_drafts for update to icamp_app
  using (user_account_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid)
  with check (user_account_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy guest_booking_drafts_owner_delete
  on public.guest_booking_drafts for delete to icamp_app
  using (user_account_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid);

comment on table public.guest_booking_drafts is
  'Seven-day consented owner-only selections for signed-in cross-device recovery; no hold, payment, reservation or messaging side effect.';
