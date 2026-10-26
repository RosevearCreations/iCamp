-- Build 123: independent closure audit reassessment aging and owner exception sign-off.
-- Append-only evidence. This cannot release holds, settle payments or change campground operations.
create table public.owner_export_closure_audit_owner_signoffs (
 id uuid primary key,
 independent_audit_id uuid not null unique references public.owner_export_handoff_independent_closure_audits(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 signoff_kind text not null check(signoff_kind in
  ('owner_exception_signed_off','request_evidence_refresh','accept_manual_escalation','acknowledge_independent_closure')),
 next_due_at timestamptz,
 observed_reassessment_days_overdue integer not null default 0 check(observed_reassessment_days_overdue>=0),
 observed_peer_open_audits integer not null default 0 check(observed_peer_open_audits>=0),
 observed_peer_overdue_audits integer not null default 0 check(observed_peer_overdue_audits>=0),
 observed_prior_manual_escalations integer not null default 0 check(observed_prior_manual_escalations>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 signoff_note text not null check(char_length(trim(signoff_note)) between 12 and 800),
 signed_by_user_id uuid not null references icamp_private.user_accounts(id),
 signed_at timestamptz not null default clock_timestamp(),
 constraint closure_audit_signoff_pair check(source_campground_id<>target_campground_id),
 constraint closure_audit_signoff_due check(
  (signoff_kind='acknowledge_independent_closure' and next_due_at is null)
  or (signoff_kind<>'acknowledge_independent_closure' and next_due_at is not null))
);
create index closure_audit_signoff_pair_idx on public.owner_export_closure_audit_owner_signoffs
 (source_campground_id,target_campground_id,signed_at desc,id desc);
create function icamp_private.closure_audit_owner_signoff_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare audit_record record; handoff_record record; review_record record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,123123));
 select * into audit_record from public.owner_export_handoff_independent_closure_audits
  where id=new.independent_audit_id;
 if audit_record.id is null or audit_record.source_campground_id<>new.source_campground_id
  or audit_record.target_campground_id<>new.target_campground_id then
  raise exception 'Owner sign-off requires a matching independent audit and ordered campground pair'; end if;
 select * into handoff_record from public.owner_export_independent_followup_owner_decisions
  where id=audit_record.handoff_decision_id;
 select * into review_record from public.owner_export_closure_followup_reviews
  where id=handoff_record.independent_review_id;
 if new.signed_by_user_id=audit_record.audited_by_user_id
  or new.signed_by_user_id=handoff_record.acted_by_user_id
  or new.signed_by_user_id=review_record.reviewed_by_user_id then
  raise exception 'Owner exception sign-off must be independent of the audit and earlier handoff reviewers'; end if;
 new.signed_at:=clock_timestamp();
 select count(*) filter(where a.audit_kind<>'independent_audit_closed')::int,
        count(*) filter(where a.next_due_at<new.signed_at)::int,
        count(*) filter(where a.audit_kind='manual_escalation'
          and a.audited_at>=new.signed_at-interval '90 days')::int
 into new.observed_peer_open_audits,new.observed_peer_overdue_audits,new.observed_prior_manual_escalations
 from public.owner_export_handoff_independent_closure_audits a
 where a.source_campground_id=new.source_campground_id and a.target_campground_id=new.target_campground_id
  and a.id<>audit_record.id;
 new.observed_reassessment_days_overdue:=case when audit_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.signed_at-audit_record.next_due_at))/86400))::int end;
 if audit_record.audit_kind='independent_audit_closed' then
  if new.signoff_kind<>'acknowledge_independent_closure' or new.next_due_at is not null then
   raise exception 'Independently closed audits permit only a final owner acknowledgment'; end if;
  if new.observed_peer_open_audits>0 or new.observed_peer_overdue_audits>0
   or new.observed_prior_manual_escalations>0 then
   raise exception 'Owner acknowledgment cannot dismiss peer exceptions or recurring escalations'; end if;
 else
  if new.signoff_kind='acknowledge_independent_closure' then
   raise exception 'Open independent audits cannot be acknowledged as closed'; end if;
  if new.next_due_at is null or new.next_due_at<=new.signed_at
   or new.next_due_at>new.signed_at+interval '90 days' then
   raise exception 'Open audit owner reassessment must be due within 90 days'; end if;
  if audit_record.audit_kind='manual_escalation' and new.signoff_kind<>'accept_manual_escalation' then
   raise exception 'Independent manual escalation must be accepted by the owner'; end if;
  if new.signoff_kind='owner_exception_signed_off'
   and audit_record.audit_kind<>'continue_exception' then
   raise exception 'Exception sign-off must follow a continued independent exception'; end if;
  if new.observed_reassessment_days_overdue>=30
   and new.signoff_kind<>'accept_manual_escalation' then
   raise exception 'Independent audits overdue 30+ days require owner escalation acceptance'; end if;
  if audit_record.next_due_at<new.signed_at and new.signoff_kind='owner_exception_signed_off' then
   raise exception 'An overdue audit cannot receive passive exception sign-off'; end if;
  if new.observed_prior_manual_escalations>=2
   and new.signoff_kind<>'accept_manual_escalation' then
   raise exception 'Recurring independent escalations require explicit owner acceptance'; end if;
 end if;
 return new;
end $$;
create trigger closure_audit_owner_signoff_guard before insert on public.owner_export_closure_audit_owner_signoffs
 for each row execute function icamp_private.closure_audit_owner_signoff_guard();
create trigger closure_audit_owner_signoff_immutable before update or delete on public.owner_export_closure_audit_owner_signoffs
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_closure_audit_owner_signoffs enable row level security;
alter table public.owner_export_closure_audit_owner_signoffs force row level security;
revoke all on public.owner_export_closure_audit_owner_signoffs from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_closure_audit_owner_signoffs from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_closure_audit_owner_signoffs to icamp_app;
create policy closure_audit_owner_signoff_read on public.owner_export_closure_audit_owner_signoffs
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy closure_audit_owner_signoff_insert on public.owner_export_closure_audit_owner_signoffs
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and signed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.closure_audit_owner_signoff_guard() from public;
