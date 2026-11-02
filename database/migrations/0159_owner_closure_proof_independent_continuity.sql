-- Build 129: immutable independent review of owner replay-gap decisions.
-- This evidence-only ledger cannot release holds or change payments or transfers.
create table public.owner_export_owner_decision_independent_continuity_reviews (
 id uuid primary key,
 owner_decision_id uuid not null unique references public.owner_export_independent_recheck_owner_decisions(id),
 replay_owner_decision_id uuid not null references public.owner_export_independent_recheck_owner_decisions(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in
  ('continue_exception_watch','request_disposition_evidence','renew_independent_escalation','confirm_proof_continuity')),
 next_due_at timestamptz,
 observed_owner_days_overdue integer not null default 0 check(observed_owner_days_overdue>=0),
 observed_peer_open_owner_decisions integer not null default 0 check(observed_peer_open_owner_decisions>=0),
 observed_peer_overdue_owner_decisions integer not null default 0 check(observed_peer_overdue_owner_decisions>=0),
 observed_recent_escalation_renewals integer not null default 0 check(observed_recent_escalation_renewals>=0),
 observed_open_independent_rechecks integer not null default 0 check(observed_open_independent_rechecks>=0),
 observed_replay_is_newer boolean not null default false,
 observed_prior_chain_complete boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint independent_continuity_review_pair check(source_campground_id<>target_campground_id),
 constraint independent_continuity_review_due check(
  (review_kind='confirm_proof_continuity' and next_due_at is null)
  or (review_kind<>'confirm_proof_continuity' and next_due_at is not null))
);
create index owner_decision_independent_continuity_pair_idx
 on public.owner_export_owner_decision_independent_continuity_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create function icamp_private.owner_decision_independent_continuity_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare owner_record record; replay_record record; recheck_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,129129));
 select * into owner_record from public.owner_export_independent_recheck_owner_decisions
  where id=new.owner_decision_id;
 select * into replay_record from public.owner_export_independent_recheck_owner_decisions
  where id=new.replay_owner_decision_id;
 if owner_record.id is null or replay_record.id is null
  or owner_record.source_campground_id<>new.source_campground_id
  or owner_record.target_campground_id<>new.target_campground_id
  or replay_record.source_campground_id<>new.source_campground_id
  or replay_record.target_campground_id<>new.target_campground_id then
  raise exception 'Independent proof review and owner disposition replay must match the ordered campground pair'; end if;
 select * into recheck_record from public.owner_export_independent_disposition_rechecks
  where id=owner_record.independent_recheck_id;
 if new.reviewed_by_user_id=owner_record.recorded_by_user_id
  or new.reviewed_by_user_id=recheck_record.reviewed_by_user_id
  or new.reviewed_by_user_id=replay_record.recorded_by_user_id then
  raise exception 'Independent proof reviewer must be separate from owner decision, replay author and rechecker'; end if;
 new.reviewed_at:=clock_timestamp();
 new.observed_replay_is_newer:=replay_record.recorded_at>owner_record.recorded_at;
 new.observed_prior_chain_complete:=owner_record.observed_closure_proof_chain_complete
  and owner_record.decision_kind='acknowledge_closure_proof'
  and recheck_record.recheck_kind='confirm_closure_continuity_recheck';
 if new.replay_owner_decision_id<>new.owner_decision_id and not new.observed_replay_is_newer then
  raise exception 'A distinct owner disposition replay must be newer than the source decision'; end if;
 select count(*) filter(where d.decision_kind<>'acknowledge_closure_proof')::int,
        count(*) filter(where d.decision_kind<>'acknowledge_closure_proof'
          and d.next_due_at<new.reviewed_at)::int,
        count(*) filter(where d.decision_kind='renew_escalation_exception'
          and d.recorded_at>=new.reviewed_at-interval '90 days')::int
 into new.observed_peer_open_owner_decisions,new.observed_peer_overdue_owner_decisions,
      new.observed_recent_escalation_renewals
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id
  and d.target_campground_id=new.target_campground_id and d.id<>owner_record.id;
 select count(*)::int into new.observed_open_independent_rechecks
 from public.owner_export_independent_disposition_rechecks r
 where r.source_campground_id=new.source_campground_id
  and r.target_campground_id=new.target_campground_id
  and r.id<>recheck_record.id and r.recheck_kind<>'confirm_closure_continuity_recheck';
 new.observed_owner_days_overdue:=case when owner_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from(new.reviewed_at-owner_record.next_due_at))/86400))::int end;
 if new.review_kind='confirm_proof_continuity' then
  if not new.observed_prior_chain_complete or new.replay_owner_decision_id<>owner_record.id
   or new.observed_peer_open_owner_decisions>0
   or new.observed_peer_overdue_owner_decisions>0
   or new.observed_open_independent_rechecks>0
   or new.observed_recent_escalation_renewals>0 then
   raise exception 'Independent closure requires original verified proof and no open, overdue or renewed peer exceptions'; end if;
 else
  if owner_record.decision_kind='acknowledge_closure_proof' then
   raise exception 'Confirmed owner closure proof requires independent continuity confirmation'; end if;
  if new.next_due_at is null or new.next_due_at<=new.reviewed_at
   or new.next_due_at>new.reviewed_at+interval '90 days' then
   raise exception 'Independent exception follow-up must be due within 90 days'; end if;
  if (owner_record.decision_kind='renew_escalation_exception'
   or new.observed_owner_days_overdue>=30 or new.observed_peer_overdue_owner_decisions>0
   or new.observed_recent_escalation_renewals>=2)
   and new.review_kind<>'renew_independent_escalation' then
   raise exception 'Repeated, escalated or 30-day-overdue exceptions require independent escalation renewal'; end if;
  if new.review_kind='continue_exception_watch' and
   (new.observed_owner_days_overdue>0 or new.observed_peer_open_owner_decisions>0
    or new.observed_replay_is_newer) then
   raise exception 'Passive watch is allowed only for timely unchanged evidence with no open peers'; end if;
 end if;
 return new;
end $$;
create trigger owner_decision_independent_continuity_guard before insert
 on public.owner_export_owner_decision_independent_continuity_reviews for each row
 execute function icamp_private.owner_decision_independent_continuity_guard();
create trigger owner_decision_independent_continuity_immutable before update or delete
 on public.owner_export_owner_decision_independent_continuity_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_owner_decision_independent_continuity_reviews enable row level security;
alter table public.owner_export_owner_decision_independent_continuity_reviews force row level security;
revoke all on public.owner_export_owner_decision_independent_continuity_reviews from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_owner_decision_independent_continuity_reviews from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_owner_decision_independent_continuity_reviews to icamp_app;
create policy owner_decision_independent_continuity_read
 on public.owner_export_owner_decision_independent_continuity_reviews for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_decision_independent_continuity_insert
 on public.owner_export_owner_decision_independent_continuity_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_decision_independent_continuity_guard() from public;
