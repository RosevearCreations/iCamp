-- Build 098 — private exception ageing observations, independent re-review and owner escalation ledger.
-- No automated delivery, notifications, loan decisions, legal release or clearing of holds.
create table public.permanent_unit_finance_exception_reviews (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 consent_id uuid not null,
 reconciliation_id uuid,
 exception_event_id uuid,
 observation_state text not null check(observation_state in ('open_hold','cleared_history','followup')),
 observed_since timestamptz not null,
 review_decision text not null check(review_decision in ('continue_monitoring','request_owner_escalation','recommend_manual_clearance')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 next_review_at timestamptz not null,
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,consent_id)
  references public.permanent_unit_offer_delivery_consents(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,reconciliation_id)
  references public.permanent_unit_finance_delivery_reconciliations(organization_id,campground_id,id),
 foreign key(exception_event_id) references public.permanent_unit_delivery_exception_events(id),
 check(next_review_at > observed_since)
);
create index finance_exception_reviews_scope_idx on public.permanent_unit_finance_exception_reviews(campground_id,consent_id,reviewed_at desc);
create index finance_exception_reviews_actor_idx on public.permanent_unit_finance_exception_reviews(reviewed_by_user_id);
create index finance_exception_reviews_recon_idx on public.permanent_unit_finance_exception_reviews(reconciliation_id);
create index finance_exception_reviews_event_idx on public.permanent_unit_finance_exception_reviews(exception_event_id);

create table public.permanent_unit_finance_owner_escalations (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 exception_review_id uuid not null unique,
 target_owner_user_id uuid not null references icamp_private.user_accounts(id),
 priority text not null check(priority in ('standard','urgent','critical')),
 escalation_reference text not null check(char_length(trim(escalation_reference)) between 8 and 400),
 requested_action text not null check(char_length(trim(requested_action)) between 12 and 800),
 due_at timestamptz not null,
 escalated_by_user_id uuid not null references icamp_private.user_accounts(id),
 escalated_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,exception_review_id)
  references public.permanent_unit_finance_exception_reviews(organization_id,campground_id,id),
 check(target_owner_user_id<>escalated_by_user_id)
);
create index finance_owner_escalations_scope_idx on public.permanent_unit_finance_owner_escalations(campground_id,due_at);
create index finance_owner_escalations_target_idx on public.permanent_unit_finance_owner_escalations(target_owner_user_id);
create index finance_owner_escalations_actor_idx on public.permanent_unit_finance_owner_escalations(escalated_by_user_id);

create table public.permanent_unit_finance_owner_responses (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 escalation_id uuid not null unique,
 response text not null check(response in ('accepted_followup','returned_for_rework')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 responded_by_user_id uuid not null references icamp_private.user_accounts(id),
 responded_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,campground_id,escalation_id)
  references public.permanent_unit_finance_owner_escalations(organization_id,campground_id,id)
);
create index finance_owner_responses_scope_idx on public.permanent_unit_finance_owner_responses(campground_id,responded_at desc);
create index finance_owner_responses_actor_idx on public.permanent_unit_finance_owner_responses(responded_by_user_id);

create function icamp_private.finance_exception_review_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare consent record; previous_review record; latest record; recon record; receipt record; snapshot_state text; source_time timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.consent_id::text,96096));
 select * into consent from public.permanent_unit_offer_delivery_consents where id=new.consent_id and campground_id=new.campground_id;
 select * into latest from public.permanent_unit_delivery_exception_events
  where consent_id=new.consent_id order by recorded_at desc,id desc limit 1;
 select * into recon from public.permanent_unit_finance_delivery_reconciliations where id=new.reconciliation_id and campground_id=new.campground_id;
 if consent.id is null or new.exception_event_id is distinct from latest.id
  or (new.reconciliation_id is not null and (recon.id is null or recon.consent_id<>consent.id)) then
  raise exception 'Re-review must match current consent, reconciliation and exception snapshot'; end if;
 if latest.event_type='hold' then
  snapshot_state:='open_hold';
  source_time:=latest.recorded_at;
 elsif latest.id is not null then
  snapshot_state:='cleared_history';
  source_time:=latest.recorded_at;
 else
  snapshot_state:='followup';
  source_time:=coalesce(recon.prepared_at,consent.recorded_at);
 end if;
 if new.observation_state<>snapshot_state
  or new.next_review_at<=clock_timestamp()
  or new.next_review_at>clock_timestamp()+interval '90 days'
  or new.review_decision='recommend_manual_clearance' and snapshot_state<>'open_hold' then
  raise exception 'Ageing must follow the latest immutable event and a bounded next review date'; end if;
 new.observed_since:=source_time;
 select * into previous_review from public.permanent_unit_finance_exception_reviews
  where consent_id=new.consent_id order by reviewed_at desc,id desc limit 1;
 if new.reviewed_by_user_id=consent.recorded_by_user_id
  or new.reviewed_by_user_id=latest.recorded_by_user_id
  or new.reviewed_by_user_id=recon.prepared_by_user_id
  or new.reviewed_by_user_id=previous_review.reviewed_by_user_id then
  raise exception 'Exception re-review requires a fresh independent operator'; end if;
 return new;
end $$;
create trigger finance_exception_review_guard before insert on public.permanent_unit_finance_exception_reviews
 for each row execute function icamp_private.finance_exception_review_guard();

create function icamp_private.finance_owner_escalation_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare review record; latest record;
begin
 select * into review from public.permanent_unit_finance_exception_reviews where id=new.exception_review_id and campground_id=new.campground_id;
 if review.id is null then raise exception 'Independent re-review required for owner escalation'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(review.consent_id::text,96096));
 select * into latest from public.permanent_unit_delivery_exception_events where consent_id=review.consent_id order by recorded_at desc,id desc limit 1;
 if review.review_decision<>'request_owner_escalation' or review.exception_event_id is distinct from latest.id
  or new.escalated_by_user_id=review.reviewed_by_user_id
  or new.target_owner_user_id=review.reviewed_by_user_id
  or new.due_at<=clock_timestamp() or new.due_at>clock_timestamp()+interval '30 days'
  or exists(select 1 from public.permanent_unit_finance_owner_escalations prior
    join public.permanent_unit_finance_exception_reviews prev on prev.id=prior.exception_review_id
    left join public.permanent_unit_finance_owner_responses resp on resp.escalation_id=prior.id
    where prev.consent_id=review.consent_id and resp.id is null) then
  raise exception 'Owner escalation needs current review, distinct operator and no outstanding escalation'; end if;
 return new;
end $$;
create trigger finance_owner_escalation_guard before insert on public.permanent_unit_finance_owner_escalations
 for each row execute function icamp_private.finance_owner_escalation_guard();

create function icamp_private.finance_owner_response_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare escalation record;
begin
 select * into escalation from public.permanent_unit_finance_owner_escalations where id=new.escalation_id and campground_id=new.campground_id;
 if escalation.id is null or new.responded_by_user_id<>escalation.target_owner_user_id then
  raise exception 'Only the designated owner can acknowledge an escalation'; end if;
 return new;
end $$;
create trigger finance_owner_response_guard before insert on public.permanent_unit_finance_owner_responses
 for each row execute function icamp_private.finance_owner_response_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_exception_reviews','permanent_unit_finance_owner_escalations','permanent_unit_finance_owner_responses'] loop
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
create policy finance_exception_review_read on public.permanent_unit_finance_exception_reviews for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy finance_exception_review_insert on public.permanent_unit_finance_exception_reviews for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_owner_escalation_read on public.permanent_unit_finance_owner_escalations for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy finance_owner_escalation_insert on public.permanent_unit_finance_owner_escalations for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and escalated_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_owner_response_read on public.permanent_unit_finance_owner_responses for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy finance_owner_response_insert on public.permanent_unit_finance_owner_responses for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
  and responded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_exception_review_guard() from public;
revoke all on function icamp_private.finance_owner_escalation_guard() from public;
revoke all on function icamp_private.finance_owner_response_guard() from public;
