-- Build 093: Private, consent-attested office financing intake only.
-- No credit decision, external lender submission, banking data or disbursement.
create table public.permanent_unit_financing_applications (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 sale_case_id uuid not null unique,
 requested_amount_cents bigint not null check(requested_amount_cents between 1 and 9999999999),
 applicant_contact_reference text not null check(char_length(trim(applicant_contact_reference)) between 8 and 400),
 consent_reference text not null check(char_length(trim(consent_reference)) between 8 and 400),
 purpose_note text not null check(char_length(trim(purpose_note)) between 12 and 800),
 consent_attested boolean not null check(consent_attested),
 opened_by_user_id uuid not null references icamp_private.user_accounts(id),
 opened_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,sale_case_id)
   references public.permanent_unit_sale_cases(organization_id,campground_id,id)
);
create index financing_applications_scope_idx on public.permanent_unit_financing_applications(campground_id,opened_at desc);
create index financing_applications_actor_idx on public.permanent_unit_financing_applications(opened_by_user_id);

create table public.permanent_unit_financing_evidence (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 application_id uuid not null,
 document_type text not null check(document_type in ('identity_consent','income_reference','unit_sale_terms','disclosures')),
 outcome text not null check(outcome in ('received','defect')),
 source_reference text not null check(char_length(trim(source_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,application_id)
   references public.permanent_unit_financing_applications(organization_id,campground_id,id)
);
create index financing_evidence_latest_idx on public.permanent_unit_financing_evidence(application_id,document_type,recorded_at desc,id desc);
create index financing_evidence_actor_idx on public.permanent_unit_financing_evidence(recorded_by_user_id);

create table public.permanent_unit_financing_triage (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 application_id uuid not null unique,
 decision text not null check(decision in ('complete_for_external_review','returned_incomplete','withdrawn')),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,application_id)
   references public.permanent_unit_financing_applications(organization_id,campground_id,id)
);
create index financing_triage_actor_idx on public.permanent_unit_financing_triage(reviewed_by_user_id);

create function icamp_private.financing_intake_open_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.permanent_unit_sale_cases c
   join public.campgrounds p on p.id=c.campground_id
   where c.id=new.sale_case_id and c.campground_id=new.campground_id
   and c.organization_id=new.organization_id and p.lifecycle_state='active'
   and not exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=c.id)) then
  raise exception 'Financing intake requires an active, unclosed matching sale case';
 end if;
 return new;
end $$;
create trigger financing_intake_open_guard before insert on public.permanent_unit_financing_applications
 for each row execute function icamp_private.financing_intake_open_guard();

create function icamp_private.financing_evidence_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.permanent_unit_financing_triage t where t.application_id=new.application_id) then
  raise exception 'Financing intake is already triaged';
 end if;
 return new;
end $$;
create trigger financing_evidence_guard before insert on public.permanent_unit_financing_evidence
 for each row execute function icamp_private.financing_evidence_guard();

create function icamp_private.financing_triage_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare a record; complete_count integer;
begin
 select * into a from public.permanent_unit_financing_applications where id=new.application_id and campground_id=new.campground_id;
 if a.id is null then raise exception 'Financing application unavailable'; end if;
 if a.opened_by_user_id=new.reviewed_by_user_id or exists(
   select 1 from public.permanent_unit_financing_evidence e
   where e.application_id=a.id and e.recorded_by_user_id=new.reviewed_by_user_id) then
  raise exception 'Financing triage requires independent review';
 end if;
 if new.decision='complete_for_external_review' then
  select count(*) into complete_count from (
   select distinct on(document_type) document_type,outcome
   from public.permanent_unit_financing_evidence where application_id=a.id
   order by document_type,recorded_at desc,id desc
  ) latest where outcome='received';
  if complete_count<>4 then raise exception 'Four current evidence categories required'; end if;
  if exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=a.sale_case_id) then
   raise exception 'Cannot mark intake complete after ownership handoff'; end if;
 end if;
 return new;
end $$;
create trigger financing_triage_guard before insert on public.permanent_unit_financing_triage
 for each row execute function icamp_private.financing_triage_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_financing_applications','permanent_unit_financing_evidence','permanent_unit_financing_triage'] loop
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
create policy financing_app_read on public.permanent_unit_financing_applications for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy financing_app_insert on public.permanent_unit_financing_applications for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and opened_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy financing_evidence_read on public.permanent_unit_financing_evidence for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy financing_evidence_insert on public.permanent_unit_financing_evidence for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy financing_triage_read on public.permanent_unit_financing_triage for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy financing_triage_insert on public.permanent_unit_financing_triage for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.financing_intake_open_guard() from public;
revoke all on function icamp_private.financing_evidence_guard() from public;
revoke all on function icamp_private.financing_triage_guard() from public;
