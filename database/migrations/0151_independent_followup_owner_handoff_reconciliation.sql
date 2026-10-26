-- Build 121: record owner evidence decisions and escalation handoffs after
-- independent follow-up. This is audit-only; it never releases an operational hold.
create table public.owner_export_independent_followup_owner_decisions (
 id uuid primary key,
 independent_review_id uuid not null unique references public.owner_export_closure_followup_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 action_kind text not null check(action_kind in ('escalation_handoff_accepted','evidence_requested','evidence_reconciled','monitoring_continues','audit_confirmation_acknowledged')),
 next_due_at timestamptz,
 observed_review_days_overdue integer not null default 0 check(observed_review_days_overdue>=0),
 observed_peer_overdue_reviews integer not null default 0 check(observed_peer_overdue_reviews>=0),
 observed_prior_escalation_handoffs integer not null default 0 check(observed_prior_escalation_handoffs>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 action_note text not null check(char_length(trim(action_note)) between 12 and 800),
 acted_by_user_id uuid not null references icamp_private.user_accounts(id),
 acted_at timestamptz not null default clock_timestamp(),
 constraint independent_followup_owner_pair check(source_campground_id<>target_campground_id),
 constraint independent_followup_owner_due check(
  (action_kind in ('evidence_reconciled','audit_confirmation_acknowledged') and next_due_at is null)
  or (action_kind not in ('evidence_reconciled','audit_confirmation_acknowledged') and next_due_at is not null))
);
create index independent_followup_owner_pair_idx on public.owner_export_independent_followup_owner_decisions
 (source_campground_id,target_campground_id,acted_at desc,id desc);
create function icamp_private.independent_followup_owner_handoff_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare review_record record;
begin
 select * into review_record from public.owner_export_closure_followup_reviews where id=new.independent_review_id;
 if review_record.id is null or review_record.source_campground_id<>new.source_campground_id
  or review_record.target_campground_id<>new.target_campground_id then
  raise exception 'Owner handoff requires a matching independent follow-up and directed campground pair'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(review_record.id::text,121121));
 if new.acted_by_user_id=review_record.reviewed_by_user_id then
  raise exception 'Owner reconciliation must be performed by a different person from the independent reviewer'; end if;
 new.acted_at:=clock_timestamp();
 -- Pair-wide aging and handoff snapshots are derived, never owner-supplied.
 select count(*)::int into new.observed_peer_overdue_reviews
 from public.owner_export_closure_followup_reviews r
 left join public.owner_export_independent_followup_owner_decisions d on d.independent_review_id=r.id
 where r.source_campground_id=new.source_campground_id and r.target_campground_id=new.target_campground_id
  and r.id<>review_record.id and r.next_due_at<new.acted_at and d.id is null;
 select count(*)::int into new.observed_prior_escalation_handoffs
 from public.owner_export_independent_followup_owner_decisions d
 where d.source_campground_id=new.source_campground_id and d.target_campground_id=new.target_campground_id
  and d.action_kind='escalation_handoff_accepted' and d.acted_at>=new.acted_at-interval '90 days';
 new.observed_review_days_overdue:=case when review_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.acted_at-review_record.next_due_at))/86400))::int end;
 if review_record.review_kind='confirm_audit_acknowledged' then
  if new.action_kind<>'audit_confirmation_acknowledged' then
   raise exception 'An independently confirmed audit only accepts an owner audit acknowledgment'; end if;
 elsif new.action_kind='audit_confirmation_acknowledged' then
  raise exception 'An open independent follow-up cannot acknowledge an audit as complete';
 elsif review_record.review_kind='manual_escalation' and new.action_kind<>'escalation_handoff_accepted' then
  raise exception 'Independent manual escalation requires an explicit owner handoff';
 elsif review_record.review_kind='continue_exception' and new.action_kind='evidence_reconciled' then
  raise exception 'Evidence reconciliation requires an independent evidence request';
 elsif review_record.review_kind='request_new_evidence' and new.action_kind='monitoring_continues' then
  raise exception 'Independent evidence requests require owner evidence action or escalation';
 end if;
 if new.observed_review_days_overdue>=30 and new.action_kind<>'escalation_handoff_accepted' then
  raise exception 'Independent follow-ups overdue 30+ days require owner escalation handoff'; end if;
 if new.action_kind in ('evidence_reconciled','audit_confirmation_acknowledged') then
  if new.next_due_at is not null then
   raise exception 'Completed owner evidence decisions cannot schedule an open due date'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.acted_at
   or new.next_due_at>new.acted_at+interval '90 days' then
   raise exception 'Owner handoff follow-up must be due within 90 days'; end if;
  if review_record.next_due_at<new.acted_at and new.action_kind='monitoring_continues' then
   raise exception 'An overdue independent follow-up cannot passively continue monitoring'; end if;
 end if;
 return new;
end $$;
create trigger independent_followup_owner_handoff_guard before insert on public.owner_export_independent_followup_owner_decisions
 for each row execute function icamp_private.independent_followup_owner_handoff_guard();
create trigger independent_followup_owner_handoff_immutable before update or delete on public.owner_export_independent_followup_owner_decisions
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_independent_followup_owner_decisions enable row level security;
alter table public.owner_export_independent_followup_owner_decisions force row level security;
revoke all on public.owner_export_independent_followup_owner_decisions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_independent_followup_owner_decisions from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_independent_followup_owner_decisions to icamp_app;
create policy independent_followup_owner_read on public.owner_export_independent_followup_owner_decisions for select to icamp_app using(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id));
create policy independent_followup_owner_insert on public.owner_export_independent_followup_owner_decisions for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and acted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.independent_followup_owner_handoff_guard() from public;
