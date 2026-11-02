-- Build 126: independent escalation disposition and audit-closure continuity.
-- This append-only evidence ledger never releases a hold or changes a payment.
create table public.owner_export_owner_evidence_independent_dispositions (
 id uuid primary key,
 owner_outcome_id uuid not null unique references public.owner_export_independent_closeout_owner_outcomes(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 disposition_kind text not null check(disposition_kind in
  ('continue_independent_monitoring','request_owner_evidence_renewal',
   'escalate_renewal_exception','verify_closure_continuity')),
 next_due_at timestamptz,
 observed_owner_days_overdue integer not null default 0 check(observed_owner_days_overdue>=0),
 observed_peer_pending_outcomes integer not null default 0 check(observed_peer_pending_outcomes>=0),
 observed_peer_overdue_outcomes integer not null default 0 check(observed_peer_overdue_outcomes>=0),
 observed_recent_owner_renewals integer not null default 0 check(observed_recent_owner_renewals>=0),
 observed_recent_independent_escalations integer not null default 0 check(observed_recent_independent_escalations>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 disposition_note text not null check(char_length(trim(disposition_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 dispositioned_at timestamptz not null default clock_timestamp(),
 constraint owner_evidence_independent_pair check(source_campground_id<>target_campground_id),
 constraint owner_evidence_independent_due check(
  (disposition_kind='verify_closure_continuity' and next_due_at is null)
  or (disposition_kind<>'verify_closure_continuity' and next_due_at is not null))
);
create index owner_evidence_independent_pair_idx on public.owner_export_owner_evidence_independent_dispositions
 (source_campground_id,target_campground_id,dispositioned_at desc,id desc);
create function icamp_private.owner_evidence_independent_disposition_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare outcome_record record; closeout_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,126126));
 select * into outcome_record from public.owner_export_independent_closeout_owner_outcomes
  where id=new.owner_outcome_id;
 if outcome_record.id is null or outcome_record.source_campground_id<>new.source_campground_id
  or outcome_record.target_campground_id<>new.target_campground_id then
  raise exception 'Independent disposition must match the owner evidence outcome and ordered campground pair'; end if;
 if new.reviewed_by_user_id=outcome_record.recorded_by_user_id then
  raise exception 'An owner cannot independently disposition their own evidence outcome'; end if;
 select * into closeout_record from public.owner_export_signoff_independent_closeout_reviews
  where id=outcome_record.closeout_review_id;
 new.dispositioned_at:=clock_timestamp();
 select count(*) filter(where o.outcome_kind<>'acknowledge_independent_closeout' and d.id is null)::int,
        count(*) filter(where o.outcome_kind<>'acknowledge_independent_closeout'
          and o.next_due_at<new.dispositioned_at and d.id is null)::int,
        count(*) filter(where o.outcome_kind='renew_escalation_exception'
          and o.recorded_at>=new.dispositioned_at-interval '90 days')::int,
        count(*) filter(where d.disposition_kind='escalate_renewal_exception'
          and d.dispositioned_at>=new.dispositioned_at-interval '90 days')::int
 into new.observed_peer_pending_outcomes,new.observed_peer_overdue_outcomes,
      new.observed_recent_owner_renewals,new.observed_recent_independent_escalations
 from public.owner_export_independent_closeout_owner_outcomes o
 left join public.owner_export_owner_evidence_independent_dispositions d on d.owner_outcome_id=o.id
 where o.source_campground_id=new.source_campground_id and o.target_campground_id=new.target_campground_id
  and o.id<>outcome_record.id;
 new.observed_owner_days_overdue:=case when outcome_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.dispositioned_at-outcome_record.next_due_at))/86400))::int end;
 if outcome_record.outcome_kind='acknowledge_independent_closeout' then
  if new.disposition_kind<>'verify_closure_continuity'
   or closeout_record.review_kind<>'independent_exception_closed'
   or new.next_due_at is not null then
   raise exception 'Closure continuity requires a verified independent closeout and no new due date'; end if;
  if new.observed_peer_pending_outcomes>0 or new.observed_peer_overdue_outcomes>0
   or new.observed_recent_owner_renewals>0 or new.observed_recent_independent_escalations>0 then
   raise exception 'Closure continuity cannot ignore open peer evidence or recent escalation renewals'; end if;
 else
  if new.disposition_kind='verify_closure_continuity' then
   raise exception 'An open owner outcome cannot be independently closed'; end if;
  if new.next_due_at is null or new.next_due_at<=new.dispositioned_at
   or new.next_due_at>new.dispositioned_at+interval '90 days' then
   raise exception 'Independent renewal disposition follow-up must be due within 90 days'; end if;
  if (outcome_record.outcome_kind='renew_escalation_exception'
    or new.observed_owner_days_overdue>=30
    or new.observed_peer_overdue_outcomes>0
    or new.observed_recent_owner_renewals>=2
    or new.observed_recent_independent_escalations>=2)
   and new.disposition_kind<>'escalate_renewal_exception' then
   raise exception 'Renewed, repeated or long-overdue evidence requires explicit independent escalation'; end if;
  if new.disposition_kind='continue_independent_monitoring'
   and (outcome_record.outcome_kind<>'continue_owner_followup'
    or outcome_record.next_due_at<new.dispositioned_at
    or new.observed_peer_pending_outcomes>0) then
   raise exception 'Passive monitoring requires a timely, independently clear owner follow-up'; end if;
 end if;
 return new;
end $$;
create trigger owner_evidence_independent_disposition_guard before insert on public.owner_export_owner_evidence_independent_dispositions
 for each row execute function icamp_private.owner_evidence_independent_disposition_guard();
create trigger owner_evidence_independent_disposition_immutable before update or delete on public.owner_export_owner_evidence_independent_dispositions
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_owner_evidence_independent_dispositions enable row level security;
alter table public.owner_export_owner_evidence_independent_dispositions force row level security;
revoke all on public.owner_export_owner_evidence_independent_dispositions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_owner_evidence_independent_dispositions from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_owner_evidence_independent_dispositions to icamp_app;
create policy owner_evidence_independent_disposition_read on public.owner_export_owner_evidence_independent_dispositions
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_evidence_independent_disposition_insert on public.owner_export_owner_evidence_independent_dispositions
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_evidence_independent_disposition_guard() from public;
