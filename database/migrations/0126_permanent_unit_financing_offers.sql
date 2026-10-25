-- Build 094: Non-binding internal term illustration and independent authorization
-- for STAFF PREPARATION only. No lender decision, applicant-facing offer, signature or disbursement.
create table public.permanent_unit_financing_term_proposals (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 application_id uuid not null,
 principal_cents bigint not null check(principal_cents between 1 and 9999999999),
 annual_rate_bps integer not null check(annual_rate_bps between 0 and 6000),
 term_months integer not null check(term_months between 1 and 240),
 upfront_fee_cents bigint not null check(upfront_fee_cents between 0 and 9999999999),
 estimated_monthly_cents bigint not null check(estimated_monthly_cents between 1 and 9999999999),
 policy_reference text not null check(char_length(trim(policy_reference)) between 8 and 400),
 disclosure_reference text not null check(char_length(trim(disclosure_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 drafted_by_user_id uuid not null references icamp_private.user_accounts(id),
 drafted_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,application_id)
  references public.permanent_unit_financing_applications(organization_id,campground_id,id),
 check(upfront_fee_cents<=principal_cents)
);
create index financing_terms_scope_idx on public.permanent_unit_financing_term_proposals(campground_id,drafted_at desc);
create index financing_terms_application_idx on public.permanent_unit_financing_term_proposals(application_id,drafted_at desc);
create index financing_terms_actor_idx on public.permanent_unit_financing_term_proposals(drafted_by_user_id);

create table public.permanent_unit_financing_offer_authorizations (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 proposal_id uuid not null unique,
 decision text not null check(decision in ('authorized_internal_preparation','rejected')),
 external_review_reference text not null check(char_length(trim(external_review_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,proposal_id)
  references public.permanent_unit_financing_term_proposals(organization_id,campground_id,id)
);
create index financing_offer_review_actor_idx on public.permanent_unit_financing_offer_authorizations(reviewed_by_user_id);

create function icamp_private.financing_terms_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare a record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('icamp-financing-offer:'||new.application_id::text,0));
 select * into a from public.permanent_unit_financing_applications
  where id=new.application_id and campground_id=new.campground_id and organization_id=new.organization_id;
 if a.id is null or new.principal_cents>a.requested_amount_cents
  or not exists(select 1 from public.permanent_unit_financing_triage t
   where t.application_id=a.id and t.decision='complete_for_external_review')
  or exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=a.sale_case_id)
  or not exists(select 1 from public.campgrounds p where p.id=a.campground_id and p.lifecycle_state='active') then
  raise exception 'Internal terms require complete intake, within requested amount, active site and unclosed sale';
 end if;
 if exists(select 1 from public.permanent_unit_financing_offer_authorizations o
  join public.permanent_unit_financing_term_proposals p on p.id=o.proposal_id
  where p.application_id=a.id and o.decision='authorized_internal_preparation') then
  raise exception 'An authorized preparation already exists for this financing application';
 end if;
 return new;
end $$;
create trigger financing_terms_guard before insert on public.permanent_unit_financing_term_proposals
 for each row execute function icamp_private.financing_terms_guard();

create function icamp_private.financing_offer_authorization_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p record; a record; t record;
begin
 select * into p from public.permanent_unit_financing_term_proposals
  where id=new.proposal_id and campground_id=new.campground_id and organization_id=new.organization_id;
 select * into a from public.permanent_unit_financing_applications where id=p.application_id;
 if p.id is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('icamp-financing-offer:'||p.application_id::text,0));
 end if;
 select * into t from public.permanent_unit_financing_triage where application_id=a.id;
 if p.id is null or a.id is null or t.decision is distinct from 'complete_for_external_review'
  or new.reviewed_by_user_id in (p.drafted_by_user_id,a.opened_by_user_id,t.reviewed_by_user_id) then
  raise exception 'Offer review must be independent of draft, applicant intake and completeness triage';
 end if;
 if new.decision='authorized_internal_preparation' then
  if exists(select 1 from public.permanent_unit_financing_offer_authorizations o
   join public.permanent_unit_financing_term_proposals prior on prior.id=o.proposal_id
   where prior.application_id=p.application_id and o.decision='authorized_internal_preparation')
   or exists(select 1 from public.permanent_unit_financing_term_proposals later
    where later.application_id=p.application_id and (later.drafted_at,later.id)>(p.drafted_at,p.id))
   or exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=a.sale_case_id)
   or not exists(select 1 from public.campgrounds c where c.id=p.campground_id and c.lifecycle_state='active') then
   raise exception 'Cannot authorize stale, duplicate or closed financing preparation';
  end if;
 end if;
 return new;
end $$;
create trigger financing_offer_authorization_guard before insert on public.permanent_unit_financing_offer_authorizations
 for each row execute function icamp_private.financing_offer_authorization_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_financing_term_proposals','permanent_unit_financing_offer_authorizations'] loop
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
create policy financing_terms_read on public.permanent_unit_financing_term_proposals for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy financing_terms_insert on public.permanent_unit_financing_term_proposals for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and drafted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy financing_offers_read on public.permanent_unit_financing_offer_authorizations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy financing_offers_insert on public.permanent_unit_financing_offer_authorizations for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.financing_terms_guard() from public;
revoke all on function icamp_private.financing_offer_authorization_guard() from public;
