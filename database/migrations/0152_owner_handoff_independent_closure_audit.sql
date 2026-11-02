-- Build 122: independently reassess owner handoff evidence and record audit closure.
-- Closure is evidence-ledger only; operational holds, payments and cases do not change.
create table public.owner_export_handoff_independent_closure_audits (
 id uuid primary key,
 handoff_decision_id uuid not null unique references public.owner_export_independent_followup_owner_decisions(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 audit_kind text not null check(audit_kind in ('continue_exception','request_evidence_reassessment','manual_escalation','independent_audit_closed')),
 next_due_at timestamptz,
 observed_handoff_days_overdue integer not null default 0 check(observed_handoff_days_overdue>=0),
 observed_other_open_handoffs integer not null default 0 check(observed_other_open_handoffs>=0),
 observed_other_overdue_handoffs integer not null default 0 check(observed_other_overdue_handoffs>=0),
 observed_other_escalation_handoffs integer not null default 0 check(observed_other_escalation_handoffs>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 audit_note text not null check(char_length(trim(audit_note)) between 12 and 800),
 audited_by_user_id uuid not null references icamp_private.user_accounts(id),
 audited_at timestamptz not null default clock_timestamp(),
 constraint handoff_independent_audit_pair check(source_campground_id<>target_campground_id),
 constraint handoff_independent_audit_due check(
  (audit_kind='independent_audit_closed' and next_due_at is null)
  or (audit_kind<>'independent_audit_closed' and next_due_at is not null))
);
create index handoff_independent_audit_pair_idx on public.owner_export_handoff_independent_closure_audits
 (source_campground_id,target_campground_id,audited_at desc,id desc);
create function icamp_private.handoff_independent_closure_audit_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare handoff_record record; review_record record;
begin
 select * into handoff_record from public.owner_export_independent_followup_owner_decisions where id=new.handoff_decision_id;
 if handoff_record.id is null or handoff_record.source_campground_id<>new.source_campground_id
  or handoff_record.target_campground_id<>new.target_campground_id then
  raise exception 'Independent closure audit requires a matching owner handoff and ordered campground pair'; end if;
 select * into review_record from public.owner_export_closure_followup_reviews where id=handoff_record.independent_review_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(handoff_record.id::text,122122));
 if new.audited_by_user_id=handoff_record.acted_by_user_id or new.audited_by_user_id=review_record.reviewed_by_user_id then
  raise exception 'Independent auditor must differ from the owner handoff actor and prior independent reviewer'; end if;
 new.audited_at:=clock_timestamp();
 -- Freeze open peer records and overdue/escalation peers at the point of audit.
 -- A prior independent audit closure is the only audit-ledger closure exclusion.
 select count(*) filter(where d.action_kind not in ('evidence_reconciled','audit_confirmation_acknowledged'))::int,
        count(*) filter(where d.next_due_at<new.audited_at)::int,
        count(*) filter(where d.action_kind='escalation_handoff_accepted'
          and d.acted_at>=new.audited_at-interval '90 days')::int
 into new.observed_other_open_handoffs,new.observed_other_overdue_handoffs,new.observed_other_escalation_handoffs
 from public.owner_export_independent_followup_owner_decisions d
 left join public.owner_export_handoff_independent_closure_audits a on a.handoff_decision_id=d.id
 where d.source_campground_id=new.source_campground_id and d.target_campground_id=new.target_campground_id
  and d.id<>handoff_record.id and (a.id is null or a.audit_kind<>'independent_audit_closed');
 new.observed_handoff_days_overdue:=case when handoff_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.audited_at-handoff_record.next_due_at))/86400))::int end;
 if new.audit_kind='independent_audit_closed' then
  if handoff_record.action_kind not in ('evidence_reconciled','audit_confirmation_acknowledged','escalation_handoff_accepted') then
   raise exception 'Independent audit closure requires reconciled evidence, acknowledged audit, or a reviewed escalation handoff'; end if;
  if new.observed_other_open_handoffs>0 or new.observed_other_overdue_handoffs>0
   or new.observed_other_escalation_handoffs>0 then
   raise exception 'Independent audit closure cannot ignore captured outstanding pair-wide handoffs'; end if;
  if new.next_due_at is not null then raise exception 'Closed audit cannot schedule a pending review'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.audited_at
   or new.next_due_at>new.audited_at+interval '90 days' then
   raise exception 'Independent evidence reassessment must be due within 90 days'; end if;
  if new.observed_handoff_days_overdue>=30 and new.audit_kind<>'manual_escalation' then
   raise exception 'Owner handoffs overdue 30+ days require independent escalation'; end if;
  if handoff_record.next_due_at<new.audited_at and new.audit_kind='continue_exception' then
   raise exception 'Overdue handoffs require reassessment or escalation, not passive continuation'; end if;
 end if;
 return new;
end $$;
create trigger handoff_independent_closure_audit_guard before insert on public.owner_export_handoff_independent_closure_audits
 for each row execute function icamp_private.handoff_independent_closure_audit_guard();
create trigger handoff_independent_closure_audit_immutable before update or delete on public.owner_export_handoff_independent_closure_audits
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_handoff_independent_closure_audits enable row level security;
alter table public.owner_export_handoff_independent_closure_audits force row level security;
revoke all on public.owner_export_handoff_independent_closure_audits from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_handoff_independent_closure_audits from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_handoff_independent_closure_audits to icamp_app;
create policy handoff_independent_audit_read on public.owner_export_handoff_independent_closure_audits for select to icamp_app using(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id));
create policy handoff_independent_audit_insert on public.owner_export_handoff_independent_closure_audits for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and audited_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.handoff_independent_closure_audit_guard() from public;
