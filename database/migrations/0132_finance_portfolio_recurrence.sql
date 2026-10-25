-- Build 100: operator-only observation of repeated manual delivery exceptions.
-- The recurrence ledger neither modifies holds nor authorizes credit, contracts or communication.
create table public.permanent_unit_finance_recurrence_reviews (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 consent_id uuid not null,
 latest_exception_event_id uuid,
 reason_code text not null check(reason_code in ('identity_mismatch','disclosure_dispute','delivery_failure','consent_withdrawn','other')),
 observed_reason_hold_count integer not null check(observed_reason_hold_count >= 2),
 observed_escalation_count integer not null check(observed_escalation_count >= 0),
 review_disposition text not null check(review_disposition in ('continue_monitoring','recommend_owner_review','record_pattern_for_followup')),
 next_review_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id,consent_id)
  references public.permanent_unit_offer_delivery_consents(organization_id,campground_id,id),
 foreign key(latest_exception_event_id) references public.permanent_unit_delivery_exception_events(id)
);
create index finance_recurrence_reviews_scope_idx on public.permanent_unit_finance_recurrence_reviews(campground_id,consent_id,reason_code,reviewed_at desc);
create index finance_recurrence_reviews_actor_idx on public.permanent_unit_finance_recurrence_reviews(reviewed_by_user_id);
create index finance_recurrence_reviews_event_idx on public.permanent_unit_finance_recurrence_reviews(latest_exception_event_id);

create function icamp_private.finance_recurrence_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare consent record; latest_event record; last_review record; count_holds integer; count_escalations integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.consent_id::text,96096));
 select * into consent from public.permanent_unit_offer_delivery_consents
  where id=new.consent_id and campground_id=new.campground_id and organization_id=new.organization_id;
 select * into latest_event from public.permanent_unit_delivery_exception_events
  where consent_id=new.consent_id and campground_id=new.campground_id order by recorded_at desc,id desc limit 1;
 select count(*)::integer into count_holds from public.permanent_unit_delivery_exception_events
  where consent_id=new.consent_id and campground_id=new.campground_id and event_type='hold' and reason_code=new.reason_code;
 select count(*)::integer into count_escalations from public.permanent_unit_finance_owner_escalations e
  join public.permanent_unit_finance_exception_reviews r on r.id=e.exception_review_id
  where r.consent_id=new.consent_id and r.campground_id=new.campground_id;
 select * into last_review from public.permanent_unit_finance_recurrence_reviews
  where consent_id=new.consent_id and reason_code=new.reason_code order by reviewed_at desc,id desc limit 1;
 if consent.id is null or latest_event.id is null or new.latest_exception_event_id is distinct from latest_event.id
  or count_holds < 2 or new.observed_reason_hold_count<>count_holds or new.observed_escalation_count<>count_escalations
  or new.reviewed_by_user_id in (latest_event.recorded_by_user_id,last_review.reviewed_by_user_id)
  or new.next_review_at<=clock_timestamp() or new.next_review_at>clock_timestamp()+interval '90 days' then
  raise exception 'Recurrence requires current matching evidence, repeated holds and independent bounded review'; end if;
 return new;
end $$;
create trigger finance_recurrence_review_guard before insert on public.permanent_unit_finance_recurrence_reviews
 for each row execute function icamp_private.finance_recurrence_review_guard();

alter table public.permanent_unit_finance_recurrence_reviews enable row level security;
alter table public.permanent_unit_finance_recurrence_reviews force row level security;
revoke all on public.permanent_unit_finance_recurrence_reviews from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.permanent_unit_finance_recurrence_reviews from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.permanent_unit_finance_recurrence_reviews to icamp_app;
create trigger permanent_unit_finance_recurrence_reviews_immutable before update or delete on public.permanent_unit_finance_recurrence_reviews
 for each row execute function icamp_private.winterization_append_only();
create policy finance_recurrence_review_read on public.permanent_unit_finance_recurrence_reviews for select to icamp_app
 using(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer'));
create policy finance_recurrence_review_insert on public.permanent_unit_finance_recurrence_reviews for insert to icamp_app
 with check(icamp_private.has_campground_permission(campground_id,'permanent_unit.transfer')
 and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_recurrence_review_guard() from public;
