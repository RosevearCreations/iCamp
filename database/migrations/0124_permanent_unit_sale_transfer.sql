-- Build 092: reviewed permanent-unit sale case and explicit ownership handoff.
-- No transaction here transfers campground land, occupancy rights, money or legal title.

create table public.permanent_unit_sale_cases (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 accommodation_id uuid not null,
 listing_id uuid not null,
 inquiry_id uuid not null,
 seller_ownership_event_id uuid not null,
 buyer_display_name text not null check(char_length(trim(buyer_display_name)) between 3 and 160),
 application_reference text not null check(char_length(trim(application_reference)) between 8 and 400),
 application_note text not null check(char_length(trim(application_note)) between 12 and 1200),
 opened_by_user_id uuid not null references icamp_private.user_accounts(id),
 opened_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,accommodation_id)
  references public.permanent_units(organization_id,campground_id,accommodation_id),
 foreign key(organization_id,campground_id,listing_id)
  references public.permanent_unit_sale_listings(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,inquiry_id)
  references public.permanent_unit_buyer_inquiries(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,seller_ownership_event_id)
  references public.permanent_unit_ownership_events(organization_id,campground_id,id)
);
create unique index permanent_unit_sale_case_one_inquiry_idx on public.permanent_unit_sale_cases(inquiry_id);
create index permanent_unit_sale_cases_scope_idx on public.permanent_unit_sale_cases(campground_id,opened_at desc);
create index permanent_unit_sale_cases_listing_fk_idx on public.permanent_unit_sale_cases(organization_id,campground_id,listing_id);
create index permanent_unit_sale_cases_owner_fk_idx on public.permanent_unit_sale_cases(organization_id,campground_id,seller_ownership_event_id);
create index permanent_unit_sale_cases_opener_fk_idx on public.permanent_unit_sale_cases(opened_by_user_id);

create table public.permanent_unit_sale_evidence (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null,
 step_key text not null check(step_key in ('buyer_application','unit_inspection','fee_receipt','sale_documents','closing_checklist','agreement_replacement')),
 outcome text not null check(outcome in ('pass','defect')),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 1200),
 fee_amount_cents bigint check(fee_amount_cents between 0 and 100000000000),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,case_id)
  references public.permanent_unit_sale_cases(organization_id,campground_id,id),
 check ((step_key='fee_receipt' and fee_amount_cents is not null)
   or (step_key<>'fee_receipt' and fee_amount_cents is null))
);
create index permanent_unit_sale_evidence_latest_idx on public.permanent_unit_sale_evidence(case_id,step_key,recorded_at desc,id desc);
create index permanent_unit_sale_evidence_actor_fk_idx on public.permanent_unit_sale_evidence(recorded_by_user_id);

create table public.permanent_unit_sale_decisions (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null unique,
 decision text not null check(decision in ('approved','rejected')),
 note text not null check(char_length(trim(note)) between 12 and 1200),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,case_id)
  references public.permanent_unit_sale_cases(organization_id,campground_id,id)
);
create index permanent_unit_sale_decisions_actor_fk_idx on public.permanent_unit_sale_decisions(reviewed_by_user_id);

create table public.permanent_unit_sale_handoffs (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null unique,
 new_ownership_event_id uuid not null unique,
 agreement_reference text not null check(char_length(trim(agreement_reference)) between 8 and 400),
 closing_reference text not null check(char_length(trim(closing_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 1200),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,case_id)
  references public.permanent_unit_sale_cases(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,new_ownership_event_id)
  references public.permanent_unit_ownership_events(organization_id,campground_id,id)
);
create index permanent_unit_sale_handoffs_actor_fk_idx on public.permanent_unit_sale_handoffs(recorded_by_user_id);

create or replace function icamp_private.permanent_unit_sale_case_validate()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.permanent_unit_sale_listings l
   join public.permanent_unit_buyer_inquiries i on i.listing_id=l.id
   join public.permanent_unit_ownership_events e on e.id=l.ownership_event_id
   join public.accommodations a on a.id=l.accommodation_id
   join public.campgrounds c on c.id=l.campground_id
   where l.id=new.listing_id and i.id=new.inquiry_id
     and l.campground_id=new.campground_id and l.accommodation_id=new.accommodation_id
     and l.ownership_event_id=new.seller_ownership_event_id
     and l.listing_status='approved' and i.buyer_display_name=new.buyer_display_name
     and a.lifecycle_state='active' and c.lifecycle_state='active'
     and e.id=(select e2.id from public.permanent_unit_ownership_events e2
       where e2.accommodation_id=a.id order by e2.recorded_at desc,e2.id desc limit 1)
     and e.event_kind<>'ownership_ended') then
   raise exception 'Sale case requires current approved listing, matching inquiry and active owner';
 end if;
 return new;
end $$;
create trigger permanent_unit_sale_case_validate before insert on public.permanent_unit_sale_cases
 for each row execute function icamp_private.permanent_unit_sale_case_validate();

create or replace function icamp_private.permanent_unit_sale_evidence_validate()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.permanent_unit_sale_decisions d where d.case_id=new.case_id)
  or exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=new.case_id) then
  raise exception 'Sale evidence is closed after independent decision'; end if;
 return new;
end $$;
create trigger permanent_unit_sale_evidence_validate before insert on public.permanent_unit_sale_evidence
 for each row execute function icamp_private.permanent_unit_sale_evidence_validate();

create or replace function icamp_private.permanent_unit_sale_decision_validate()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c record; current_owner uuid; valid_steps integer;
begin
 select * into c from public.permanent_unit_sale_cases where id=new.case_id and campground_id=new.campground_id;
 if c.id is null then raise exception 'Sale case unavailable'; end if;
 if c.opened_by_user_id=new.reviewed_by_user_id
  or exists(select 1 from public.permanent_unit_sale_evidence e
    where e.case_id=c.id and e.recorded_by_user_id=new.reviewed_by_user_id) then
  raise exception 'Sale review must be independent of applicant and evidence authors'; end if;
 if new.decision='approved' then
  select e.id into current_owner from public.permanent_unit_ownership_events e
   where e.accommodation_id=c.accommodation_id order by e.recorded_at desc,e.id desc limit 1;
  if current_owner is distinct from c.seller_ownership_event_id then
   raise exception 'Seller ownership changed during sale review'; end if;
  select count(*) into valid_steps from (
   select distinct on(step_key) step_key,outcome from public.permanent_unit_sale_evidence
   where case_id=c.id order by step_key,recorded_at desc,id desc
  ) latest where outcome='pass';
  if valid_steps<>6 then raise exception 'All six closing evidence domains must currently pass'; end if;
  if not exists(select 1 from public.campgrounds p join public.accommodations a on a.campground_id=p.id
   where p.id=c.campground_id and a.id=c.accommodation_id
    and p.lifecycle_state='active' and a.lifecycle_state='active') then
   raise exception 'Inactive property cannot approve a sale'; end if;
 end if;
 return new;
end $$;
create trigger permanent_unit_sale_decision_validate before insert on public.permanent_unit_sale_decisions
 for each row execute function icamp_private.permanent_unit_sale_decision_validate();

create or replace function icamp_private.permanent_unit_sale_handoff_validate()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c record; d record; e record;
begin
 select * into c from public.permanent_unit_sale_cases where id=new.case_id and campground_id=new.campground_id;
 select * into d from public.permanent_unit_sale_decisions where case_id=new.case_id;
 select * into e from public.permanent_unit_ownership_events where id=new.new_ownership_event_id;
 if c.id is null or d.decision is distinct from 'approved'
  or new.recorded_by_user_id in (c.opened_by_user_id,d.reviewed_by_user_id)
  or e.accommodation_id is distinct from c.accommodation_id or e.owner_display_name is distinct from c.buyer_display_name
  or e.recorded_by_user_id is distinct from new.recorded_by_user_id or e.event_kind is distinct from 'owner_recorded'
  or e.id is distinct from (select e2.id from public.permanent_unit_ownership_events e2
    where e2.accommodation_id=c.accommodation_id order by e2.recorded_at desc,e2.id desc limit 1) then
  raise exception 'Final handoff requires approved independent case and current new-owner evidence';
 end if;
 return new;
end $$;
create trigger permanent_unit_sale_handoff_validate before insert on public.permanent_unit_sale_handoffs
 for each row execute function icamp_private.permanent_unit_sale_handoff_validate();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_sale_cases','permanent_unit_sale_evidence','permanent_unit_sale_decisions','permanent_unit_sale_handoffs'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',tab,role_name);
   end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
  execute format('create trigger %I before update or delete on public.%I for each row execute function icamp_private.winterization_append_only()',tab||'_immutable',tab);
 end loop;
end $roles$;

create policy permanent_unit_sale_cases_read on public.permanent_unit_sale_cases for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  or icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy permanent_unit_sale_cases_insert on public.permanent_unit_sale_cases for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  and opened_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy permanent_unit_sale_evidence_read on public.permanent_unit_sale_evidence for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  or icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy permanent_unit_sale_evidence_insert on public.permanent_unit_sale_evidence for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy permanent_unit_sale_decisions_read on public.permanent_unit_sale_decisions for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  or icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy permanent_unit_sale_decisions_insert on public.permanent_unit_sale_decisions for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy permanent_unit_sale_handoffs_read on public.permanent_unit_sale_handoffs for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.manage')
  or icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy permanent_unit_sale_handoffs_insert on public.permanent_unit_sale_handoffs for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);

revoke all on function icamp_private.permanent_unit_sale_case_validate() from public;
revoke all on function icamp_private.permanent_unit_sale_evidence_validate() from public;
revoke all on function icamp_private.permanent_unit_sale_decision_validate() from public;
revoke all on function icamp_private.permanent_unit_sale_handoff_validate() from public;
