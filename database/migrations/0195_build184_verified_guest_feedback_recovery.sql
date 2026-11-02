-- Build 184: post-stay verified feedback, guest-controlled public reviews,
-- immutable moderation / appeal history and private recovery readback.
-- No refunds, compensation, external notifications or canonical case state changes.

create table icamp_private.verified_guest_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  reservation_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id) on update cascade on delete restrict,
  assistance_case_id uuid,
  rating smallint not null check (rating between 1 and 5),
  category text not null check (category in ('stay','amenities','staff','accessibility','activities','other')),
  title text not null check (char_length(trim(title)) between 4 and 120),
  public_summary text not null check (char_length(trim(public_summary)) between 20 and 1000),
  private_details text not null default '' check (char_length(private_details)<=2000),
  public_requested boolean not null default false,
  moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','declined')),
  moderation_reason text,
  moderated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  moderated_at timestamptz,
  appeal_pending boolean not null default false,
  appeal_reason text check (appeal_reason is null or char_length(trim(appeal_reason)) between 10 and 600),
  appeal_requested_at timestamptz,
  recovery_stage text not null default 'received'
    check (recovery_stage in ('received','reviewing','action_planned','resolved','not_actionable')),
  recovery_owner_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  recovery_due_date date,
  recovery_updated_at timestamptz,
  submitted_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version>=1),
  constraint verified_feedback_reservation_fk foreign key (organization_id,campground_id,reservation_id)
    references public.reservations(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint verified_feedback_case_fk foreign key (organization_id,campground_id,assistance_case_id)
    references public.camper_assistance_cases(organization_id,campground_id,id) on update cascade on delete restrict,
  constraint verified_feedback_scope_unique unique (organization_id,campground_id,id),
  constraint verified_feedback_one_per_stay unique (reservation_id),
  constraint verified_feedback_moderation_shape check (
    (moderation_state='pending' and moderated_at is null and moderated_by_user_id is null and moderation_reason is null)
    or (moderation_state in ('approved','declined') and moderated_at is not null and moderated_by_user_id is not null)
  ),
  constraint verified_feedback_appeal_shape check (
    (not appeal_pending and appeal_reason is null and appeal_requested_at is null)
    or (appeal_pending and moderation_state='declined' and public_requested
       and appeal_reason is not null and appeal_requested_at is not null)
  ),
  constraint verified_feedback_public_approval_check check (moderation_state<>'approved' or public_requested)
);
create index verified_feedback_guest_history_idx on icamp_private.verified_guest_feedback(guest_user_id,submitted_at desc);
create index verified_feedback_camp_queue_idx on icamp_private.verified_guest_feedback(campground_id,moderation_state,recovery_stage,updated_at desc);
create index verified_feedback_public_idx on icamp_private.verified_guest_feedback(campground_id,submitted_at desc) where public_requested and moderation_state='approved';
create index verified_feedback_reservation_fk_idx on icamp_private.verified_guest_feedback(organization_id,campground_id,reservation_id);
create index verified_feedback_case_fk_idx on icamp_private.verified_guest_feedback(organization_id,campground_id,assistance_case_id) where assistance_case_id is not null;
create index verified_feedback_moderator_fk_idx on icamp_private.verified_guest_feedback(moderated_by_user_id) where moderated_by_user_id is not null;
create index verified_feedback_owner_fk_idx on icamp_private.verified_guest_feedback(recovery_owner_user_id) where recovery_owner_user_id is not null;
create trigger verified_feedback_touch before update on icamp_private.verified_guest_feedback for each row execute function icamp_private.touch_row();

create function icamp_private.guard_verified_guest_feedback()
returns trigger language plpgsql security invoker set search_path='' as $$
declare must_revalidate boolean;
begin
  if tg_op='UPDATE' and row(new.organization_id,new.campground_id,new.reservation_id,new.guest_user_id)
    is distinct from row(old.organization_id,old.campground_id,old.reservation_id,old.guest_user_id) then
    raise exception 'Verified feedback identity and tenancy cannot change';
  end if;
  if not exists (select 1 from icamp_private.user_accounts u where u.id=new.guest_user_id
    and u.account_type='guest' and u.account_state='active') then
    raise exception 'An active guest account is required';
  end if;
  must_revalidate := tg_op='INSERT';
  if tg_op='UPDATE' then
    must_revalidate := row(new.rating,new.category,new.title,new.public_summary,new.private_details,new.assistance_case_id)
      is distinct from row(old.rating,old.category,old.title,old.public_summary,old.private_details,old.assistance_case_id);
  end if;
  if must_revalidate and not exists (
    select 1 from public.reservations r join public.campgrounds c on c.id=r.campground_id
    where r.id=new.reservation_id and r.organization_id=new.organization_id
      and r.campground_id=new.campground_id and r.guest_user_id=new.guest_user_id
      and r.status='completed' and c.lifecycle_state='active'
      and r.departure_date <= (statement_timestamp() at time zone c.timezone)::date
      and r.departure_date >= (statement_timestamp() at time zone c.timezone)::date-180
  ) then
    raise exception 'Feedback requires a completed, guest-owned stay within 180 days';
  end if;
  if new.assistance_case_id is not null and not exists (
    select 1 from public.camper_assistance_cases ca
    join public.camper_assistance_requests ar on ar.id=ca.request_id
    where ca.id=new.assistance_case_id and ca.organization_id=new.organization_id
      and ca.campground_id=new.campground_id and ar.reservation_id=new.reservation_id
      and ar.guest_user_id=new.guest_user_id
  ) then
    raise exception 'Linked service recovery case must belong to the same guest stay';
  end if;
  return new;
end $$;
create trigger verified_feedback_guard before insert or update on icamp_private.verified_guest_feedback
  for each row execute function icamp_private.guard_verified_guest_feedback();

create table icamp_private.guest_feedback_moderation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  feedback_id uuid not null,
  actor_user_id uuid not null references icamp_private.user_accounts(id) on update cascade on delete restrict,
  event_kind text not null check (event_kind in ('submitted','edited','consent_withdrawn','approved','declined','appealed','appeal_approved','appeal_declined')),
  reason text not null default '' check (char_length(reason)<=600),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint feedback_moderation_event_fk foreign key (organization_id,campground_id,feedback_id)
    references icamp_private.verified_guest_feedback(organization_id,campground_id,id) on update cascade on delete restrict
);
create index feedback_moderation_history_idx on icamp_private.guest_feedback_moderation_events(organization_id,campground_id,feedback_id,occurred_at desc);
create index feedback_moderation_actor_fk_idx on icamp_private.guest_feedback_moderation_events(actor_user_id);

create table icamp_private.guest_feedback_recovery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  feedback_id uuid not null,
  actor_user_id uuid not null references icamp_private.user_accounts(id) on update cascade on delete restrict,
  recovery_stage text not null check (recovery_stage in ('reviewing','action_planned','resolved','not_actionable')),
  guest_visible_summary text not null check (char_length(trim(guest_visible_summary)) between 10 and 600),
  internal_note text not null default '' check (char_length(internal_note)<=800),
  due_date date,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint feedback_recovery_event_fk foreign key (organization_id,campground_id,feedback_id)
    references icamp_private.verified_guest_feedback(organization_id,campground_id,id) on update cascade on delete restrict
);
create index feedback_recovery_history_idx on icamp_private.guest_feedback_recovery_events(organization_id,campground_id,feedback_id,occurred_at desc);
create index feedback_recovery_actor_fk_idx on icamp_private.guest_feedback_recovery_events(actor_user_id);

revoke all on function icamp_private.guard_verified_guest_feedback() from public;
alter table icamp_private.verified_guest_feedback enable row level security;
alter table icamp_private.verified_guest_feedback force row level security;
alter table icamp_private.guest_feedback_moderation_events enable row level security;
alter table icamp_private.guest_feedback_moderation_events force row level security;
alter table icamp_private.guest_feedback_recovery_events enable row level security;
alter table icamp_private.guest_feedback_recovery_events force row level security;
create policy verified_feedback_no_direct_access on icamp_private.verified_guest_feedback
  for all to icamp_app using(false) with check(false);
create policy feedback_moderation_no_direct_access on icamp_private.guest_feedback_moderation_events
  for all to icamp_app using(false) with check(false);
create policy feedback_recovery_no_direct_access on icamp_private.guest_feedback_recovery_events
  for all to icamp_app using(false) with check(false);
revoke all on icamp_private.verified_guest_feedback,icamp_private.guest_feedback_moderation_events,
  icamp_private.guest_feedback_recovery_events from public;
do $feedback_untrusted_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on icamp_private.verified_guest_feedback,icamp_private.guest_feedback_moderation_events,icamp_private.guest_feedback_recovery_events from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on icamp_private.verified_guest_feedback,icamp_private.guest_feedback_moderation_events,icamp_private.guest_feedback_recovery_events from authenticated';
  end if;
end $feedback_untrusted_roles$;

comment on table icamp_private.verified_guest_feedback is
  'Build184 completed-stay verified guest reviews; public consent AND staff approval required; never publicize private details.';
