-- Build 119: owner decision follow-up for an independently checked closure exception.
-- Audit records cannot change existing hold, case, financing, or customer records.
create table public.owner_export_closure_owner_decisions (
 id uuid primary key,
 closure_recheck_id uuid not null unique references public.owner_export_reconciliation_closure_rechecks(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 decision_kind text not null check(decision_kind in ('keep_exception_open','request_evidence','manual_escalation','acknowledge_audit_closure')),
 next_due_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 decision_note text not null check(char_length(trim(decision_note)) between 12 and 800),
 decided_by_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default clock_timestamp(),
 constraint owner_closure_decision_pair check(source_campground_id<>target_campground_id),
 constraint owner_closure_decision_due check(
  (decision_kind='acknowledge_audit_closure' and next_due_at is null)
  or (decision_kind<>'acknowledge_audit_closure' and next_due_at is not null))
);
create index owner_closure_decisions_pair_idx on public.owner_export_closure_owner_decisions
 (source_campground_id,target_campground_id,decided_at desc,id desc);
create function icamp_private.owner_closure_followup_decision_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare recheck record; exception_review record;
begin
 select * into recheck from public.owner_export_reconciliation_closure_rechecks where id=new.closure_recheck_id;
 if recheck.id is null or recheck.source_campground_id<>new.source_campground_id
  or recheck.target_campground_id<>new.target_campground_id then
  raise exception 'Owner decision requires a matching independent closure recheck and directed campground pair'; end if;
 select * into exception_review from public.owner_export_reconciliation_exception_reviews where id=recheck.exception_review_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(recheck.id::text,119119));
 if new.decided_by_user_id=recheck.rechecked_by_user_id then
  raise exception 'Owner decision-maker must differ from the independent closure rechecker'; end if;
 new.decided_at:=clock_timestamp();
 if recheck.recheck_kind='independent_audit_closed' then
  if new.decision_kind<>'acknowledge_audit_closure' or new.next_due_at is not null then
   raise exception 'An independently closed audit only accepts owner acknowledgment'; end if;
  if exception_review.observed_open_gaps>0 or exception_review.observed_overdue_gaps>0
   or exception_review.observed_recurrence_count>0 then
   raise exception 'Cannot acknowledge audit closure with captured outstanding exceptions'; end if;
 else
  if new.decision_kind='acknowledge_audit_closure' then
   raise exception 'Open exception follow-ups cannot acknowledge audit closure'; end if;
  if new.next_due_at is null or new.next_due_at<=new.decided_at
   or new.next_due_at>new.decided_at+interval '90 days' then
   raise exception 'Owner follow-up must be due within 90 days'; end if;
 end if;
 return new;
end $$;
create trigger owner_closure_followup_decision_guard before insert on public.owner_export_closure_owner_decisions
 for each row execute function icamp_private.owner_closure_followup_decision_guard();
create trigger owner_closure_followup_decision_immutable before update or delete on public.owner_export_closure_owner_decisions
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_closure_owner_decisions enable row level security;
alter table public.owner_export_closure_owner_decisions force row level security;
revoke all on public.owner_export_closure_owner_decisions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_closure_owner_decisions from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_closure_owner_decisions to icamp_app;
create policy owner_closure_decision_read on public.owner_export_closure_owner_decisions for select to icamp_app using(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_closure_decision_insert on public.owner_export_closure_owner_decisions for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and decided_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_closure_followup_decision_guard() from public;
