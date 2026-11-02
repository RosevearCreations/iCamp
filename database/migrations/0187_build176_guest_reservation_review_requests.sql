-- Build 176: guest-selected *review intentions*, never automatic reservation
-- modifications, cancellations, refund requests or outbound communication.
create table public.guest_reservation_review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  user_account_id uuid not null
    references icamp_private.user_accounts(id) on delete restrict,
  request_kind text not null
    check (request_kind in ('change_dates','cancellation_review')),
  requested_arrival_date date,
  requested_departure_date date,
  reason text not null check (length(trim(reason)) between 10 and 500),
  source_reservation_version bigint not null check (source_reservation_version > 0),
  source_policy_version bigint check (source_policy_version is null or source_policy_version > 0),
  idempotency_key uuid not null,
  request_state text not null default 'submitted'
    check (request_state in ('submitted','withdrawn')),
  submitted_at timestamptz not null default statement_timestamp(),
  withdrawn_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  constraint guest_review_requests_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id) on delete restrict,
  constraint guest_review_requests_idempotency_unique
    unique (user_account_id,idempotency_key),
  constraint guest_review_requests_date_shape
    check (
      (request_kind = 'cancellation_review'
        and requested_arrival_date is null and requested_departure_date is null)
      or (request_kind = 'change_dates'
        and requested_arrival_date is not null and requested_departure_date is not null
        and requested_departure_date > requested_arrival_date
        and requested_departure_date <= requested_arrival_date + 90)
    ),
  constraint guest_review_requests_withdrawal_shape
    check (
      (request_state = 'submitted' and withdrawn_at is null)
      or (request_state = 'withdrawn' and withdrawn_at is not null)
    )
);

create unique index guest_review_requests_one_active_kind_idx
  on public.guest_reservation_review_requests(user_account_id,reservation_id,request_kind)
  where request_state = 'submitted';
create index guest_review_requests_owner_idx
  on public.guest_reservation_review_requests(user_account_id,submitted_at desc);
create index guest_review_requests_staff_queue_idx
  on public.guest_reservation_review_requests(campground_id,request_state,submitted_at desc);
create index guest_review_requests_reservation_idx
  on public.guest_reservation_review_requests(reservation_id,submitted_at desc);

create function icamp_private.build176_guard_guest_review_request() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if old.request_state <> 'submitted' or new.request_state <> 'withdrawn'
    or new.withdrawn_at is null or new.withdrawn_at < old.submitted_at
    or (to_jsonb(new) - 'request_state' - 'withdrawn_at' - 'updated_at' - 'row_version')
      is distinct from
       (to_jsonb(old) - 'request_state' - 'withdrawn_at' - 'updated_at' - 'row_version') then
    raise exception 'Review request is immutable except for guest withdrawal';
  end if;
  return new;
end $$;
create trigger build176_guard_guest_review_request before update
  on public.guest_reservation_review_requests for each row
  execute function icamp_private.build176_guard_guest_review_request();
create trigger guest_review_requests_touch_row before update
  on public.guest_reservation_review_requests for each row
  execute function icamp_private.touch_row();

alter table public.guest_reservation_review_requests enable row level security;
alter table public.guest_reservation_review_requests force row level security;
revoke all on public.guest_reservation_review_requests from public;
revoke all on function icamp_private.build176_guard_guest_review_request() from public;
do $restrict_review_requests$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.guest_reservation_review_requests from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.guest_reservation_review_requests from authenticated';
  end if;
end $restrict_review_requests$;
grant select,insert,update on public.guest_reservation_review_requests to icamp_app;

create policy guest_review_requests_read on public.guest_reservation_review_requests
  for select to icamp_app using (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    or icamp_private.has_campground_permission(campground_id,'reservation.read')
    or icamp_private.has_campground_permission(campground_id,'reservation.modify')
    or icamp_private.has_campground_permission(campground_id,'reservation.cancel')
  );
create policy guest_review_requests_insert on public.guest_reservation_review_requests
  for insert to icamp_app with check (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and exists (
      select 1 from public.reservations r
      where r.id=reservation_id and r.campground_id=campground_id
        and r.guest_user_id=user_account_id
        and r.status in ('confirmed','checked_in')
    )
  );
create policy guest_review_requests_withdraw on public.guest_reservation_review_requests
  for update to icamp_app
  using (user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and request_state='submitted')
  with check (user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and request_state='withdrawn');

comment on table public.guest_reservation_review_requests is
  'Internal owner-authenticated guest request to review a reservation change or cancellation; no reservation status, payment, refund or provider writes.';
