-- Build 190: private staff scheduling, availability, independently verified
-- qualifications and handoff evidence. No payroll, notifications or dispatch.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values ('staff.shift.self','View own shifts, submit availability and record assigned-shift handoffs','standard')
on conflict(permission_key) do nothing;
insert into icamp_private.role_permissions(role_id,permission_key)
select id,'staff.shift.self' from icamp_private.roles
where role_kind='template' and lifecycle_state='active'
on conflict do nothing;

create table icamp_private.staff_shift_availability (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 staff_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 kind text not null check(kind in ('unavailable','clear')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 clears_event_id uuid references icamp_private.staff_shift_availability(id) on delete restrict,
 reason text not null check(char_length(trim(reason)) between 12 and 500),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '60 days'),
 check((kind='unavailable' and clears_event_id is null) or (kind='clear' and clears_event_id is not null)),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create unique index staff_shift_availability_clear_unique on icamp_private.staff_shift_availability(clears_event_id) where clears_event_id is not null;
create index staff_shift_availability_scope_idx on icamp_private.staff_shift_availability(organization_id,campground_id,staff_user_id,starts_at,ends_at);
create index staff_shift_availability_staff_fk_idx on icamp_private.staff_shift_availability(staff_user_id);
create index staff_shift_availability_actor_fk_idx on icamp_private.staff_shift_availability(recorded_by_user_id);

create table icamp_private.staff_shift_qualification_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 staff_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 qualification_key text not null check(qualification_key in ('pool_lifeguard','waterfront_monitor','equipment_operator','food_safety','first_aid')),
 decision text not null check(decision in ('verify','revoke')),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 300),
 valid_until timestamptz,
 review_note text not null check(char_length(trim(review_note)) between 20 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 reviewed_at timestamptz not null default statement_timestamp(),
 check((decision='verify' and valid_until is not null) or (decision='revoke' and valid_until is null)),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create index staff_shift_qualification_latest_idx on icamp_private.staff_shift_qualification_events(campground_id,staff_user_id,qualification_key,reviewed_at desc,id desc);
create index staff_shift_qualification_scope_fk_idx on icamp_private.staff_shift_qualification_events(organization_id,campground_id);
create index staff_shift_qualification_staff_fk_idx on icamp_private.staff_shift_qualification_events(staff_user_id);
create index staff_shift_qualification_reviewer_fk_idx on icamp_private.staff_shift_qualification_events(reviewed_by_user_id);

create table icamp_private.staff_shift_assignments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 staff_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 department text not null check(department in ('front_desk','housekeeping','grounds','maintenance','security','store','aquatics','waterfront','equipment','food_service')),
 role_label text not null check(char_length(trim(role_label)) between 3 and 100),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 assignment_note text not null check(char_length(trim(assignment_note)) between 12 and 1000),
 created_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 check(ends_at>=starts_at+interval '30 minutes' and ends_at<=starts_at+interval '16 hours'),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create index staff_shift_assignment_staff_time_idx on icamp_private.staff_shift_assignments(staff_user_id,starts_at,ends_at);
create index staff_shift_assignment_scope_time_idx on icamp_private.staff_shift_assignments(organization_id,campground_id,starts_at);
create index staff_shift_assignment_creator_fk_idx on icamp_private.staff_shift_assignments(created_by_user_id);

create table icamp_private.staff_shift_handoffs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 from_shift_id uuid not null,
 to_shift_id uuid,
 summary text not null check(char_length(trim(summary)) between 20 and 1500),
 outstanding_work text not null check(char_length(trim(outstanding_work)) between 20 and 1500),
 follow_up_required boolean not null default true,
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,from_shift_id) references icamp_private.staff_shift_assignments(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,to_shift_id) references icamp_private.staff_shift_assignments(organization_id,campground_id,id) on delete restrict,
 check(to_shift_id is null or to_shift_id<>from_shift_id)
);
create index staff_shift_handoffs_from_fk_idx on icamp_private.staff_shift_handoffs(organization_id,campground_id,from_shift_id);
create index staff_shift_handoffs_to_fk_idx on icamp_private.staff_shift_handoffs(organization_id,campground_id,to_shift_id);
create index staff_shift_handoffs_actor_fk_idx on icamp_private.staff_shift_handoffs(recorded_by_user_id);

create table icamp_private.staff_shift_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 shift_id uuid not null,
 handoff_id uuid,
 kind text not null check(kind in ('cancel','handoff_ack')),
 reason text not null check(char_length(trim(reason)) between 20 and 600),
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id,shift_id) references icamp_private.staff_shift_assignments(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,handoff_id) references icamp_private.staff_shift_handoffs(organization_id,campground_id,id) on delete restrict,
 check((kind='cancel' and handoff_id is null) or (kind='handoff_ack' and handoff_id is not null))
);
create unique index staff_shift_events_cancel_unique on icamp_private.staff_shift_events(shift_id) where kind='cancel';
create unique index staff_shift_events_ack_unique on icamp_private.staff_shift_events(handoff_id) where kind='handoff_ack';
create index staff_shift_events_scope_shift_fk_idx on icamp_private.staff_shift_events(organization_id,campground_id,shift_id);
create index staff_shift_events_scope_handoff_fk_idx on icamp_private.staff_shift_events(organization_id,campground_id,handoff_id);
create index staff_shift_events_actor_fk_idx on icamp_private.staff_shift_events(actor_user_id);

create function icamp_private.staff_shift_has_assignment(p_campground uuid,p_staff uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from icamp_private.campground_assignments a
 join icamp_private.user_accounts u on u.id=a.user_id
 where a.campground_id=p_campground and a.user_id=p_staff
 and a.assignment_state='active' and a.starts_at<=statement_timestamp()
 and (a.ends_at is null or a.ends_at>statement_timestamp())
 and u.account_type='staff' and u.account_state='active');
$$;
revoke all on function icamp_private.staff_shift_has_assignment(uuid,uuid) from public;
grant execute on function icamp_private.staff_shift_has_assignment(uuid,uuid) to icamp_app;

create function icamp_private.staff_shift_required_qualification(p_department text)
returns text language sql immutable security invoker set search_path='' as $$
select case p_department
 when 'aquatics' then 'pool_lifeguard'
 when 'waterfront' then 'waterfront_monitor'
 when 'equipment' then 'equipment_operator'
 when 'food_service' then 'food_safety'
 else null end;
$$;
revoke all on function icamp_private.staff_shift_required_qualification(text) from public;
grant execute on function icamp_private.staff_shift_required_qualification(text) to icamp_app;

create function icamp_private.guard_staff_shift_availability()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 original icamp_private.staff_shift_availability%rowtype;
begin
 if actor is null or actor<>new.recorded_by_user_id or actor<>new.staff_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'staff.shift.self')
   or not icamp_private.staff_shift_has_assignment(new.campground_id,new.staff_user_id) then
   raise exception 'Only current staff may record their own availability'; end if;
 if new.kind='clear' then
   select * into original from icamp_private.staff_shift_availability
    where id=new.clears_event_id and organization_id=new.organization_id and campground_id=new.campground_id
     and staff_user_id=new.staff_user_id and kind='unavailable';
   if not found or new.starts_at<>original.starts_at or new.ends_at<>original.ends_at then
     raise exception 'Availability clearance must match an existing own unavailability window'; end if;
 end if;
 return new;
end $$;
create trigger staff_shift_availability_guard before insert on icamp_private.staff_shift_availability
 for each row execute function icamp_private.guard_staff_shift_availability();

create function icamp_private.guard_staff_shift_qualification()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if actor is null or actor<>new.reviewed_by_user_id or actor=new.staff_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
   or not icamp_private.staff_shift_has_assignment(new.campground_id,new.staff_user_id) then
   raise exception 'Independent campground staff manager must verify this qualification'; end if;
 if new.decision='verify' and (new.valid_until<=statement_timestamp()
   or new.valid_until>statement_timestamp()+interval '3 years') then
   raise exception 'Qualification expiry must be current and within three years'; end if;
 return new;
end $$;
create trigger staff_shift_qualification_guard before insert on icamp_private.staff_shift_qualification_events
 for each row execute function icamp_private.guard_staff_shift_qualification();

create function icamp_private.guard_staff_shift_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 needed text; latest record;
begin
 if actor is null or actor<>new.created_by_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'schedule.manage')
   or not icamp_private.staff_shift_has_assignment(new.campground_id,new.staff_user_id) then
   raise exception 'Authorized manager and current staff assignment required'; end if;
 if new.starts_at<statement_timestamp()-interval '1 hour' or new.starts_at>statement_timestamp()+interval '180 days' then
   raise exception 'Shifts must be within the 180-day planning horizon'; end if;
 perform pg_advisory_xact_lock(hashtextextended('staff-shift:'||new.staff_user_id::text,0));
 if exists(select 1 from icamp_private.staff_shift_assignments s
    where s.staff_user_id=new.staff_user_id and s.starts_at<new.ends_at and s.ends_at>new.starts_at
      and not exists(select 1 from icamp_private.staff_shift_events e where e.shift_id=s.id and e.kind='cancel')) then
   raise exception 'Shift overlaps an existing active assignment'; end if;
 if exists(select 1 from icamp_private.staff_shift_availability a
    where a.staff_user_id=new.staff_user_id and a.campground_id=new.campground_id and a.kind='unavailable'
      and a.starts_at<new.ends_at and a.ends_at>new.starts_at
      and not exists(select 1 from icamp_private.staff_shift_availability cleared where cleared.clears_event_id=a.id)) then
   raise exception 'Shift overlaps declared staff unavailability'; end if;
 needed := icamp_private.staff_shift_required_qualification(new.department);
 if needed is not null then
   select q.decision,q.valid_until into latest from icamp_private.staff_shift_qualification_events q
    where q.campground_id=new.campground_id and q.staff_user_id=new.staff_user_id and q.qualification_key=needed
    order by q.reviewed_at desc,q.id desc limit 1;
   if not found or latest.decision<>'verify' or latest.valid_until<new.ends_at then
     raise exception 'Unqualified or expiring staff cannot be assigned to this sensitive department'; end if;
 end if;
 return new;
end $$;
create trigger staff_shift_assignment_guard before insert on icamp_private.staff_shift_assignments
 for each row execute function icamp_private.guard_staff_shift_assignment();

create function icamp_private.guard_staff_shift_handoff()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 source_staff uuid; target_start timestamptz; source_end timestamptz;
begin
 select staff_user_id,ends_at into source_staff,source_end from icamp_private.staff_shift_assignments
  where id=new.from_shift_id and organization_id=new.organization_id and campground_id=new.campground_id;
 if actor is null or actor<>new.recorded_by_user_id or source_staff is null
   or (actor<>source_staff and not icamp_private.has_campground_permission(new.campground_id,'schedule.manage'))
   or not icamp_private.staff_shift_has_assignment(new.campground_id,source_staff) then
   raise exception 'Handoff must be recorded by source shift staff or authorized manager'; end if;
 if exists(select 1 from icamp_private.staff_shift_events e where e.shift_id=new.from_shift_id and e.kind='cancel') then
   raise exception 'Cancelled shifts cannot create new handoffs'; end if;
 if new.to_shift_id is not null then
   select starts_at into target_start from icamp_private.staff_shift_assignments
    where id=new.to_shift_id and organization_id=new.organization_id and campground_id=new.campground_id;
   if target_start is null or target_start<source_end-interval '12 hours' then
     raise exception 'Handoff destination must be a later shift in the same campground'; end if;
 end if;
 return new;
end $$;
create trigger staff_shift_handoff_guard before insert on icamp_private.staff_shift_handoffs
 for each row execute function icamp_private.guard_staff_shift_handoff();

create function icamp_private.guard_staff_shift_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 target_staff uuid; target_shift uuid;
begin
 select staff_user_id into target_staff from icamp_private.staff_shift_assignments
  where id=new.shift_id and organization_id=new.organization_id and campground_id=new.campground_id;
 if actor is null or actor<>new.actor_user_id or target_staff is null then
   raise exception 'Shift event actor or scope invalid'; end if;
 if new.kind='cancel' then
   if not icamp_private.has_campground_permission(new.campground_id,'schedule.manage') then
     raise exception 'Only authorized schedule manager may cancel shifts'; end if;
 else
   select to_shift_id into target_shift from icamp_private.staff_shift_handoffs
    where id=new.handoff_id and organization_id=new.organization_id and campground_id=new.campground_id;
   if target_shift is null or target_shift<>new.shift_id or actor<>target_staff
     or not icamp_private.staff_shift_has_assignment(new.campground_id,actor)
     or not icamp_private.has_campground_permission(new.campground_id,'staff.shift.self') then
     raise exception 'Only assigned receiving staff can acknowledge their handoff'; end if;
   if exists(select 1 from icamp_private.staff_shift_events e where e.shift_id=new.shift_id and e.kind='cancel') then
     raise exception 'Cancelled destination shift cannot acknowledge handoff'; end if;
 end if;
 return new;
end $$;
create trigger staff_shift_event_guard before insert on icamp_private.staff_shift_events
 for each row execute function icamp_private.guard_staff_shift_event();

revoke all on function icamp_private.guard_staff_shift_availability() from public;
revoke all on function icamp_private.guard_staff_shift_qualification() from public;
revoke all on function icamp_private.guard_staff_shift_assignment() from public;
revoke all on function icamp_private.guard_staff_shift_handoff() from public;
revoke all on function icamp_private.guard_staff_shift_event() from public;

create function icamp_private.guard_staff_shift_immutability()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Staff shift, availability, qualification and handoff evidence is immutable'; end $$;
revoke all on function icamp_private.guard_staff_shift_immutability() from public;

do $immutable$
declare table_name text;
begin
 foreach table_name in array array['staff_shift_availability','staff_shift_qualification_events',
   'staff_shift_assignments','staff_shift_handoffs','staff_shift_events'] loop
   execute format('create trigger %I before update or delete on icamp_private.%I for each row execute function icamp_private.guard_staff_shift_immutability()',
     table_name||'_immutable',table_name);
 end loop;
end $immutable$;

do $permissions$
declare table_name text; role_name text;
begin
 foreach table_name in array array['staff_shift_availability','staff_shift_qualification_events',
   'staff_shift_assignments','staff_shift_handoffs','staff_shift_events'] loop
   execute format('alter table icamp_private.%I enable row level security',table_name);
   execute format('alter table icamp_private.%I force row level security',table_name);
   execute format('revoke all on icamp_private.%I from public',table_name);
   foreach role_name in array array['anon','authenticated'] loop
     if exists(select 1 from pg_roles where rolname=role_name) then
       execute format('revoke all on icamp_private.%I from %I',table_name,role_name);
     end if;
   end loop;
   execute format('grant select,insert on icamp_private.%I to icamp_app',table_name);
 end loop;
end $permissions$;

create policy staff_shift_availability_read on icamp_private.staff_shift_availability
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'schedule.manage')
  or (staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and icamp_private.has_campground_permission(campground_id,'staff.shift.self')));
create policy staff_shift_availability_insert on icamp_private.staff_shift_availability
 for insert to icamp_app with check (
  staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and recorded_by_user_id=staff_user_id
  and icamp_private.has_campground_permission(campground_id,'staff.shift.self'));
create policy staff_shift_qualification_read on icamp_private.staff_shift_qualification_events
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'staff.manage')
  or (staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and icamp_private.has_campground_permission(campground_id,'staff.shift.self')));
create policy staff_shift_qualification_insert on icamp_private.staff_shift_qualification_events
 for insert to icamp_app with check (
  reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and staff_user_id<>reviewed_by_user_id
  and icamp_private.has_campground_permission(campground_id,'staff.manage'));
create policy staff_shift_assignments_read on icamp_private.staff_shift_assignments
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'schedule.manage')
  or (staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and icamp_private.has_campground_permission(campground_id,'staff.shift.self')));
create policy staff_shift_assignments_insert on icamp_private.staff_shift_assignments
 for insert to icamp_app with check (
  created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and icamp_private.has_campground_permission(campground_id,'schedule.manage'));
create policy staff_shift_handoffs_read on icamp_private.staff_shift_handoffs
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'schedule.manage')
  or (icamp_private.has_campground_permission(campground_id,'staff.shift.self')
    and exists(select 1 from icamp_private.staff_shift_assignments s
      where s.organization_id=staff_shift_handoffs.organization_id
      and s.campground_id=staff_shift_handoffs.campground_id
      and s.id in (staff_shift_handoffs.from_shift_id,staff_shift_handoffs.to_shift_id)
      and s.staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid)));
create policy staff_shift_handoffs_insert on icamp_private.staff_shift_handoffs
 for insert to icamp_app with check (
  recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (icamp_private.has_campground_permission(campground_id,'schedule.manage')
    or (icamp_private.has_campground_permission(campground_id,'staff.shift.self')
      and exists(select 1 from icamp_private.staff_shift_assignments s
        where s.id=from_shift_id and s.campground_id=staff_shift_handoffs.campground_id
        and s.staff_user_id=recorded_by_user_id))));
create policy staff_shift_events_read on icamp_private.staff_shift_events
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'schedule.manage')
  or (icamp_private.has_campground_permission(campground_id,'staff.shift.self')
    and (exists(select 1 from icamp_private.staff_shift_assignments s
      where s.id=staff_shift_events.shift_id and s.campground_id=staff_shift_events.campground_id
        and s.staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid)
      or (staff_shift_events.kind='handoff_ack' and exists(
        select 1 from icamp_private.staff_shift_handoffs h
          join icamp_private.staff_shift_assignments source_shift on source_shift.id=h.from_shift_id
          and source_shift.organization_id=h.organization_id and source_shift.campground_id=h.campground_id
        where h.id=staff_shift_events.handoff_id and h.campground_id=staff_shift_events.campground_id
          and source_shift.staff_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid)))));
create policy staff_shift_events_insert on icamp_private.staff_shift_events
 for insert to icamp_app with check (
  actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and ( (kind='cancel' and icamp_private.has_campground_permission(campground_id,'schedule.manage'))
    or (kind='handoff_ack' and icamp_private.has_campground_permission(campground_id,'staff.shift.self'))));

comment on table icamp_private.staff_shift_assignments is
 'Build 190 privately scoped immutable staff shift plans. Sensitive qualifications are checked at insert and neither this plan nor handoff evidence performs payroll, dispatch or physical safety clearance.';
