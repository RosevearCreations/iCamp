-- Build 096 — separate staff attestations of manual handoff, applicant response and exception holds.
-- None of these records is a signature, legal service certificate, binding acceptance or loan approval.
create table public.permanent_unit_manual_delivery_receipts (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 consent_id uuid not null unique,
 signoff_id uuid not null unique,
 channel text not null check(channel in ('in_person','secure_portal')),
 delivered_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 recipient_verification_reference text not null check(char_length(trim(recipient_verification_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,consent_id)
  references public.permanent_unit_offer_delivery_consents(organization_id,campground_id,id),
 foreign key(signoff_id)
  references public.permanent_unit_offer_delivery_signoffs(id)
);
create index manual_delivery_receipts_scope_idx on public.permanent_unit_manual_delivery_receipts(campground_id,recorded_at desc);
create index manual_delivery_receipts_actor_idx on public.permanent_unit_manual_delivery_receipts(recorded_by_user_id);

create table public.permanent_unit_applicant_acknowledgements (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 receipt_id uuid not null unique,
 response text not null check(response in ('receipt_confirmed','receipt_disputed','no_response')),
 response_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,receipt_id)
  references public.permanent_unit_manual_delivery_receipts(organization_id,campground_id,id)
);
create index applicant_ack_scope_idx on public.permanent_unit_applicant_acknowledgements(campground_id,recorded_at desc);
create index applicant_ack_actor_idx on public.permanent_unit_applicant_acknowledgements(recorded_by_user_id);

create table public.permanent_unit_delivery_exception_events (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 consent_id uuid not null,
 event_type text not null check(event_type in ('hold','clear')),
 reason_code text not null check(reason_code in ('identity_mismatch','disclosure_dispute','delivery_failure','consent_withdrawn','other')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,consent_id)
  references public.permanent_unit_offer_delivery_consents(organization_id,campground_id,id)
);
create index delivery_exception_scope_idx on public.permanent_unit_delivery_exception_events(campground_id,consent_id,recorded_at desc,id desc);
create index delivery_exception_actor_idx on public.permanent_unit_delivery_exception_events(recorded_by_user_id);

create function icamp_private.delivery_exception_is_held(p_consent uuid) returns boolean
 language sql stable security invoker set search_path='' as $$
 select coalesce((select event_type='hold' from public.permanent_unit_delivery_exception_events
  where consent_id=p_consent order by recorded_at desc,id desc limit 1),false)
$$;
create function icamp_private.delivery_exception_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare last_event record;
begin
 -- Serialize events without requiring UPDATE on immutable consent rows.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.consent_id::text,96096));
 select * into last_event from public.permanent_unit_delivery_exception_events
  where consent_id=new.consent_id order by recorded_at desc,id desc limit 1;
 if (new.event_type='hold' and last_event.event_type='hold')
  or (new.event_type='clear' and (last_event.id is null or last_event.event_type<>'hold')) then
  raise exception 'Exception event must alternate between hold and independent clear'; end if;
 if new.event_type='clear' and new.recorded_by_user_id=last_event.recorded_by_user_id then
  raise exception 'An exception hold requires a different staff member to clear'; end if;
 return new;
end $$;
create trigger delivery_exception_guard before insert on public.permanent_unit_delivery_exception_events
 for each row execute function icamp_private.delivery_exception_guard();

create function icamp_private.manual_delivery_receipt_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare consent record; signoff record; proposal record; application record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.consent_id::text,96096));
 select * into consent from public.permanent_unit_offer_delivery_consents where id=new.consent_id and campground_id=new.campground_id;
 select * into signoff from public.permanent_unit_offer_delivery_signoffs where id=new.signoff_id and campground_id=new.campground_id;
 select * into proposal from public.permanent_unit_financing_term_proposals where id=consent.proposal_id;
 select * into application from public.permanent_unit_financing_applications where id=proposal.application_id;
 if consent.id is null or signoff.consent_id is distinct from consent.id
  or signoff.decision is distinct from 'ready_for_manual_handoff'
  or new.channel is distinct from consent.consent_channel
  or new.delivered_at<signoff.reviewed_at or new.delivered_at>clock_timestamp()+interval '5 minutes'
  or new.recorded_by_user_id in (consent.recorded_by_user_id,signoff.reviewed_by_user_id,proposal.drafted_by_user_id)
  or icamp_private.delivery_exception_is_held(consent.id)
  or exists(select 1 from public.permanent_unit_sale_handoffs h where h.case_id=application.sale_case_id)
  or not exists(select 1 from public.campgrounds c where c.id=consent.campground_id and c.lifecycle_state='active') then
  raise exception 'Manual receipt requires independent attestation, matching ready sign-off and no active exception'; end if;
 return new;
end $$;
create trigger manual_delivery_receipt_guard before insert on public.permanent_unit_manual_delivery_receipts
 for each row execute function icamp_private.manual_delivery_receipt_guard();

create function icamp_private.applicant_ack_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare receipt record;
begin
 select * into receipt from public.permanent_unit_manual_delivery_receipts where id=new.receipt_id and campground_id=new.campground_id;
 if receipt.id is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(receipt.consent_id::text,96096));
 end if;
 if receipt.id is null or new.response_at<receipt.delivered_at or new.response_at>clock_timestamp()+interval '5 minutes'
  or new.recorded_by_user_id=receipt.recorded_by_user_id
  or (new.response='receipt_confirmed' and icamp_private.delivery_exception_is_held(receipt.consent_id)) then
  raise exception 'Applicant response requires separate recording and no open exception for confirmation'; end if;
 return new;
end $$;
create trigger applicant_ack_guard before insert on public.permanent_unit_applicant_acknowledgements
 for each row execute function icamp_private.applicant_ack_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_manual_delivery_receipts','permanent_unit_applicant_acknowledgements','permanent_unit_delivery_exception_events'] loop
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
create policy manual_receipt_read on public.permanent_unit_manual_delivery_receipts for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy manual_receipt_insert on public.permanent_unit_manual_delivery_receipts for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy applicant_ack_read on public.permanent_unit_applicant_acknowledgements for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy applicant_ack_insert on public.permanent_unit_applicant_acknowledgements for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy delivery_exception_read on public.permanent_unit_delivery_exception_events for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy delivery_exception_insert on public.permanent_unit_delivery_exception_events for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.delivery_exception_is_held(uuid) from public;
revoke all on function icamp_private.delivery_exception_guard() from public;
revoke all on function icamp_private.manual_delivery_receipt_guard() from public;
revoke all on function icamp_private.applicant_ack_guard() from public;
grant execute on function icamp_private.delivery_exception_is_held(uuid) to icamp_app;
