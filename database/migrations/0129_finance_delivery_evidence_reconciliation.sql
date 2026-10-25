-- Build 097: immutable operational evidence reconciliation and separate closure review.
-- Internal evidence closure is never loan approval, legal delivery certification or agreement acceptance.
create table public.permanent_unit_finance_delivery_reconciliations (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 consent_id uuid not null,
 receipt_id uuid,
 acknowledgement_id uuid,
 disclosure_version_id uuid not null,
 disclosure_sha256 text not null check(disclosure_sha256 ~ '^[a-f0-9]{64}$'),
 last_exception_event_id uuid,
 completeness text not null check(completeness in ('evidence_complete','needs_followup')),
 reconciliation_reference text not null check(char_length(trim(reconciliation_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 prepared_by_user_id uuid not null references icamp_private.user_accounts(id),
 prepared_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,consent_id)
  references public.permanent_unit_offer_delivery_consents(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,receipt_id)
  references public.permanent_unit_manual_delivery_receipts(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,disclosure_version_id)
  references public.permanent_unit_disclosure_versions(organization_id,campground_id,id),
 foreign key(acknowledgement_id) references public.permanent_unit_applicant_acknowledgements(id),
 foreign key(last_exception_event_id) references public.permanent_unit_delivery_exception_events(id)
);
create index finance_delivery_recon_scope_idx on public.permanent_unit_finance_delivery_reconciliations(campground_id,consent_id,prepared_at desc);
create index finance_delivery_recon_actor_idx on public.permanent_unit_finance_delivery_reconciliations(prepared_by_user_id);
create index finance_delivery_recon_receipt_idx on public.permanent_unit_finance_delivery_reconciliations(receipt_id);
create index finance_delivery_recon_ack_idx on public.permanent_unit_finance_delivery_reconciliations(acknowledgement_id);
create index finance_delivery_recon_version_idx on public.permanent_unit_finance_delivery_reconciliations(disclosure_version_id);
create index finance_delivery_recon_exception_idx on public.permanent_unit_finance_delivery_reconciliations(last_exception_event_id);

create table public.permanent_unit_finance_delivery_closure_reviews (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 reconciliation_id uuid not null unique,
 decision text not null check(decision in ('closed_internal_evidence','returned_for_rework')),
 review_reference text not null check(char_length(trim(review_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,reconciliation_id)
  references public.permanent_unit_finance_delivery_reconciliations(organization_id,campground_id,id)
);
create index finance_delivery_closure_actor_idx on public.permanent_unit_finance_delivery_closure_reviews(reviewed_by_user_id);

create function icamp_private.finance_delivery_reconciliation_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare consent record; receipt record; ack record; disclosure record; last_event record; complete boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.consent_id::text,96096));
 select * into consent from public.permanent_unit_offer_delivery_consents
  where id=new.consent_id and campground_id=new.campground_id;
 select * into receipt from public.permanent_unit_manual_delivery_receipts
  where id=new.receipt_id and campground_id=new.campground_id;
 select * into ack from public.permanent_unit_applicant_acknowledgements
  where id=new.acknowledgement_id and campground_id=new.campground_id;
 select * into disclosure from public.permanent_unit_disclosure_versions
  where id=new.disclosure_version_id and campground_id=new.campground_id;
 select * into last_event from public.permanent_unit_delivery_exception_events
  where consent_id=new.consent_id order by recorded_at desc,id desc limit 1;
 if consent.id is null or disclosure.id is null or new.disclosure_version_id<>consent.version_id
  or new.disclosure_sha256<>disclosure.content_sha256
  or (new.receipt_id is not null and (receipt.id is null or receipt.consent_id<>consent.id))
  or (new.acknowledgement_id is not null and (ack.id is null or ack.receipt_id is distinct from receipt.id)) then
  raise exception 'Evidence reconciliation must match the exact consent, receipt and disclosure digest'; end if;
 if new.last_exception_event_id is distinct from last_event.id then
  raise exception 'Exception snapshot has changed; refresh the evidence before reconciling'; end if;
 complete := receipt.id is not null and ack.id is not null and ack.response='receipt_confirmed'
  and last_event.event_type is distinct from 'hold'
  and exists(select 1 from public.permanent_unit_offer_delivery_signoffs s
   where s.consent_id=consent.id and s.id=receipt.signoff_id and s.decision='ready_for_manual_handoff');
 if new.completeness is distinct from (case when complete then 'evidence_complete' else 'needs_followup' end) then
  raise exception 'Reconciliation classification must match current immutable evidence'; end if;
 if new.prepared_by_user_id in (consent.recorded_by_user_id,receipt.recorded_by_user_id,ack.recorded_by_user_id) then
  raise exception 'Reconciliation preparer must be independent of consent, delivery and applicant-response recording'; end if;
 return new;
end $$;
create trigger finance_delivery_reconciliation_guard before insert on public.permanent_unit_finance_delivery_reconciliations
 for each row execute function icamp_private.finance_delivery_reconciliation_guard();

create function icamp_private.finance_delivery_closure_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare recon record; consent record; receipt record; ack record; signoff record; latest record; application record;
begin
 select * into recon from public.permanent_unit_finance_delivery_reconciliations
  where id=new.reconciliation_id and campground_id=new.campground_id;
 if recon.id is null then raise exception 'Reconciliation record is unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(recon.consent_id::text,96096));
 select * into consent from public.permanent_unit_offer_delivery_consents where id=recon.consent_id;
 select * into receipt from public.permanent_unit_manual_delivery_receipts where id=recon.receipt_id;
 select * into ack from public.permanent_unit_applicant_acknowledgements where id=recon.acknowledgement_id;
 select * into signoff from public.permanent_unit_offer_delivery_signoffs where consent_id=consent.id;
 select * into latest from public.permanent_unit_delivery_exception_events
  where consent_id=consent.id order by recorded_at desc,id desc limit 1;
 select a.* into application from public.permanent_unit_financing_term_proposals p
  join public.permanent_unit_financing_applications a on a.id=p.application_id where p.id=consent.proposal_id;
 if new.reviewed_by_user_id in (recon.prepared_by_user_id,consent.recorded_by_user_id,
   receipt.recorded_by_user_id,ack.recorded_by_user_id,signoff.reviewed_by_user_id) then
  raise exception 'Closure reviewer must be independent of evidence preparation and handoff'; end if;
 if new.decision='closed_internal_evidence' and (
  recon.completeness<>'evidence_complete' or receipt.id is null or ack.response is distinct from 'receipt_confirmed'
  or signoff.decision is distinct from 'ready_for_manual_handoff'
  or latest.id is distinct from recon.last_exception_event_id or latest.event_type='hold'
  or exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=application.sale_case_id)
  or not exists(select 1 from public.campgrounds c where c.id=consent.campground_id and c.lifecycle_state='active')
  or exists(select 1 from public.permanent_unit_finance_delivery_closure_reviews old_review
    join public.permanent_unit_finance_delivery_reconciliations old_recon on old_recon.id=old_review.reconciliation_id
    where old_recon.consent_id=consent.id and old_review.decision='closed_internal_evidence')) then
  raise exception 'Internal evidence closure requires current independently verified, unheld receipt lineage'; end if;
 return new;
end $$;
create trigger finance_delivery_closure_guard before insert on public.permanent_unit_finance_delivery_closure_reviews
 for each row execute function icamp_private.finance_delivery_closure_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_delivery_reconciliations','permanent_unit_finance_delivery_closure_reviews'] loop
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
create policy finance_delivery_recon_read on public.permanent_unit_finance_delivery_reconciliations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy finance_delivery_recon_insert on public.permanent_unit_finance_delivery_reconciliations for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and prepared_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_delivery_closure_read on public.permanent_unit_finance_delivery_closure_reviews for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy finance_delivery_closure_insert on public.permanent_unit_finance_delivery_closure_reviews for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_delivery_reconciliation_guard() from public;
revoke all on function icamp_private.finance_delivery_closure_guard() from public;
