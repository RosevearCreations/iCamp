-- Build 086: audited, manually disseminated emergency communication plans.
-- No transport adapters, emergency dispatch, sirens, gates or automatic delivery.
insert into icamp_private.permission_catalog(permission_key,description,risk_level) values
 ('emergency.notice.read','Read campground-scoped emergency communication plans and event audit.','elevated'),
 ('emergency.notice.draft','Propose emergency communication text and intended audience.','elevated'),
 ('emergency.notice.record','Attest an independently approved manual communication handoff.','high')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,v.permission_key from icamp_private.roles r join (values
 ('owner_admin','emergency.notice.read'),('owner_admin','emergency.notice.draft'),('owner_admin','emergency.notice.record'),
 ('campground_manager','emergency.notice.read'),('campground_manager','emergency.notice.draft'),
 ('campground_manager','emergency.notice.record'),('campground_manager','emergency.broadcast'),
 ('security','emergency.notice.read'),('security','emergency.notice.draft'),('security','emergency.notice.record'),
 ('front_desk','emergency.notice.read'),('front_desk','emergency.notice.draft')
) v(role_code,permission_key) on r.role_code=v.role_code and r.role_kind='template'
on conflict do nothing;

create table public.emergency_notice_plans (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 audience text not null check(audience in ('campground','section','site','staff')),
 section_id uuid,
 accommodation_id uuid,
 severity text not null check(severity in ('advisory','urgent','evacuation')),
 title text not null check(char_length(trim(title)) between 8 and 160),
 message text not null check(char_length(trim(message)) between 32 and 3000),
 onsite_instructions text not null check(char_length(trim(onsite_instructions)) between 32 and 2000),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 foreign key(organization_id,campground_id,section_id)
  references public.campground_sections(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.accommodations(organization_id,campground_id,id),
 check((audience in ('campground','staff') and section_id is null and accommodation_id is null)
    or (audience='section' and section_id is not null and accommodation_id is null)
    or (audience='site' and section_id is null and accommodation_id is not null))
);
create index emergency_notice_scope_idx on public.emergency_notice_plans(campground_id,created_at desc,id desc);
create index emergency_notice_creator_idx on public.emergency_notice_plans(created_by_user_id);
create index emergency_notice_scope_section_fk_idx on public.emergency_notice_plans(organization_id,campground_id,section_id) where section_id is not null;
create index emergency_notice_scope_site_fk_idx on public.emergency_notice_plans(organization_id,campground_id,accommodation_id) where accommodation_id is not null;

create table public.emergency_notice_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 notice_id uuid not null,
 kind text not null check(kind in ('approve','reject','cancel','manual_handoff')),
 method text check(method in ('onsite_pa','posted_signs','staff_briefing','door_to_door','other')),
 evidence_reference text check(evidence_reference is null or char_length(trim(evidence_reference)) between 8 and 400),
 real_world_boundary_ack boolean not null default false,
 onsite_plan_checked boolean not null default false,
 note text not null check(char_length(trim(note)) between 12 and 2000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 occurred_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,notice_id)
  references public.emergency_notice_plans(organization_id,campground_id,id),
 check((kind='approve' and method is null and evidence_reference is null and real_world_boundary_ack and onsite_plan_checked)
    or (kind in ('reject','cancel') and method is null and evidence_reference is null)
    or (kind='manual_handoff' and method is not null and evidence_reference is not null))
);
create unique index emergency_notice_once_decided_idx on public.emergency_notice_events(notice_id) where kind in ('approve','reject');
create unique index emergency_notice_once_cancelled_idx on public.emergency_notice_events(notice_id) where kind='cancel';
create index emergency_notice_event_scope_idx on public.emergency_notice_events(campground_id,notice_id,occurred_at desc,id desc);
create index emergency_notice_event_scope_fk_idx on public.emergency_notice_events(organization_id,campground_id,notice_id);
create index emergency_notice_event_actor_idx on public.emergency_notice_events(actor_user_id);

create function icamp_private.validate_emergency_notice_plan() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if actor is null or actor<>new.created_by_user_id or
  not icamp_private.has_campground_permission(new.campground_id,'emergency.notice.draft') then
  raise exception 'Authorized campground notice drafting required'; end if;
 if not exists(select 1 from public.campgrounds c where c.id=new.campground_id
  and c.organization_id=new.organization_id and c.lifecycle_state<>'archived') then
  raise exception 'Campground is not available for notice planning'; end if;
 if new.section_id is not null and not exists(select 1 from public.campground_sections s
  where s.id=new.section_id and s.campground_id=new.campground_id and s.lifecycle_state='active') then
  raise exception 'Select an active section in this campground'; end if;
 if new.accommodation_id is not null and not exists(select 1 from public.accommodations a
  where a.id=new.accommodation_id and a.campground_id=new.campground_id and a.lifecycle_state='active') then
  raise exception 'Select an active accommodation in this campground'; end if;
 return new;
end $$;
revoke all on function icamp_private.validate_emergency_notice_plan() from public;
create trigger emergency_notice_plan_validate before insert on public.emergency_notice_plans
 for each row execute function icamp_private.validate_emergency_notice_plan();

create function icamp_private.validate_emergency_notice_event() returns trigger
 language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 plan public.emergency_notice_plans%rowtype; prior text; already_cancelled boolean;
begin
 if actor is null or actor<>new.actor_user_id then raise exception 'Authenticated notice actor required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('emergency-notice:'||new.notice_id::text,0));
 select * into plan from public.emergency_notice_plans where id=new.notice_id
  and organization_id=new.organization_id and campground_id=new.campground_id;
 if not found then raise exception 'Notice is outside the selected campground'; end if;
 select e.kind into prior from public.emergency_notice_events e
  where e.notice_id=new.notice_id and e.kind in ('approve','reject')
  order by e.occurred_at desc,e.id desc limit 1;
 select exists(select 1 from public.emergency_notice_events e
  where e.notice_id=new.notice_id and e.kind='cancel') into already_cancelled;
 if new.kind in ('approve','reject') then
  if actor=plan.created_by_user_id then raise exception 'The author cannot approve or reject their own emergency notice'; end if;
  if not icamp_private.has_campground_permission(new.campground_id,'emergency.broadcast') then
   raise exception 'Independent emergency notice approval permission required'; end if;
  if prior is not null or already_cancelled then raise exception 'Emergency notice already decided'; end if;
 elsif new.kind='cancel' then
  if prior<>'approve' or already_cancelled then raise exception 'Only an active approved notice may be cancelled'; end if;
  if not icamp_private.has_campground_permission(new.campground_id,'emergency.broadcast') then
   raise exception 'Management permission required to cancel an approved notice'; end if;
 else
  if prior<>'approve' or already_cancelled then raise exception 'Only active approved notices may record a handoff'; end if;
  if not icamp_private.has_campground_permission(new.campground_id,'emergency.notice.record') then
   raise exception 'Manual handoff requires authorized on-site staff'; end if;
  if not exists(select 1 from public.campgrounds c where c.id=new.campground_id and
   c.organization_id=new.organization_id and c.lifecycle_state='active') then
   raise exception 'Inactive test campgrounds cannot claim a real-world handoff'; end if;
 end if;
 return new;
end $$;
revoke all on function icamp_private.validate_emergency_notice_event() from public;
create trigger emergency_notice_event_validate before insert on public.emergency_notice_events
 for each row execute function icamp_private.validate_emergency_notice_event();

create function icamp_private.emergency_notice_immutable() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin raise exception 'Emergency communication history is append-only'; end $$;
revoke all on function icamp_private.emergency_notice_immutable() from public;
create trigger emergency_notice_plans_immutable before update or delete on public.emergency_notice_plans
 for each row execute function icamp_private.emergency_notice_immutable();
create trigger emergency_notice_events_immutable before update or delete on public.emergency_notice_events
 for each row execute function icamp_private.emergency_notice_immutable();

alter table public.emergency_notice_plans enable row level security;
alter table public.emergency_notice_plans force row level security;
alter table public.emergency_notice_events enable row level security;
alter table public.emergency_notice_events force row level security;
revoke all on public.emergency_notice_plans,public.emergency_notice_events from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.emergency_notice_plans,public.emergency_notice_events from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.emergency_notice_plans,public.emergency_notice_events to icamp_app;
create policy emergency_notice_plans_read on public.emergency_notice_plans for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'emergency.notice.read'));
create policy emergency_notice_plans_insert on public.emergency_notice_plans for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'emergency.notice.draft')
  and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy emergency_notice_events_read on public.emergency_notice_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'emergency.notice.read'));
create policy emergency_notice_events_insert on public.emergency_notice_events for insert to icamp_app
 with check(actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and (icamp_private.has_campground_permission(campground_id,'emergency.broadcast')
 or icamp_private.has_campground_permission(campground_id,'emergency.notice.record')));

comment on table public.emergency_notice_events is
 'Build 086 manual operator emergency communications audit; approval is not emergency dispatch, delivery, receipt or physical evacuation.';
