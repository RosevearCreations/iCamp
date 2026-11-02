-- Build 125: owner evidence outcome audit after independent closeout review.
-- The outcome ledger is immutable and cannot modify operational holds, transfers or payments.
create table public.owner_export_independent_closeout_owner_outcomes (
 id uuid primary key,
 closeout_review_id uuid not null unique references public.owner_export_signoff_independent_closeout_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 outcome_kind text not null check(outcome_kind in
  ('continue_owner_followup','submit_refreshed_evidence','renew_escalation_exception','acknowledge_independent_closeout')),
 next_due_at timestamptz,
 observed_review_days_overdue integer not null default 0 check(observed_review_days_overdue>=0),
 observed_peer_open_reviews integer not null default 0 check(observed_peer_open_reviews>=0),
 observed_peer_overdue_reviews integer not null default 0 check(observed_peer_overdue_reviews>=0),
 observed_prior_independent_escalations integer not null default 0 check(observed_prior_independent_escalations>=0),
 observed_prior_exception_renewals integer not null default 0 check(observed_prior_exception_renewals>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 outcome_note text not null check(char_length(trim(outcome_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint independent_closeout_owner_pair check(source_campground_id<>target_campground_id),
 constraint independent_closeout_owner_due check(
  (outcome_kind='acknowledge_independent_closeout' and next_due_at is null)
  or (outcome_kind<>'acknowledge_independent_closeout' and next_due_at is not null))
);
create index independent_closeout_owner_pair_idx on public.owner_export_independent_closeout_owner_outcomes
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create function icamp_private.independent_closeout_owner_outcome_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare review_record record; signoff_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,125125));
 select * into review_record from public.owner_export_signoff_independent_closeout_reviews
  where id=new.closeout_review_id;
 if review_record.id is null or review_record.source_campground_id<>new.source_campground_id
  or review_record.target_campground_id<>new.target_campground_id then
  raise exception 'Owner evidence outcome must match the independent closeout review and ordered campground pair'; end if;
 select * into signoff_record from public.owner_export_closure_audit_owner_signoffs
  where id=review_record.owner_signoff_id;
 if new.recorded_by_user_id=review_record.reviewed_by_user_id then
  raise exception 'Owner evidence outcome actor cannot independently review their own closeout'; end if;
 new.recorded_at:=clock_timestamp();
 select count(*) filter(where r.review_kind<>'independent_exception_closed')::int,
        count(*) filter(where r.next_due_at<new.recorded_at)::int,
        count(*) filter(where r.review_kind='manual_escalation'
          and r.reviewed_at>=new.recorded_at-interval '90 days')::int
 into new.observed_peer_open_reviews,new.observed_peer_overdue_reviews,new.observed_prior_independent_escalations
 from public.owner_export_signoff_independent_closeout_reviews r
 where r.source_campground_id=new.source_campground_id and r.target_campground_id=new.target_campground_id
  and r.id<>review_record.id;
 select count(*)::int into new.observed_prior_exception_renewals
 from public.owner_export_independent_closeout_owner_outcomes o
 where o.source_campground_id=new.source_campground_id and o.target_campground_id=new.target_campground_id
  and o.outcome_kind='renew_escalation_exception'
  and o.recorded_at>=new.recorded_at-interval '90 days';
 new.observed_review_days_overdue:=case when review_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.recorded_at-review_record.next_due_at))/86400))::int end;
 if review_record.review_kind='independent_exception_closed' then
  if new.outcome_kind<>'acknowledge_independent_closeout'
   or signoff_record.signoff_kind<>'acknowledge_independent_closure'
   or new.next_due_at is not null then
   raise exception 'A closed independent exception permits only an owner closeout acknowledgment'; end if;
  if new.observed_peer_open_reviews>0 or new.observed_peer_overdue_reviews>0
   or new.observed_prior_independent_escalations>0 or new.observed_prior_exception_renewals>0 then
   raise exception 'Owner closeout acknowledgment cannot ignore peer exceptions or renewed escalations'; end if;
 else
  if new.outcome_kind='acknowledge_independent_closeout' then
   raise exception 'Open independent reviews cannot be acknowledged as closed'; end if;
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Owner evidence outcome follow-up must be due within 90 days'; end if;
  if review_record.review_kind='manual_escalation' and new.outcome_kind<>'renew_escalation_exception' then
   raise exception 'An independent manual escalation requires explicit owner exception renewal'; end if;
  if review_record.review_kind='request_escalation_evidence_refresh'
   and new.outcome_kind='continue_owner_followup' then
   raise exception 'An independent evidence refresh request cannot be silently continued'; end if;
  if new.outcome_kind='continue_owner_followup'
   and review_record.review_kind<>'continue_exception' then
   raise exception 'Passive owner monitoring requires an independent continued exception'; end if;
  if new.observed_review_days_overdue>=30 and new.outcome_kind<>'renew_escalation_exception' then
   raise exception 'Independent closeout reviews overdue 30+ days require renewed owner escalation'; end if;
  if review_record.next_due_at<new.recorded_at and new.outcome_kind='continue_owner_followup' then
   raise exception 'Overdue independent reviews cannot be passively continued'; end if;
  if (new.observed_prior_independent_escalations>=2 or new.observed_prior_exception_renewals>=2)
   and new.outcome_kind<>'renew_escalation_exception' then
   raise exception 'Recurring escalations or renewed exceptions require explicit owner escalation renewal'; end if;
 end if;
 return new;
end $$;
create trigger independent_closeout_owner_outcome_guard before insert on public.owner_export_independent_closeout_owner_outcomes
 for each row execute function icamp_private.independent_closeout_owner_outcome_guard();
create trigger independent_closeout_owner_outcome_immutable before update or delete on public.owner_export_independent_closeout_owner_outcomes
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_independent_closeout_owner_outcomes enable row level security;
alter table public.owner_export_independent_closeout_owner_outcomes force row level security;
revoke all on public.owner_export_independent_closeout_owner_outcomes from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_independent_closeout_owner_outcomes from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_independent_closeout_owner_outcomes to icamp_app;
create policy independent_closeout_owner_outcome_read on public.owner_export_independent_closeout_owner_outcomes
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy independent_closeout_owner_outcome_insert on public.owner_export_independent_closeout_owner_outcomes
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.independent_closeout_owner_outcome_guard() from public;
