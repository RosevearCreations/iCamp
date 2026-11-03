-- Build 197: private, append-only guest privacy intake and human review evidence.
-- No automatic deletion, data transfer, messaging, or statutory retention clock.
create table icamp_private.guest_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  guest_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
  request_kind text not null check(request_kind in ('access','correction','retention_review','erasure_review','consent_question')),
  subject_area text not null check(subject_area in ('profile','stays','communications','all')),
  submitted_at timestamptz not null default statement_timestamp(),
  unique (organization_id,campground_id,id),
  foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create index guest_privacy_requests_guest_scope_idx
  on icamp_private.guest_privacy_requests(guest_user_id,campground_id,submitted_at desc);
create index guest_privacy_requests_campground_idx
  on icamp_private.guest_privacy_requests(campground_id,submitted_at desc);

create table icamp_private.guest_privacy_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  request_id uuid not null,
  event_kind text not null check(event_kind in ('submitted','in_review','information_needed','retention_hold_review','manual_action_required','fulfilled_external','closed_no_action')),
  outcome_code text not null default 'pending' check(outcome_code in ('pending','verifying_identity','policy_review','legal_hold_review','manual_followup','not_applicable','completed_outside_app')),
  source_reference text check(source_reference is null or (char_length(source_reference) between 8 and 120
    and source_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$')),
  actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key(organization_id,campground_id,request_id)
    references icamp_private.guest_privacy_requests(organization_id,campground_id,id) on delete restrict
);
create index guest_privacy_events_request_idx
  on icamp_private.guest_privacy_request_events(request_id,recorded_at desc,id desc);
create index guest_privacy_events_scope_request_fk_idx
  on icamp_private.guest_privacy_request_events(organization_id,campground_id,request_id);
create index guest_privacy_events_actor_fk_idx on icamp_private.guest_privacy_request_events(actor_user_id);

create function icamp_private.guard_guest_privacy_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Guest privacy evidence is append-only'; end $$;
create trigger guest_privacy_requests_immutable before update or delete on icamp_private.guest_privacy_requests
for each row execute function icamp_private.guard_guest_privacy_immutable();
create trigger guest_privacy_events_immutable before update or delete on icamp_private.guest_privacy_request_events
for each row execute function icamp_private.guard_guest_privacy_immutable();
revoke all on function icamp_private.guard_guest_privacy_immutable() from public;

-- A database guard protects the transition even if an app client is compromised.
create function icamp_private.guard_guest_privacy_event_insert()
returns trigger language plpgsql security invoker set search_path='' as $$
declare r record; previous text;
begin
  if new.actor_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid then
    raise exception 'Guest privacy actor mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('icamp-privacy-event:'||new.request_id::text,0));
  select guest_user_id into r from icamp_private.guest_privacy_requests
    where id=new.request_id and campground_id=new.campground_id and organization_id=new.organization_id;
  if not found then raise exception 'Guest privacy request missing'; end if;
  select event_kind into previous from icamp_private.guest_privacy_request_events
    where request_id=new.request_id order by recorded_at desc,id desc limit 1;
  if previous is null then
    if new.event_kind<>'submitted' or new.outcome_code<>'pending' or new.source_reference is not null
       or new.actor_user_id is distinct from r.guest_user_id then
      raise exception 'Only the guest can submit the initial privacy event';
    end if;
  elsif new.event_kind='submitted' or previous in ('fulfilled_external','closed_no_action')
      or new.event_kind=previous
      or (new.event_kind='fulfilled_external' and previous not in ('in_review','retention_hold_review','manual_action_required','information_needed'))
      or not icamp_private.has_campground_permission(new.campground_id,'guest.manage')
      or new.actor_user_id=r.guest_user_id then
    raise exception 'Invalid or unauthorized privacy review transition';
  end if;
  return new;
end $$;
create trigger guest_privacy_event_insert_guard before insert on icamp_private.guest_privacy_request_events
for each row execute function icamp_private.guard_guest_privacy_event_insert();
revoke all on function icamp_private.guard_guest_privacy_event_insert() from public;

alter table icamp_private.guest_privacy_requests enable row level security;
alter table icamp_private.guest_privacy_requests force row level security;
alter table icamp_private.guest_privacy_request_events enable row level security;
alter table icamp_private.guest_privacy_request_events force row level security;
revoke all on icamp_private.guest_privacy_requests, icamp_private.guest_privacy_request_events from public;
do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on icamp_private.guest_privacy_requests, icamp_private.guest_privacy_request_events from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on icamp_private.guest_privacy_requests, icamp_private.guest_privacy_request_events from authenticated;
  end if;
end $$;
grant select,insert on icamp_private.guest_privacy_requests, icamp_private.guest_privacy_request_events to icamp_app;

-- Only returns a boolean for the authenticated server-context actor. Needed
-- because historical completed stays are deliberately hidden by reservation RLS.
create function icamp_private.guest_privacy_has_scope(p_organization uuid,p_campground uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from icamp_private.user_accounts u
    where u.id=nullif(current_setting('icamp.user_id',true),'')::uuid
      and u.account_type='guest' and u.account_state='active')
  and exists(select 1 from public.campgrounds c
    where c.id=p_campground and c.organization_id=p_organization and c.lifecycle_state='active')
  and (exists(select 1 from public.reservations r
    where r.organization_id=p_organization and r.campground_id=p_campground
      and r.guest_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid)
    or exists(select 1 from public.guest_profiles g
    where g.organization_id=p_organization and g.campground_id=p_campground
      and g.user_account_id=nullif(current_setting('icamp.user_id',true),'')::uuid));
$$;
revoke all on function icamp_private.guest_privacy_has_scope(uuid,uuid) from public;
grant execute on function icamp_private.guest_privacy_has_scope(uuid,uuid) to icamp_app;

create policy guest_privacy_requests_read on icamp_private.guest_privacy_requests
for select to icamp_app using (
  guest_user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  or icamp_private.has_campground_permission(campground_id,'guest.manage'));
create policy guest_privacy_requests_insert on icamp_private.guest_privacy_requests
for insert to icamp_app with check (
  guest_user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and icamp_private.guest_privacy_has_scope(organization_id,campground_id));
create policy guest_privacy_events_read on icamp_private.guest_privacy_request_events
for select to icamp_app using (exists(select 1 from icamp_private.guest_privacy_requests r
  where r.id=request_id and r.organization_id=organization_id and r.campground_id=campground_id
    and (r.guest_user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
      or icamp_private.has_campground_permission(campground_id,'guest.manage'))));
create policy guest_privacy_events_insert on icamp_private.guest_privacy_request_events
for insert to icamp_app with check (
  actor_user_id=(select nullif(current_setting('icamp.user_id',true),'')::uuid)
  and exists(select 1 from icamp_private.guest_privacy_requests r
    where r.id=request_id and r.organization_id=organization_id and r.campground_id=campground_id
      and ((event_kind='submitted' and r.guest_user_id=actor_user_id)
        or (event_kind<>'submitted' and icamp_private.has_campground_permission(campground_id,'guest.manage')))));
comment on table icamp_private.guest_privacy_requests is
  'Build 197 private guest-submitted subject/category markers only. No raw contact or narrative PII.';
comment on table icamp_private.guest_privacy_request_events is
  'Build 197 human privacy review evidence. Hold and manual-action codes do not delete data or certify external fulfillment.';
