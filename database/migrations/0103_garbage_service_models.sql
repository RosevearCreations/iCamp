-- Build 079: campground waste services and pickup operational ledger.
-- Charges are quoted only; billing remains with the canonical payment system.

insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values
 ('garbage.read','View campground waste service and pickup records.','standard'),
 ('garbage.configure','Configure campground waste streams, service methods and prices.','elevated'),
 ('garbage.dispatch','Record and dispatch campground pickup requests.','standard')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (values
 ('owner_admin','garbage.read'),('owner_admin','garbage.configure'),('owner_admin','garbage.dispatch'),
 ('campground_manager','garbage.read'),('campground_manager','garbage.configure'),('campground_manager','garbage.dispatch'),
 ('maintenance_main_foreman','garbage.read'),('maintenance_main_foreman','garbage.dispatch'),
 ('maintenance_foreman','garbage.read'),('maintenance_foreman','garbage.dispatch'),
 ('maintenance_lead','garbage.read'),('maintenance_lead','garbage.dispatch'),
 ('front_desk','garbage.read'),('front_desk','garbage.dispatch')
) as grants(role_code,permission_key) on grants.role_code=r.role_code and r.role_kind='template'
join icamp_private.permission_catalog p on p.permission_key=grants.permission_key
on conflict do nothing;

create table public.garbage_service_policies (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 stream text not null check(stream in ('garbage','recycling','organics')),
 service_mode text not null check(service_mode in ('central_bins','included_site_pickup','scheduled_site_pickup','paid_on_demand')),
 enabled boolean not null default true,
 weekday smallint check(weekday between 0 and 6),
 fee_cents integer not null default 0 check(fee_cents between 0 and 1000000),
 currency_code char(3) not null default 'CAD' check(currency_code='CAD'),
 instructions text check(instructions is null or char_length(instructions)<=1000),
 location_description text check(location_description is null or char_length(location_description)<=240),
 updated_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 row_version bigint not null default 1 check(row_version>0),
 unique(organization_id,campground_id,id),
 unique(campground_id,stream,service_mode),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 constraint garbage_policy_fee check (
  (service_mode='paid_on_demand' and fee_cents>0)
  or (service_mode<>'paid_on_demand' and fee_cents=0)
 ),
 constraint garbage_policy_schedule check (
  (service_mode='scheduled_site_pickup' and weekday is not null)
  or (service_mode<>'scheduled_site_pickup' and weekday is null)
 )
);

create index garbage_service_policies_scope_idx
 on public.garbage_service_policies(organization_id,campground_id,enabled);
create index garbage_service_policies_actor_fk_idx
 on public.garbage_service_policies(updated_by_user_id);

create table public.garbage_pickup_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 policy_id uuid not null,
 accommodation_id uuid not null,
 reservation_id uuid,
 client_request_id uuid not null,
 stream text not null check(stream in ('garbage','recycling','organics')),
 service_mode text not null check(service_mode in ('included_site_pickup','scheduled_site_pickup','paid_on_demand')),
 fee_cents integer not null default 0 check(fee_cents between 0 and 1000000),
 currency_code char(3) not null default 'CAD' check(currency_code='CAD'),
 -- No payment is presumed or captured by this operational record.
 billing_state text not null default 'not_applicable'
  check(billing_state in ('not_applicable','pending_checkout','paid_externally','waived')),
 state text not null default 'requested'
  check(state in ('requested','scheduled','in_progress','completed','cancelled')),
 scheduled_for timestamptz,
 completed_at timestamptz,
 note text check(note is null or char_length(note)<=1000),
 completion_note text check(completion_note is null or char_length(completion_note)<=1000),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 updated_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 row_version bigint not null default 1 check(row_version>0),
 unique(organization_id,campground_id,id),
 unique(campground_id,client_request_id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id),
 foreign key(organization_id,campground_id,policy_id)
   references public.garbage_service_policies(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
   references public.accommodations(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reservation_id)
   references public.reservations(organization_id,campground_id,id),
 constraint garbage_pickup_fee_state check (
   (service_mode='paid_on_demand' and fee_cents>0)
   or (service_mode<>'paid_on_demand' and fee_cents=0 and billing_state='not_applicable')
 ),
 constraint garbage_pickup_completion check (
   (state='completed' and completed_at is not null)
   or (state<>'completed' and completed_at is null)
 )
);

create index garbage_pickup_requests_queue_idx
 on public.garbage_pickup_requests(campground_id,state,scheduled_for,created_at);
create index garbage_pickup_requests_policy_fk_idx
 on public.garbage_pickup_requests(organization_id,campground_id,policy_id);
create index garbage_pickup_requests_accommodation_fk_idx
 on public.garbage_pickup_requests(organization_id,campground_id,accommodation_id);
create index garbage_pickup_requests_reservation_fk_idx
 on public.garbage_pickup_requests(organization_id,campground_id,reservation_id);
create index garbage_pickup_requests_creator_fk_idx
 on public.garbage_pickup_requests(created_by_user_id);
create index garbage_pickup_requests_updater_fk_idx
 on public.garbage_pickup_requests(updated_by_user_id);

create table public.garbage_pickup_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 pickup_id uuid not null,
 event_type text not null check(event_type in ('requested','scheduled','started','completed','cancelled','note')),
 note text check(note is null or char_length(note)<=1000),
 actor_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default now(),
 foreign key(organization_id,campground_id,pickup_id)
  references public.garbage_pickup_requests(organization_id,campground_id,id)
);
create index garbage_pickup_events_request_idx
 on public.garbage_pickup_events(organization_id,campground_id,pickup_id,created_at);
create index garbage_pickup_events_actor_fk_idx
 on public.garbage_pickup_events(actor_user_id);

create function icamp_private.guard_garbage_pickup_update()
returns trigger language plpgsql as $$
begin
 if old.state in ('completed','cancelled') then
  raise exception 'Terminal garbage pickup cannot be changed';
 end if;
 if (old.state,new.state) not in (
  ('requested','scheduled'),('requested','cancelled'),
  ('scheduled','in_progress'),('scheduled','cancelled'),
  ('in_progress','completed'),('in_progress','cancelled')
 ) then
  raise exception 'Invalid garbage pickup state transition';
 end if;
 if (new.organization_id,new.campground_id,new.policy_id,new.accommodation_id,
     new.reservation_id,new.client_request_id,new.stream,new.service_mode,
     new.fee_cents,new.currency_code,new.created_by_user_id,new.created_at)
    is distinct from
    (old.organization_id,old.campground_id,old.policy_id,old.accommodation_id,
     old.reservation_id,old.client_request_id,old.stream,old.service_mode,
     old.fee_cents,old.currency_code,old.created_by_user_id,old.created_at) then
  raise exception 'Immutable pickup evidence cannot be rewritten';
 end if;
 if new.row_version<>old.row_version+1 then
  raise exception 'Pickup row version must increment';
 end if;
 new.updated_at=statement_timestamp();
 return new;
end $$;
create trigger garbage_pickup_guard before update on public.garbage_pickup_requests
 for each row execute function icamp_private.guard_garbage_pickup_update();

create function icamp_private.reject_garbage_event_mutation()
returns trigger language plpgsql as $$
begin
 raise exception 'Garbage pickup events are append-only';
end $$;
create trigger garbage_pickup_events_append_only
 before update or delete on public.garbage_pickup_events
 for each row execute function icamp_private.reject_garbage_event_mutation();

alter table public.garbage_service_policies enable row level security;
alter table public.garbage_service_policies force row level security;
alter table public.garbage_pickup_requests enable row level security;
alter table public.garbage_pickup_requests force row level security;
alter table public.garbage_pickup_events enable row level security;
alter table public.garbage_pickup_events force row level security;

revoke all on public.garbage_service_policies,public.garbage_pickup_requests,
 public.garbage_pickup_events from public,anon,authenticated;
grant select,insert,update on public.garbage_service_policies to icamp_app;
grant select,insert,update on public.garbage_pickup_requests to icamp_app;
grant select,insert on public.garbage_pickup_events to icamp_app;

create policy garbage_policies_read on public.garbage_service_policies
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'garbage.read')
  or icamp_private.has_campground_permission(campground_id,'garbage.configure')
  or icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 );
create policy garbage_policies_insert on public.garbage_service_policies
 for insert to icamp_app with check (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
  and updated_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
 );
create policy garbage_policies_update on public.garbage_service_policies
 for update to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
 ) with check (
  icamp_private.has_campground_permission(campground_id,'garbage.configure')
  and updated_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
 );
create policy garbage_pickups_read on public.garbage_pickup_requests
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'garbage.read')
  or icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 );
create policy garbage_pickups_insert on public.garbage_pickup_requests
 for insert to icamp_app with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and created_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and updated_by_user_id=created_by_user_id
 );
create policy garbage_pickups_update on public.garbage_pickup_requests
 for update to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 ) with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and updated_by_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
 );
create policy garbage_events_read on public.garbage_pickup_events
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'garbage.read')
  or icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
 );
create policy garbage_events_insert on public.garbage_pickup_events
 for insert to icamp_app with check (
  icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
  and actor_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
 );

-- Extend the existing site read policy rather than adding a duplicate
-- permissive SELECT policy that would trigger the Supabase advisor.
alter policy accommodations_read on public.accommodations using (
 icamp_private.has_campground_permission(campground_id,'accommodation.read')
 or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
 or icamp_private.has_campground_permission(campground_id,'campground.operations.manage')
 or icamp_private.has_campground_permission(campground_id,'visitor.read')
 or icamp_private.has_campground_permission(campground_id,'visitor.register')
 or icamp_private.has_campground_permission(campground_id,'garbage.read')
 or icamp_private.has_campground_permission(campground_id,'garbage.dispatch')
);
