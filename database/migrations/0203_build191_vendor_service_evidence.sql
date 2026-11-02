-- Build 191. Private, immutable vendor planning and evidence only.
-- No external order, dispatch, payment, invoice approval or notifications.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values ('vendor.invoice.review','Independently acknowledge vendor invoice intake without authorizing payment','elevated')
on conflict(permission_key) do nothing;
insert into icamp_private.role_permissions(role_id,permission_key)
select id,'vendor.invoice.review' from icamp_private.roles
where role_kind='template' and lifecycle_state='active'
  and role_code in ('finance','campground_manager','owner_admin')
on conflict do nothing;

create table icamp_private.vendor_profiles (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 display_name text not null check(char_length(trim(display_name)) between 3 and 160),
 service_category text not null check(service_category in ('waste','septic','repairs','infrastructure','grounds','other')),
 contact_name text check(contact_name is null or char_length(trim(contact_name)) between 2 and 160),
 contact_email text check(contact_email is null or (char_length(contact_email) between 6 and 254 and position('@' in contact_email)>1)),
 contact_phone text check(contact_phone is null or char_length(trim(contact_phone)) between 7 and 40),
 private_note text not null check(char_length(trim(private_note)) between 12 and 1000),
 created_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id) on delete restrict
);
create index vendor_profiles_scope_category_idx on icamp_private.vendor_profiles(organization_id,campground_id,service_category,display_name);
create index vendor_profiles_actor_fk_idx on icamp_private.vendor_profiles(created_by_user_id);

create table icamp_private.vendor_contracts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 vendor_id uuid not null,
 supersedes_contract_id uuid,
 contract_reference text not null check(char_length(trim(contract_reference)) between 8 and 120),
 title text not null check(char_length(trim(title)) between 8 and 200),
 valid_from date not null,
 expires_on date not null,
 response_target_hours integer not null check(response_target_hours between 1 and 168),
 completion_target_days integer not null check(completion_target_days between 1 and 180),
 document_media_id uuid,
 private_note text not null check(char_length(trim(private_note)) between 12 and 1500),
 created_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,vendor_id) references icamp_private.vendor_profiles(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,supersedes_contract_id) references icamp_private.vendor_contracts(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,document_media_id) references icamp_private.media_assets(organization_id,campground_id,id) on delete restrict,
 check(expires_on>=valid_from and expires_on<=valid_from+interval '5 years')
);
create unique index vendor_contract_superseded_once_idx on icamp_private.vendor_contracts(supersedes_contract_id) where supersedes_contract_id is not null;
create index vendor_contract_vendor_expiry_idx on icamp_private.vendor_contracts(organization_id,campground_id,vendor_id,expires_on);
create index vendor_contract_media_fk_idx on icamp_private.vendor_contracts(organization_id,campground_id,document_media_id);
create index vendor_contract_actor_fk_idx on icamp_private.vendor_contracts(created_by_user_id);

create table icamp_private.vendor_recurring_plans (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 vendor_id uuid not null,
 contract_id uuid,
 supersedes_plan_id uuid,
 service_label text not null check(char_length(trim(service_label)) between 8 and 160),
 cadence_days integer not null check(cadence_days between 1 and 365),
 next_due_on date not null,
 private_note text not null check(char_length(trim(private_note)) between 12 and 1000),
 created_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,vendor_id) references icamp_private.vendor_profiles(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,contract_id) references icamp_private.vendor_contracts(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,supersedes_plan_id) references icamp_private.vendor_recurring_plans(organization_id,campground_id,id) on delete restrict
);
create unique index vendor_recurring_superseded_once_idx on icamp_private.vendor_recurring_plans(supersedes_plan_id) where supersedes_plan_id is not null;
create index vendor_recurring_due_idx on icamp_private.vendor_recurring_plans(organization_id,campground_id,next_due_on);
create index vendor_recurring_vendor_fk_idx on icamp_private.vendor_recurring_plans(organization_id,campground_id,vendor_id);
create index vendor_recurring_contract_fk_idx on icamp_private.vendor_recurring_plans(organization_id,campground_id,contract_id);
create index vendor_recurring_actor_fk_idx on icamp_private.vendor_recurring_plans(created_by_user_id);

create table icamp_private.vendor_service_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 vendor_id uuid not null,
 contract_id uuid,
 recurring_plan_id uuid,
 work_order_id uuid,
 title text not null check(char_length(trim(title)) between 8 and 180),
 request_description text not null check(char_length(trim(request_description)) between 20 and 2000),
 response_target_hours integer not null check(response_target_hours between 1 and 168),
 completion_target_days integer not null check(completion_target_days between 1 and 180),
 requested_at timestamptz not null default statement_timestamp(),
 response_due_at timestamptz not null,
 completion_due_at timestamptz not null,
 created_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,vendor_id) references icamp_private.vendor_profiles(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,contract_id) references icamp_private.vendor_contracts(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,recurring_plan_id) references icamp_private.vendor_recurring_plans(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,work_order_id) references public.maintenance_work_orders(organization_id,campground_id,id) on delete restrict,
 check(completion_due_at>=response_due_at)
);
create index vendor_service_request_due_idx on icamp_private.vendor_service_requests(organization_id,campground_id,response_due_at,completion_due_at);
create index vendor_service_request_vendor_fk_idx on icamp_private.vendor_service_requests(organization_id,campground_id,vendor_id);
create index vendor_service_request_contract_fk_idx on icamp_private.vendor_service_requests(organization_id,campground_id,contract_id);
create index vendor_service_request_recurring_fk_idx on icamp_private.vendor_service_requests(organization_id,campground_id,recurring_plan_id);
create index vendor_service_request_work_order_fk_idx on icamp_private.vendor_service_requests(organization_id,campground_id,work_order_id);
create index vendor_service_request_actor_fk_idx on icamp_private.vendor_service_requests(created_by_user_id);

create table icamp_private.vendor_service_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 request_id uuid not null,
 kind text not null check(kind in ('response','progress','followup','completed','cancelled','invoice_intake','invoice_reviewed')),
 source_reference text,
 note text not null check(char_length(trim(note)) between 20 and 1500),
 evidence_media_id uuid,
 reviews_event_id uuid,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 recorded_at timestamptz not null default statement_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,request_id) references icamp_private.vendor_service_requests(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,evidence_media_id) references icamp_private.media_assets(organization_id,campground_id,id) on delete restrict,
 foreign key(organization_id,campground_id,reviews_event_id) references icamp_private.vendor_service_events(organization_id,campground_id,id) on delete restrict,
 check((kind='invoice_reviewed' and reviews_event_id is not null) or (kind<>'invoice_reviewed' and reviews_event_id is null)),
 check(source_reference is null or char_length(trim(source_reference)) between 8 and 200),
 check(kind not in ('response','completed','invoice_intake') or source_reference is not null)
);
create unique index vendor_service_invoice_review_once_idx on icamp_private.vendor_service_events(reviews_event_id) where reviews_event_id is not null;
create unique index vendor_service_terminal_once_idx on icamp_private.vendor_service_events(request_id) where kind in ('completed','cancelled');
create index vendor_service_events_request_idx on icamp_private.vendor_service_events(organization_id,campground_id,request_id,recorded_at desc,id desc);
create index vendor_service_events_media_fk_idx on icamp_private.vendor_service_events(organization_id,campground_id,evidence_media_id);
create index vendor_service_events_review_fk_idx on icamp_private.vendor_service_events(organization_id,campground_id,reviews_event_id);
create index vendor_service_events_actor_fk_idx on icamp_private.vendor_service_events(actor_user_id);

create function icamp_private.guard_vendor_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
begin
 if actor is null or actor<>new.created_by_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'vendor.manage') then
   raise exception 'Vendor profile requires an authorized campground manager'; end if;
 return new;
end $$;
create trigger vendor_profile_guard before insert on icamp_private.vendor_profiles for each row execute function icamp_private.guard_vendor_profile();

create function icamp_private.guard_vendor_contract()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 prior record; asset record;
begin
 if actor is null or actor<>new.created_by_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'vendor.manage') then
   raise exception 'Vendor contract requires authorized manager'; end if;
 if new.valid_from<current_date-interval '60 days' or new.valid_from>current_date+interval '3 years' then
   raise exception 'Vendor contract effective date is outside review horizon'; end if;
 if new.supersedes_contract_id is not null then
   select vendor_id,contract_reference into prior from icamp_private.vendor_contracts
    where id=new.supersedes_contract_id and organization_id=new.organization_id and campground_id=new.campground_id;
   if not found or prior.vendor_id<>new.vendor_id then raise exception 'Renewal must supersede a contract for the same vendor'; end if;
 end if;
 if new.document_media_id is not null then
   select classification,media_kind,lifecycle_state,validation_state into asset from icamp_private.media_assets
    where id=new.document_media_id and organization_id=new.organization_id and campground_id=new.campground_id;
   if not found or asset.classification<>'confidential' or asset.media_kind<>'document'
     or asset.lifecycle_state<>'active' or asset.validation_state<>'validated' then
      raise exception 'Contract document must be validated confidential PDF in the same campground'; end if;
 end if;
 return new;
end $$;
create trigger vendor_contract_guard before insert on icamp_private.vendor_contracts for each row execute function icamp_private.guard_vendor_contract();

create function icamp_private.guard_vendor_recurring_plan()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 related_vendor uuid;
begin
 if actor is null or actor<>new.created_by_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'vendor.manage') then
   raise exception 'Recurring vendor reminder requires authorized manager'; end if;
 if new.next_due_on<current_date-interval '365 days' or new.next_due_on>current_date+interval '3 years' then
   raise exception 'Recurring service date is outside the planning horizon'; end if;
 if new.contract_id is not null then
  select vendor_id into related_vendor from icamp_private.vendor_contracts
    where id=new.contract_id and organization_id=new.organization_id and campground_id=new.campground_id;
  if related_vendor is distinct from new.vendor_id then raise exception 'Recurring plan contract belongs to another vendor'; end if;
 end if;
 if new.supersedes_plan_id is not null then
  select vendor_id into related_vendor from icamp_private.vendor_recurring_plans
    where id=new.supersedes_plan_id and organization_id=new.organization_id and campground_id=new.campground_id;
  if related_vendor is distinct from new.vendor_id then raise exception 'Recurring plan replacement belongs to another vendor'; end if;
 end if;
 return new;
end $$;
create trigger vendor_recurring_plan_guard before insert on icamp_private.vendor_recurring_plans for each row execute function icamp_private.guard_vendor_recurring_plan();

create function icamp_private.guard_vendor_service_request()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 contract_row record; plan_row record;
begin
 if actor is null or actor<>new.created_by_user_id
   or not icamp_private.has_campground_permission(new.campground_id,'vendor.manage') then
   raise exception 'Vendor request intake requires authorized manager'; end if;
 if new.contract_id is not null then
  select vendor_id,valid_from,expires_on,response_target_hours,completion_target_days into contract_row
   from icamp_private.vendor_contracts where id=new.contract_id
     and organization_id=new.organization_id and campground_id=new.campground_id;
  if not found or contract_row.vendor_id<>new.vendor_id or contract_row.valid_from>current_date
    or contract_row.expires_on<current_date
    or exists(select 1 from icamp_private.vendor_contracts renewed where renewed.supersedes_contract_id=new.contract_id) then
    raise exception 'Vendor request requires a current contract for this vendor'; end if;
  new.response_target_hours:=contract_row.response_target_hours;
  new.completion_target_days:=contract_row.completion_target_days;
 end if;
 if new.recurring_plan_id is not null then
  select vendor_id,contract_id into plan_row from icamp_private.vendor_recurring_plans
   where id=new.recurring_plan_id and organization_id=new.organization_id and campground_id=new.campground_id;
  if not found or plan_row.vendor_id<>new.vendor_id
    or (plan_row.contract_id is not null and plan_row.contract_id is distinct from new.contract_id)
    or exists(select 1 from icamp_private.vendor_recurring_plans replacement where replacement.supersedes_plan_id=new.recurring_plan_id) then
    raise exception 'Vendor request recurring plan is not current for this vendor and contract'; end if;
 end if;
 new.requested_at:=statement_timestamp();
 new.response_due_at:=new.requested_at+make_interval(hours=>new.response_target_hours);
 new.completion_due_at:=greatest(new.response_due_at,new.requested_at+make_interval(days=>new.completion_target_days));
 return new;
end $$;
create trigger vendor_service_request_guard before insert on icamp_private.vendor_service_requests for each row execute function icamp_private.guard_vendor_service_request();

create function icamp_private.guard_vendor_service_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := nullif(current_setting('icamp.user_id',true),'')::uuid;
 prior record; asset record;
begin
 if actor is null or actor<>new.actor_user_id then raise exception 'Vendor event actor invalid'; end if;
 if new.kind='invoice_reviewed' then
   if not icamp_private.has_campground_permission(new.campground_id,'vendor.invoice.review') then
     raise exception 'Only authorized finance reviewer may acknowledge intake'; end if;
   select kind,actor_user_id,request_id into prior from icamp_private.vendor_service_events
    where id=new.reviews_event_id and organization_id=new.organization_id and campground_id=new.campground_id;
   if not found or prior.kind<>'invoice_intake' or prior.request_id<>new.request_id or prior.actor_user_id=actor then
     raise exception 'Invoice acknowledgement requires independent source intake for same request'; end if;
 else
   if not icamp_private.has_campground_permission(new.campground_id,'vendor.manage') then
     raise exception 'Only authorized vendor manager can record service evidence'; end if;
 end if;
 if new.kind not in ('invoice_intake','invoice_reviewed')
   and exists(select 1 from icamp_private.vendor_service_events previous
    where previous.request_id=new.request_id and previous.kind in ('completed','cancelled')) then
   raise exception 'Closed vendor requests cannot receive more service status evidence'; end if;
 if new.evidence_media_id is not null then
   select classification,lifecycle_state,validation_state into asset from icamp_private.media_assets
    where id=new.evidence_media_id and organization_id=new.organization_id and campground_id=new.campground_id;
   if not found or asset.classification<>'confidential' or asset.lifecycle_state<>'active'
     or asset.validation_state<>'validated' then
    raise exception 'Vendor evidence must be validated confidential media in same campground'; end if;
 end if;
 return new;
end $$;
create trigger vendor_service_event_guard before insert on icamp_private.vendor_service_events for each row execute function icamp_private.guard_vendor_service_event();

-- Retain source integrity: linked confidential evidence must not silently
-- become public, unvalidated, or unavailable while its ledger is immutable.
create function icamp_private.guard_vendor_media_retention()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.classification<>'confidential' or new.validation_state<>'validated' or new.lifecycle_state<>'active')
   and (exists(select 1 from icamp_private.vendor_contracts where document_media_id=old.id)
     or exists(select 1 from icamp_private.vendor_service_events where evidence_media_id=old.id)) then
   raise exception 'Linked vendor confidential source must remain active and validated'; end if;
 return new;
end $$;
create trigger vendor_media_retention before update of classification,validation_state,lifecycle_state
 on icamp_private.media_assets for each row execute function icamp_private.guard_vendor_media_retention();

create function icamp_private.guard_vendor_immutability()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Vendor profiles, contracts, service plans and evidence are immutable'; end $$;

revoke all on function icamp_private.guard_vendor_profile() from public;
revoke all on function icamp_private.guard_vendor_contract() from public;
revoke all on function icamp_private.guard_vendor_recurring_plan() from public;
revoke all on function icamp_private.guard_vendor_service_request() from public;
revoke all on function icamp_private.guard_vendor_service_event() from public;
revoke all on function icamp_private.guard_vendor_media_retention() from public;
revoke all on function icamp_private.guard_vendor_immutability() from public;

do $vendor_immutable$
declare t text;
begin
 foreach t in array array['vendor_profiles','vendor_contracts','vendor_recurring_plans','vendor_service_requests','vendor_service_events'] loop
  execute format('create trigger %I before update or delete on icamp_private.%I for each row execute function icamp_private.guard_vendor_immutability()',t||'_immutable',t);
  execute format('alter table icamp_private.%I enable row level security',t);
  execute format('alter table icamp_private.%I force row level security',t);
  execute format('revoke all on icamp_private.%I from public',t);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on icamp_private.%I from anon',t);end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on icamp_private.%I from authenticated',t);end if;
  execute format('grant select,insert on icamp_private.%I to icamp_app',t);
 end loop;
end $vendor_immutable$;

create policy vendor_profiles_read on icamp_private.vendor_profiles for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'vendor.read')
 or icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_profiles_insert on icamp_private.vendor_profiles for insert to icamp_app with check (
 created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_contracts_read on icamp_private.vendor_contracts for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'vendor.read')
 or icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_contracts_insert on icamp_private.vendor_contracts for insert to icamp_app with check (
 created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_recurring_read on icamp_private.vendor_recurring_plans for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'vendor.read')
 or icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_recurring_insert on icamp_private.vendor_recurring_plans for insert to icamp_app with check (
 created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_requests_read on icamp_private.vendor_service_requests for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'vendor.read')
 or icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_requests_insert on icamp_private.vendor_service_requests for insert to icamp_app with check (
 created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and icamp_private.has_campground_permission(campground_id,'vendor.manage'));
create policy vendor_events_read on icamp_private.vendor_service_events for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'vendor.read')
 or icamp_private.has_campground_permission(campground_id,'vendor.manage')
 or icamp_private.has_campground_permission(campground_id,'vendor.invoice.review'));
create policy vendor_events_insert on icamp_private.vendor_service_events for insert to icamp_app with check (
 actor_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and ( (kind='invoice_reviewed' and icamp_private.has_campground_permission(campground_id,'vendor.invoice.review'))
    or (kind<>'invoice_reviewed' and icamp_private.has_campground_permission(campground_id,'vendor.manage')) ));

comment on table icamp_private.vendor_service_requests is
 'Build191 private owner-approved vendor service request preparation only; no external transmission or financial payable execution.';
