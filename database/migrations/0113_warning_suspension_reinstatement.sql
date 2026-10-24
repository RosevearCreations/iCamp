-- Build 083 — Warnings, review-gated access suspensions and reinstatement.
-- Administrative record only: no gate command, credential revocation, booking
-- cancellation, safety certification or automatic physical access enforcement.

-- The original permission catalog already contains these keys. Give campground
-- managers the relevant authority, and reserve reviews for management.
insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join (values
 ('campground_manager','safety.warning.issue'),
 ('campground_manager','safety.suspension.issue'),
 ('campground_manager','safety.suspension.review')
) p(role_code,permission_key) on p.role_code=r.role_code and r.role_kind='template'
on conflict do nothing;
delete from icamp_private.role_permissions rp using icamp_private.roles r
where rp.role_id=r.id and r.role_kind='template' and r.role_code='security'
 and rp.permission_key='safety.suspension.review';

create table public.safety_enforcement_cases (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 reservation_id uuid not null,
 guest_user_id uuid not null references icamp_private.user_accounts(id),
 rule_version_id uuid,
 case_kind text not null check(case_kind in ('warning','suspension')),
 scope_type text not null check(scope_type in ('campground','facility','access_zone','feature')),
 facility_id uuid,
 access_zone_id uuid,
 feature_code text check(feature_code in ('pool','waterfront','sports','playground','event','access')),
 reason_summary text not null check(char_length(trim(reason_summary)) between 20 and 2000),
 case_state text not null check(case_state in
  ('warning_recorded','pending_review','active','denied','reinstated')),
 decision_note text,
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 updated_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 row_version integer not null default 1 check(row_version between 1 and 1000000),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reservation_id)
  references public.reservations(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,facility_id)
  references public.operational_assets(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,access_zone_id)
  references public.access_zones(organization_id,campground_id,id),
 check((scope_type='campground' and facility_id is null and access_zone_id is null and feature_code is null)
  or (scope_type='facility' and facility_id is not null and access_zone_id is null and feature_code is null)
  or (scope_type='access_zone' and access_zone_id is not null and facility_id is null and feature_code is null)
  or (scope_type='feature' and feature_code is not null and facility_id is null and access_zone_id is null)),
 check((case_kind='warning' and case_state='warning_recorded')
  or (case_kind='suspension' and case_state in ('pending_review','active','denied','reinstated')))
);
create index safety_enforcement_reservation_idx
 on public.safety_enforcement_cases(reservation_id,created_at desc);
create index safety_enforcement_campground_queue_idx
 on public.safety_enforcement_cases(campground_id,case_state,created_at desc);
create index safety_enforcement_guest_idx
 on public.safety_enforcement_cases(guest_user_id);
create index safety_enforcement_creator_idx
 on public.safety_enforcement_cases(created_by_user_id);
create index safety_enforcement_updater_idx
 on public.safety_enforcement_cases(updated_by_user_id);
create index safety_enforcement_facility_idx
 on public.safety_enforcement_cases(facility_id) where facility_id is not null;
create index safety_enforcement_zone_idx
 on public.safety_enforcement_cases(access_zone_id) where access_zone_id is not null;
create index safety_enforcement_rule_idx
 on public.safety_enforcement_cases(rule_version_id) where rule_version_id is not null;

create table public.safety_enforcement_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null,
 event_kind text not null check(event_kind in
  ('warning_issued','suspension_requested','suspension_approved',
   'suspension_denied','access_reinstated')),
 resulting_state text not null check(resulting_state in
  ('warning_recorded','pending_review','active','denied','reinstated')),
 case_version integer not null check(case_version>=1),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 event_note text not null check(char_length(trim(event_note)) between 12 and 2000),
 occurred_at timestamptz not null default statement_timestamp(),
 unique(case_id,case_version),
 foreign key(organization_id,campground_id,case_id)
  references public.safety_enforcement_cases(organization_id,campground_id,id)
);
create index safety_enforcement_events_campground_idx
 on public.safety_enforcement_events(campground_id,occurred_at desc);
create index safety_enforcement_events_actor_idx
 on public.safety_enforcement_events(actor_user_id);

create function icamp_private.validate_safety_enforcement_case() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
        target_guest uuid; facility_kind text; reviewer boolean;
begin
 if tg_op='INSERT' then
  if actor is null or new.created_by_user_id<>actor or new.updated_by_user_id<>actor
   then raise exception 'Actor mismatch'; end if;
  select r.guest_user_id into target_guest from public.reservations r
   where r.id=new.reservation_id and r.campground_id=new.campground_id
    and r.organization_id=new.organization_id and r.status in ('confirmed','checked_in');
  if target_guest is null or target_guest<>new.guest_user_id
   then raise exception 'An active, account-linked reservation is required'; end if;
  if new.scope_type='facility' then
   select a.asset_class into facility_kind from public.operational_assets a
    where a.id=new.facility_id and a.organization_id=new.organization_id
     and a.campground_id=new.campground_id and a.lifecycle_state='active';
   if facility_kind is distinct from 'facility' then
    raise exception 'Select an active campground facility'; end if;
  end if;
  if new.scope_type='access_zone' and not exists(select 1 from public.access_zones z
   where z.id=new.access_zone_id and z.organization_id=new.organization_id
    and z.campground_id=new.campground_id and z.is_active) then
   raise exception 'Select an active access zone'; end if;
  if new.rule_version_id is not null and not exists(
   select 1 from public.campground_rule_versions v
   where v.id=new.rule_version_id and v.campground_id=new.campground_id
    and v.organization_id=new.organization_id) then
    raise exception 'Published rule evidence is outside this campground'; end if;
  if new.row_version<>1 or new.decision_note is not null
   or (new.case_kind='warning' and new.case_state<>'warning_recorded')
   or (new.case_kind='suspension' and new.case_state<>'pending_review') then
   raise exception 'Invalid initial enforcement state'; end if;
  if not icamp_private.has_campground_permission(new.campground_id,
    case when new.case_kind='warning' then 'safety.warning.issue'
    else 'safety.suspension.issue' end) then
   raise exception 'Staff permission required to create this case'; end if;
 else
  if new.id<>old.id or new.organization_id<>old.organization_id
   or new.campground_id<>old.campground_id or new.reservation_id<>old.reservation_id
   or new.guest_user_id<>old.guest_user_id or new.case_kind<>old.case_kind
   or to_jsonb(new)-'case_state'-'decision_note'-'updated_by_user_id'-'updated_at'-'row_version'
      <>to_jsonb(old)-'case_state'-'decision_note'-'updated_by_user_id'-'updated_at'-'row_version'
  then raise exception 'Enforcement case identity and original evidence are immutable'; end if;
  if actor is null or new.updated_by_user_id<>actor or new.row_version<>old.row_version+1
   or new.updated_at<=old.updated_at or new.decision_note is null
   or char_length(trim(new.decision_note)) not between 12 and 2000 then
   raise exception 'Invalid management decision evidence or revision'; end if;
  reviewer := icamp_private.has_campground_permission(new.campground_id,'safety.suspension.review')
   and exists(select 1 from icamp_private.campground_assignments a
     join icamp_private.campground_assignment_roles ar on ar.assignment_id=a.id
     join icamp_private.roles r on r.id=ar.role_id
     where a.user_id=actor and a.campground_id=new.campground_id
      and a.assignment_state='active' and a.starts_at<=statement_timestamp()
      and (a.ends_at is null or a.ends_at>statement_timestamp())
      and r.lifecycle_state='active' and r.role_code in ('campground_manager','owner_admin'));
  if not reviewer then raise exception 'Campground management review required'; end if;
  if old.case_state='pending_review' then
   if new.case_state not in ('active','denied') then
    raise exception 'Suspension request requires approval or denial'; end if;
   if old.created_by_user_id=actor then
    raise exception 'Requester cannot approve or deny their own request'; end if;
  elsif old.case_state='active' then
   if new.case_state<>'reinstated' then raise exception 'Only reinstatement is available'; end if;
  else raise exception 'This enforcement case is terminal'; end if;
 end if;
 return new;
end $$;
create trigger safety_enforcement_validate before insert or update
 on public.safety_enforcement_cases for each row
 execute function icamp_private.validate_safety_enforcement_case();

-- A private trigger alone owns the append-only ledger. icamp_app receives no
-- INSERT privilege on the event table and cannot fabricate audit entries.
create function icamp_private.append_safety_enforcement_event() returns trigger
 language plpgsql security definer set search_path='' as $$
declare kind text; note text;
begin
 kind := case when tg_op='INSERT' and new.case_kind='warning' then 'warning_issued'
  when tg_op='INSERT' then 'suspension_requested'
  when new.case_state='active' then 'suspension_approved'
  when new.case_state='denied' then 'suspension_denied'
  else 'access_reinstated' end;
 note := case when tg_op='INSERT' then new.reason_summary else new.decision_note end;
 insert into public.safety_enforcement_events
  (organization_id,campground_id,case_id,event_kind,resulting_state,case_version,actor_user_id,event_note)
 values(new.organization_id,new.campground_id,new.id,kind,new.case_state,new.row_version,
  new.updated_by_user_id,note);
 return null;
end $$;
revoke all on function icamp_private.append_safety_enforcement_event() from public;
create trigger safety_enforcement_audit after insert or update
 on public.safety_enforcement_cases for each row
 execute function icamp_private.append_safety_enforcement_event();

create function icamp_private.prevent_safety_enforcement_mutation() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin raise exception 'Enforcement audit history is append-only'; end $$;
create trigger safety_enforcement_events_immutable before update or delete
 on public.safety_enforcement_events for each row
 execute function icamp_private.prevent_safety_enforcement_mutation();
create trigger safety_enforcement_cases_no_delete before delete
 on public.safety_enforcement_cases for each row
 execute function icamp_private.prevent_safety_enforcement_mutation();

alter table public.safety_enforcement_cases enable row level security;
alter table public.safety_enforcement_cases force row level security;
alter table public.safety_enforcement_events enable row level security;
alter table public.safety_enforcement_events force row level security;
revoke all on public.safety_enforcement_cases,public.safety_enforcement_events
 from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.safety_enforcement_cases,public.safety_enforcement_events from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert,update on public.safety_enforcement_cases to icamp_app;
grant select on public.safety_enforcement_events to icamp_app;

create policy safety_enforcement_cases_read on public.safety_enforcement_cases
 for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'safety.warning.issue')
 or icamp_private.has_campground_permission(campground_id,'safety.suspension.issue')
 or icamp_private.has_campground_permission(campground_id,'safety.suspension.review')
 or (case_state='active' and guest_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and exists(select 1 from public.reservations r where r.id=reservation_id
   and r.guest_user_id=guest_user_id and r.status in ('confirmed','checked_in')))
);
create policy safety_enforcement_cases_insert on public.safety_enforcement_cases
 for insert to icamp_app with check (
 created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and (case_kind='warning' and icamp_private.has_campground_permission(campground_id,'safety.warning.issue')
  or case_kind='suspension' and icamp_private.has_campground_permission(campground_id,'safety.suspension.issue'))
);
create policy safety_enforcement_cases_update on public.safety_enforcement_cases
 for update to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'safety.suspension.review')
) with check (
 icamp_private.has_campground_permission(campground_id,'safety.suspension.review')
 and updated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
create policy safety_enforcement_events_read on public.safety_enforcement_events
 for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'safety.warning.issue')
 or icamp_private.has_campground_permission(campground_id,'safety.suspension.issue')
 or icamp_private.has_campground_permission(campground_id,'safety.suspension.review')
);

comment on table public.safety_enforcement_cases is
 'Build 083 review-gated administrative enforcement record; does not change physical gate access';
