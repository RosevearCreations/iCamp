-- Build 095 — staff-only consent, version-pinned disclosure and independent manual handoff gate.
-- No automated transmission, digital signing, acceptance, credit issuance or settlement.
create table public.permanent_unit_disclosure_versions (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 jurisdiction text not null check(char_length(trim(jurisdiction)) between 2 and 80),
 version_code text not null check(char_length(trim(version_code)) between 3 and 80),
 document_reference text not null check(char_length(trim(document_reference)) between 8 and 400),
 content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
 legal_review_reference text not null check(char_length(trim(legal_review_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 created_by_user_id uuid not null references icamp_private.user_accounts(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 unique(campground_id,jurisdiction,version_code)
);
create index disclosure_versions_scope_idx on public.permanent_unit_disclosure_versions(campground_id,created_at desc);
create index disclosure_versions_actor_idx on public.permanent_unit_disclosure_versions(created_by_user_id);

create table public.permanent_unit_disclosure_reviews (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 version_id uuid not null unique,
 outcome text not null check(outcome in ('approved_internal_use','rejected')),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,version_id)
  references public.permanent_unit_disclosure_versions(organization_id,campground_id,id)
);
create index disclosure_reviews_actor_idx on public.permanent_unit_disclosure_reviews(reviewed_by_user_id);

create table public.permanent_unit_offer_delivery_consents (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 proposal_id uuid not null unique,
 version_id uuid not null,
 consent_channel text not null check(consent_channel in ('in_person','secure_portal')),
 consent_reference text not null check(char_length(trim(consent_reference)) between 8 and 400),
 recipient_reference text not null check(char_length(trim(recipient_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,proposal_id)
  references public.permanent_unit_financing_term_proposals(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,version_id)
  references public.permanent_unit_disclosure_versions(organization_id,campground_id,id)
);
create index delivery_consents_scope_idx on public.permanent_unit_offer_delivery_consents(campground_id,recorded_at desc);
create index delivery_consents_version_fk_idx on public.permanent_unit_offer_delivery_consents(organization_id,campground_id,version_id);
create index delivery_consents_actor_idx on public.permanent_unit_offer_delivery_consents(recorded_by_user_id);

create table public.permanent_unit_offer_delivery_signoffs (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 consent_id uuid not null unique,
 decision text not null check(decision in ('ready_for_manual_handoff','held')),
 review_reference text not null check(char_length(trim(review_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,consent_id)
  references public.permanent_unit_offer_delivery_consents(organization_id,campground_id,id)
);
create index delivery_signoffs_actor_idx on public.permanent_unit_offer_delivery_signoffs(reviewed_by_user_id);

create function icamp_private.disclosure_review_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare doc record;
begin
 select * into doc from public.permanent_unit_disclosure_versions where id=new.version_id and campground_id=new.campground_id;
 if doc.id is null or doc.created_by_user_id=new.reviewed_by_user_id then
  raise exception 'Independent disclosure review is mandatory'; end if;
 return new;
end $$;
create trigger disclosure_review_guard before insert on public.permanent_unit_disclosure_reviews
 for each row execute function icamp_private.disclosure_review_guard();

create function icamp_private.offer_delivery_consent_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare proposal record; app record; review record;
begin
 select * into proposal from public.permanent_unit_financing_term_proposals where id=new.proposal_id and campground_id=new.campground_id;
 select * into app from public.permanent_unit_financing_applications where id=proposal.application_id;
 select * into review from public.permanent_unit_disclosure_reviews where version_id=new.version_id;
 if proposal.id is null or app.id is null or review.outcome is distinct from 'approved_internal_use'
  or not exists(select 1 from public.permanent_unit_financing_offer_authorizations auth
    where auth.proposal_id=proposal.id and auth.decision='authorized_internal_preparation')
  or exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=app.sale_case_id)
  or not exists(select 1 from public.campgrounds c where c.id=proposal.campground_id and c.lifecycle_state='active') then
  raise exception 'Consent requires approved disclosure, internally authorized current terms and an open sale'; end if;
 if new.recorded_by_user_id in (proposal.drafted_by_user_id,review.reviewed_by_user_id) then
  raise exception 'Consent recording must be independent of draft and disclosure reviewer'; end if;
 return new;
end $$;
create trigger offer_delivery_consent_guard before insert on public.permanent_unit_offer_delivery_consents
 for each row execute function icamp_private.offer_delivery_consent_guard();

create function icamp_private.offer_delivery_signoff_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare consent record; proposal record; app record; auth record;
begin
 select * into consent from public.permanent_unit_offer_delivery_consents where id=new.consent_id and campground_id=new.campground_id;
 select * into proposal from public.permanent_unit_financing_term_proposals where id=consent.proposal_id;
 select * into app from public.permanent_unit_financing_applications where id=proposal.application_id;
 select * into auth from public.permanent_unit_financing_offer_authorizations where proposal_id=proposal.id;
 if consent.id is null or auth.decision is distinct from 'authorized_internal_preparation'
  or new.reviewed_by_user_id in (consent.recorded_by_user_id,proposal.drafted_by_user_id,auth.reviewed_by_user_id,app.opened_by_user_id)
  or (new.decision='ready_for_manual_handoff' and (
   exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=app.sale_case_id)
   or not exists(select 1 from public.campgrounds c where c.id=consent.campground_id and c.lifecycle_state='active'))) then
  raise exception 'Independent sign-off requires valid consent, current open sale and separate operator'; end if;
 return new;
end $$;
create trigger offer_delivery_signoff_guard before insert on public.permanent_unit_offer_delivery_signoffs
 for each row execute function icamp_private.offer_delivery_signoff_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_disclosure_versions','permanent_unit_disclosure_reviews','permanent_unit_offer_delivery_consents','permanent_unit_offer_delivery_signoffs'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on public.%I from %I',tab,role_name); end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
  execute format('create trigger %I before update or delete on public.%I for each row execute function icamp_private.winterization_append_only()',tab||'_immutable',tab);
 end loop;
end $roles$;
create policy disclosure_versions_read on public.permanent_unit_disclosure_versions for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy disclosure_versions_insert on public.permanent_unit_disclosure_versions for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and created_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy disclosure_reviews_read on public.permanent_unit_disclosure_reviews for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy disclosure_reviews_insert on public.permanent_unit_disclosure_reviews for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy delivery_consents_read on public.permanent_unit_offer_delivery_consents for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy delivery_consents_insert on public.permanent_unit_offer_delivery_consents for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy delivery_signoffs_read on public.permanent_unit_offer_delivery_signoffs for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy delivery_signoffs_insert on public.permanent_unit_offer_delivery_signoffs for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.disclosure_review_guard() from public;
revoke all on function icamp_private.offer_delivery_consent_guard() from public;
revoke all on function icamp_private.offer_delivery_signoff_guard() from public;
