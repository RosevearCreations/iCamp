-- Build 132: independently recheck reopened-exception continuity, resolve overdue
-- evidence and verify a later closure follow-up. All records are append-only;
-- none of these receipts releases an operational hold or changes finances.
create table public.owner_export_continuity_resolution_followups (
 id uuid primary key,
 aging_review_id uuid not null references public.owner_export_reopened_exception_aging_reviews(id),
 prior_followup_id uuid unique references public.owner_export_continuity_resolution_followups(id),
 verified_followup_event_id uuid references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 followup_kind text not null check(followup_kind in
  ('independent_continuity_recheck','overdue_exception_resolution','verified_closure_followup')),
 outcome_kind text not null check(outcome_kind in
  ('continuity_watch_renewed','recurrence_gap_escalated','continuity_recheck_confirmed',
   'resolution_evidence_pending','overdue_exception_escalated','resolution_evidence_verified',
   'closure_followup_pending','closure_followup_verified')),
 next_due_at timestamptz,
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_verified_followup_linked boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 followup_note text not null check(char_length(trim(followup_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint continuity_resolution_pair check(source_campground_id<>target_campground_id),
 constraint continuity_resolution_stage check(
  (followup_kind='independent_continuity_recheck' and outcome_kind in
   ('continuity_watch_renewed','recurrence_gap_escalated','continuity_recheck_confirmed'))
  or (followup_kind='overdue_exception_resolution' and outcome_kind in
   ('resolution_evidence_pending','overdue_exception_escalated','resolution_evidence_verified'))
  or (followup_kind='verified_closure_followup' and outcome_kind in
   ('closure_followup_pending','closure_followup_verified'))),
 constraint continuity_resolution_verified_link check(
  (outcome_kind in('continuity_recheck_confirmed','resolution_evidence_verified',
   'closure_followup_verified'))=(verified_followup_event_id is not null)),
 constraint continuity_resolution_due check(
  (outcome_kind='closure_followup_verified' and next_due_at is null)
  or (outcome_kind<>'closure_followup_verified' and next_due_at is not null))
);
create unique index continuity_resolution_initial_recheck_idx
 on public.owner_export_continuity_resolution_followups(aging_review_id)
 where prior_followup_id is null;
create index continuity_resolution_pair_history_idx
 on public.owner_export_continuity_resolution_followups
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index continuity_resolution_open_due_idx
 on public.owner_export_continuity_resolution_followups(next_due_at)
 where next_due_at is not null;
create index continuity_resolution_aging_idx
 on public.owner_export_continuity_resolution_followups(aging_review_id);
create index continuity_resolution_verified_receipt_idx
 on public.owner_export_continuity_resolution_followups(verified_followup_event_id)
 where verified_followup_event_id is not null;

create function icamp_private.continuity_resolution_followup_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare aging record; reopened record; prior record; verified record; owner_record record;
 source_due timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,130130));
 select * into aging from public.owner_export_reopened_exception_aging_reviews
  where id=new.aging_review_id;
 if aging.id is null or aging.source_campground_id<>new.source_campground_id
  or aging.target_campground_id<>new.target_campground_id then
  raise exception 'A same-pair Build 131 aging review is required'; end if;
 if exists(select 1 from public.owner_export_reopened_exception_aging_reviews
  where prior_review_id=aging.id) then
  raise exception 'Build 132 must follow the latest Build 131 oversight review'; end if;
 select * into reopened from public.owner_export_closure_recurrence_events
  where id=aging.reopen_event_id and event_kind='owner_exception_reopen';
 if reopened.id is null or not reopened.observed_original_proof_verified then
  raise exception 'Reopening and independently verified original proof are required'; end if;
 new.recorded_at:=clock_timestamp();
 select count(*)::int into new.observed_open_peer_recurrences
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='independent_recurrence_check'
  and e.outcome_kind<>'continuity_stable'
  and not exists (
   with recursive followup_chain as (
    select x.id,x.event_kind,x.outcome_kind
    from public.owner_export_closure_recurrence_events x where x.prior_event_id=e.id
    union all
    select x.id,x.event_kind,x.outcome_kind
    from public.owner_export_closure_recurrence_events x
    join followup_chain c on x.prior_event_id=c.id
   ) select 1 from followup_chain where event_kind='independent_followup_verify'
    and outcome_kind='verify_followup_evidence');
 select count(*) filter(where d.decision_kind<>'acknowledge_closure_proof')::int,
        count(*) filter(where d.decision_kind='renew_escalation_exception'
         and d.recorded_at>=new.recorded_at-interval '90 days')::int
 into new.observed_open_owner_dispositions,new.observed_recent_owner_escalations
 from public.owner_export_independent_recheck_owner_decisions d
 where d.source_campground_id=new.source_campground_id
  and d.target_campground_id=new.target_campground_id;
 if new.verified_followup_event_id is not null then
  select * into verified from public.owner_export_closure_recurrence_events
   where id=new.verified_followup_event_id;
  new.observed_verified_followup_linked:=verified.event_kind='independent_followup_verify'
   and verified.outcome_kind='verify_followup_evidence'
   and verified.root_reopen_id=aging.reopen_event_id
   and verified.source_campground_id=new.source_campground_id
   and verified.target_campground_id=new.target_campground_id
   and verified.recorded_at>reopened.recorded_at
   and verified.owner_evidence_decision_id is not null;
  if not coalesce(new.observed_verified_followup_linked,false) then
   raise exception 'A later, same-reopening, verified Build 130 follow-up receipt is required'; end if;
  select * into owner_record from public.owner_export_independent_recheck_owner_decisions
   where id=verified.owner_evidence_decision_id;
  if owner_record.id is null or owner_record.recorded_at<=reopened.recorded_at
   or new.recorded_by_user_id=owner_record.recorded_by_user_id then
   raise exception 'Linked owner evidence must postdate the reopening'; end if;
 end if;
 if new.prior_followup_id is null then
  if new.followup_kind<>'independent_continuity_recheck' then
   raise exception 'Begin with an independent continuity recurrence recheck'; end if;
  source_due:=aging.next_due_at;
 else
  select * into prior from public.owner_export_continuity_resolution_followups
   where id=new.prior_followup_id;
  if prior.id is null or prior.aging_review_id<>new.aging_review_id
   or prior.source_campground_id<>new.source_campground_id
   or prior.target_campground_id<>new.target_campground_id
   or prior.outcome_kind='closure_followup_verified' then
   raise exception 'Independent follow-up must continue the same open review chain'; end if;
  if not (
   (prior.followup_kind='independent_continuity_recheck' and
     ((prior.outcome_kind='continuity_recheck_confirmed' and new.followup_kind='overdue_exception_resolution')
      or (prior.outcome_kind<>'continuity_recheck_confirmed' and new.followup_kind='independent_continuity_recheck')))
   or (prior.followup_kind='overdue_exception_resolution' and
     ((prior.outcome_kind='resolution_evidence_verified' and new.followup_kind='verified_closure_followup')
      or (prior.outcome_kind<>'resolution_evidence_verified' and new.followup_kind='overdue_exception_resolution')))
   or (prior.followup_kind='verified_closure_followup' and
      new.followup_kind='verified_closure_followup')
  ) then raise exception 'Recheck, overdue resolution and verified closure follow-up must be in order'; end if;
  if new.recorded_by_user_id=prior.recorded_by_user_id then
   raise exception 'Follow-up reviewer must differ from the previous reviewer'; end if;
  source_due:=prior.next_due_at;
 end if;
 if new.recorded_by_user_id in(aging.recorded_by_user_id,reopened.recorded_by_user_id)
  or (new.verified_followup_event_id is not null
   and new.recorded_by_user_id=verified.recorded_by_user_id) then
  raise exception 'Continuity reviewer must be independent of the source evidence chain'; end if;
 new.observed_prior_days_overdue:=case when source_due is null then 0
  else greatest(0,floor(extract(epoch from(new.recorded_at-source_due))/86400))::int end;
 if new.observed_prior_days_overdue>=30
  and new.outcome_kind in('continuity_watch_renewed','resolution_evidence_pending') then
  raise exception 'Overdue evidence requires explicit escalation or verified proof'; end if;
 if new.outcome_kind='closure_followup_verified' and
  (new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_recent_owner_escalations>0) then
  raise exception 'Verified closure cannot proceed with unresolved recurrence or owner exceptions'; end if;
 if new.outcome_kind='closure_followup_verified' then
  if new.next_due_at is not null then raise exception 'Verified closure must not have an open due date'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Open follow-up must be due within 90 days'; end if;
 end if;
 return new;
end $$;
create trigger continuity_resolution_followup_guard before insert
 on public.owner_export_continuity_resolution_followups for each row
 execute function icamp_private.continuity_resolution_followup_guard();
create trigger continuity_resolution_followup_immutable before update or delete
 on public.owner_export_continuity_resolution_followups for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_continuity_resolution_followups enable row level security;
alter table public.owner_export_continuity_resolution_followups force row level security;
revoke all on public.owner_export_continuity_resolution_followups from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_continuity_resolution_followups from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_continuity_resolution_followups to icamp_app;
create policy continuity_resolution_read on public.owner_export_continuity_resolution_followups
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy continuity_resolution_insert on public.owner_export_continuity_resolution_followups
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.continuity_resolution_followup_guard() from public;

-- Once Build 132 starts, its Build 131 source cannot gain another child.
create function icamp_private.continuity_resolution_prevent_aging_fork() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.prior_review_id is not null and exists (
  select 1 from public.owner_export_continuity_resolution_followups
  where aging_review_id=new.prior_review_id) then
  raise exception 'Build 131 oversight cannot fork after Build 132 follow-up begins'; end if;
 return new;
end $$;
create trigger zz_continuity_resolution_prevent_aging_fork before insert
 on public.owner_export_reopened_exception_aging_reviews for each row
 execute function icamp_private.continuity_resolution_prevent_aging_fork();
revoke all on function icamp_private.continuity_resolution_prevent_aging_fork() from public;
