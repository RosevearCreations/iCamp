-- Build 177: pre-arrival information is a guest-owned proposal and staff
-- checklist receipt, not canonical check-in or access authorization.
create table public.guest_arrival_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null unique,
  user_account_id uuid not null
    references icamp_private.user_accounts(id) on delete restrict,
  expected_arrival_time time without time zone,
  arrival_mode text not null default 'unspecified'
    check (arrival_mode in ('unspecified','personal_vehicle','rideshare','walking','other')),
  expected_vehicle_count smallint check (expected_vehicle_count between 0 and 20),
  expected_visitor_count smallint check (expected_visitor_count between 0 and 100),
  document_preparation text not null default 'not_reviewed'
    check (document_preparation in ('not_reviewed','will_bring','need_help')),
  rules_reviewed boolean not null default false,
  assistance_requested boolean not null default false,
  assistance_note text check (assistance_note is null or length(assistance_note) between 1 and 300),
  plan_state text not null default 'draft' check (plan_state in ('draft','submitted')),
  source_reservation_version bigint not null check (source_reservation_version > 0),
  submitted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  constraint guest_arrival_plans_owner_unique unique(id,user_account_id),
  constraint guest_arrival_plans_review_target_unique
    unique(id,organization_id,campground_id,reservation_id,user_account_id),
  constraint guest_arrival_plans_reservation_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id) on delete restrict,
  constraint guest_arrival_plans_submission_shape check (
    (plan_state='draft' and submitted_at is null)
    or (plan_state='submitted' and submitted_at is not null
      and expected_arrival_time is not null
      and expected_vehicle_count is not null
      and expected_visitor_count is not null
      and document_preparation <> 'not_reviewed' and rules_reviewed)
  ),
  constraint guest_arrival_plans_assistance_shape check (
    assistance_requested or assistance_note is null
  )
);
create index guest_arrival_plans_owner_idx
  on public.guest_arrival_plans(user_account_id,updated_at desc);
create index guest_arrival_plans_staff_idx
  on public.guest_arrival_plans(campground_id,plan_state,updated_at desc);

create table public.guest_arrival_staff_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null unique,
  arrival_plan_id uuid not null,
  user_account_id uuid not null,
  review_outcome text not null check (review_outcome in ('reviewed','follow_up_needed')),
  review_note text check (review_note is null or length(review_note) between 1 and 300),
  reviewed_plan_version bigint not null check (reviewed_plan_version > 0),
  reviewed_reservation_version bigint not null check (reviewed_reservation_version > 0),
  reviewed_by_user_id uuid not null
    references icamp_private.user_accounts(id) on delete restrict,
  reviewed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  constraint guest_arrival_reviews_scope_fk
    foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id) on delete restrict,
  constraint guest_arrival_reviews_plan_owner_fk
    foreign key (arrival_plan_id,organization_id,campground_id,reservation_id,user_account_id)
    references public.guest_arrival_plans(id,organization_id,campground_id,reservation_id,user_account_id)
    on delete restrict,
  constraint guest_arrival_reviews_followup_note check (
    review_outcome <> 'follow_up_needed'
    or (review_note is not null and length(trim(review_note)) between 10 and 300)
  )
);
create index guest_arrival_reviews_staff_idx
  on public.guest_arrival_staff_reviews(campground_id,reviewed_at desc);
create index guest_arrival_reviews_actor_idx
  on public.guest_arrival_staff_reviews(reviewed_by_user_id,reviewed_at desc);

create function icamp_private.build177_guard_arrival_plan_identity() returns trigger
  language plpgsql security invoker set search_path='' as $$
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.campground_id is distinct from old.campground_id
    or new.reservation_id is distinct from old.reservation_id
    or new.user_account_id is distinct from old.user_account_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Arrival plan ownership and reservation are immutable';
  end if;
  return new;
end $$;
create trigger build177_guard_arrival_plan_identity before update
  on public.guest_arrival_plans for each row
  execute function icamp_private.build177_guard_arrival_plan_identity();
create trigger guest_arrival_plans_touch_row before update
  on public.guest_arrival_plans for each row execute function icamp_private.touch_row();

create function icamp_private.build177_guard_arrival_review_identity() returns trigger
  language plpgsql security invoker set search_path='' as $$
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.campground_id is distinct from old.campground_id
    or new.reservation_id is distinct from old.reservation_id
    or new.arrival_plan_id is distinct from old.arrival_plan_id
    or new.user_account_id is distinct from old.user_account_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Arrival staff-review target is immutable';
  end if;
  return new;
end $$;
create trigger build177_guard_arrival_review_identity before update
  on public.guest_arrival_staff_reviews for each row
  execute function icamp_private.build177_guard_arrival_review_identity();
create trigger guest_arrival_reviews_touch_row before update
  on public.guest_arrival_staff_reviews for each row execute function icamp_private.touch_row();

alter table public.guest_arrival_plans enable row level security;
alter table public.guest_arrival_plans force row level security;
alter table public.guest_arrival_staff_reviews enable row level security;
alter table public.guest_arrival_staff_reviews force row level security;
revoke all on public.guest_arrival_plans,public.guest_arrival_staff_reviews from public;
revoke all on function icamp_private.build177_guard_arrival_plan_identity() from public;
revoke all on function icamp_private.build177_guard_arrival_review_identity() from public;
do $restrict_arrival_plan_access$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.guest_arrival_plans, public.guest_arrival_staff_reviews from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.guest_arrival_plans, public.guest_arrival_staff_reviews from authenticated';
  end if;
end $restrict_arrival_plan_access$;
grant select,insert,update on public.guest_arrival_plans,public.guest_arrival_staff_reviews to icamp_app;

create policy guest_arrival_plan_read on public.guest_arrival_plans
  for select to icamp_app using (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    or icamp_private.has_campground_permission(campground_id,'reservation.read')
    or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  );
create policy guest_arrival_plan_insert on public.guest_arrival_plans
  for insert to icamp_app with check (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and exists (
      select 1 from public.reservations r
      where r.id=reservation_id and r.campground_id=campground_id
        and r.guest_user_id=user_account_id and r.status='confirmed'
    )
  );
create policy guest_arrival_plan_update on public.guest_arrival_plans
  for update to icamp_app using (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  ) with check (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and exists (
      select 1 from public.reservations r
      where r.id=reservation_id and r.campground_id=campground_id
        and r.guest_user_id=user_account_id and r.status='confirmed'
    )
  );
create policy guest_arrival_review_read on public.guest_arrival_staff_reviews
  for select to icamp_app using (
    user_account_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    or icamp_private.has_campground_permission(campground_id,'reservation.read')
    or icamp_private.has_campground_permission(campground_id,'reservation.modify')
  );
create policy guest_arrival_review_insert on public.guest_arrival_staff_reviews
  for insert to icamp_app with check (
    reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and icamp_private.has_campground_permission(campground_id,'reservation.modify')
  );
create policy guest_arrival_review_update on public.guest_arrival_staff_reviews
  for update to icamp_app using (
    icamp_private.has_campground_permission(campground_id,'reservation.modify')
  ) with check (
    reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and icamp_private.has_campground_permission(campground_id,'reservation.modify')
  );

comment on table public.guest_arrival_plans is
  'Guest-owned consented pre-arrival proposal; does not modify canonical reservation or authorize check-in.';
comment on table public.guest_arrival_staff_reviews is
  'Version-pinned internal desk checklist receipt, never a check-in, charge, credential, gate or dispatch authorization.';
