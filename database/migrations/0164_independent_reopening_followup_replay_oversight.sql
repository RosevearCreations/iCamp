-- Build 134: independent reopening follow-up, source decision replay and
-- owner escalation oversight. Audit receipts do not alter operational cases.
create table public.owner_export_reopening_followup_oversights (
 id uuid primary key,
 verified_monitor_id uuid not null references public.owner_export_verified_closure_monitors(id),
 prior_oversight_id uuid unique references public.owner_export_reopening_followup_oversights(id),
 verified_resolution_event_id uuid references public.owner_export_closure_recurrence_events(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 oversight_kind text not null check(oversight_kind in
  ('independent_reopening_followup','closure_recurrence_decision_replay',
   'owner_escalation_oversight')),
 outcome_kind text not null check(outcome_kind in
  ('reopening_evidence_current','reopening_evidence_gap','reopening_followup_escalated',
   'replay_continuity_confirmed','replay_source_drift','replay_owner_recheck_required',
   'owner_escalation_pending','owner_escalation_renewed','owner_escalation_resolved')),
 next_due_at timestamptz,
 observed_reopen_age_days integer not null default 0 check(observed_reopen_age_days>=0),
 observed_prior_days_overdue integer not null default 0 check(observed_prior_days_overdue>=0),
 observed_open_peer_recurrences integer not null default 0 check(observed_open_peer_recurrences>=0),
 observed_open_owner_dispositions integer not null default 0 check(observed_open_owner_dispositions>=0),
 observed_recent_owner_escalations integer not null default 0 check(observed_recent_owner_escalations>=0),
 observed_verified_resolution_linked boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 oversight_note text not null check(char_length(trim(oversight_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint reopening_followup_pair check(source_campground_id<>target_campground_id),
 constraint reopening_followup_kind_outcome check(
  (oversight_kind='independent_reopening_followup' and outcome_kind in
   ('reopening_evidence_current','reopening_evidence_gap','reopening_followup_escalated'))
  or (oversight_kind='closure_recurrence_decision_replay' and outcome_kind in
   ('replay_continuity_confirmed','replay_source_drift','replay_owner_recheck_required'))
  or (oversight_kind='owner_escalation_oversight' and outcome_kind in
   ('owner_escalation_pending','owner_escalation_renewed','owner_escalation_resolved'))),
 constraint reopening_followup_verified_link check(
  (outcome_kind in('replay_continuity_confirmed','owner_escalation_resolved'))
   = (verified_resolution_event_id is not null)),
 constraint reopening_followup_due check(
  (outcome_kind='owner_escalation_resolved' and next_due_at is null)
  or (outcome_kind<>'owner_escalation_resolved' and next_due_at is not null))
);
create unique index reopening_followup_first_idx
 on public.owner_export_reopening_followup_oversights(verified_monitor_id)
 where prior_oversight_id is null;
create index reopening_followup_pair_history_idx
 on public.owner_export_reopening_followup_oversights
 (source_campground_id,target_campground_id,recorded_at desc,id desc);
create index reopening_followup_due_idx
 on public.owner_export_reopening_followup_oversights(next_due_at)
 where next_due_at is not null;
create index reopening_followup_root_idx
 on public.owner_export_reopening_followup_oversights(verified_monitor_id);

create function icamp_private.reopening_followup_oversight_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare monitor_record record; reopening_record record; prior_record record;
 resolution_record record; source_due timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,130130));
 select * into monitor_record from public.owner_export_verified_closure_monitors
  where id=new.verified_monitor_id;
 if monitor_record.id is null or monitor_record.monitor_kind<>'overdue_exception_reopening_audit'
  or monitor_record.outcome_kind<>'verified_reopening_linked'
  or not monitor_record.observed_linked_reopening_verified
  or monitor_record.source_campground_id<>new.source_campground_id
  or monitor_record.target_campground_id<>new.target_campground_id then
  raise exception 'Build 134 requires an independently verified same-pair Build 133 reopening'; end if;
 select * into reopening_record from public.owner_export_closure_recurrence_events
  where id=monitor_record.linked_reopen_event_id;
 if reopening_record.id is null or reopening_record.event_kind<>'owner_exception_reopen'
  or reopening_record.source_campground_id<>new.source_campground_id
  or reopening_record.target_campground_id<>new.target_campground_id
  or not reopening_record.observed_original_proof_verified
  or reopening_record.recorded_at>monitor_record.recorded_at then
  raise exception 'Reopening evidence must remain source linked and older than independent oversight'; end if;
 new.recorded_at:=clock_timestamp();
 new.observed_reopen_age_days:=greatest(0,floor(extract(epoch from
  (new.recorded_at-reopening_record.recorded_at))/86400))::int;
 select count(*)::int into new.observed_open_peer_recurrences
 from public.owner_export_closure_recurrence_events e
 where e.source_campground_id=new.source_campground_id
  and e.target_campground_id=new.target_campground_id
  and e.event_kind='independent_recurrence_check'
  and e.outcome_kind<>'continuity_stable'
  and not exists (
   with recursive followup_chain as (
    select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
     where x.prior_event_id=e.id
    union all
    select x.id,x.event_kind,x.outcome_kind from public.owner_export_closure_recurrence_events x
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
 if new.prior_oversight_id is null then
  if new.oversight_kind<>'independent_reopening_followup' then
   raise exception 'Start with independent reopening evidence follow-up'; end if;
  source_due:=monitor_record.next_due_at;
 else
  select * into prior_record from public.owner_export_reopening_followup_oversights
   where id=new.prior_oversight_id;
  if prior_record.id is null or prior_record.verified_monitor_id<>new.verified_monitor_id
   or prior_record.source_campground_id<>new.source_campground_id
   or prior_record.target_campground_id<>new.target_campground_id
   or prior_record.outcome_kind='owner_escalation_resolved' then
   raise exception 'Follow-up must continue the same open independently reviewed reopening'; end if;
  if not (
   (prior_record.oversight_kind='independent_reopening_followup'
     and new.oversight_kind='closure_recurrence_decision_replay')
   or (prior_record.oversight_kind='closure_recurrence_decision_replay' and
     ((prior_record.outcome_kind='replay_continuity_confirmed'
       and new.oversight_kind='independent_reopening_followup')
      or (prior_record.outcome_kind<>'replay_continuity_confirmed'
       and new.oversight_kind='owner_escalation_oversight')))
   or (prior_record.oversight_kind='owner_escalation_oversight' and
      new.oversight_kind='owner_escalation_oversight')
  ) then raise exception 'Reopening follow-up, replay and owner escalation must remain ordered'; end if;
  if new.recorded_by_user_id=prior_record.recorded_by_user_id then
   raise exception 'Independent reviewer must differ from the preceding reviewer'; end if;
  source_due:=prior_record.next_due_at;
 end if;
 if new.recorded_by_user_id in(monitor_record.recorded_by_user_id,
    reopening_record.recorded_by_user_id) then
  raise exception 'Independent reviewer cannot audit their own owner reopening or verification'; end if;
 new.observed_prior_days_overdue:=case when source_due is null then 0
  else greatest(0,floor(extract(epoch from(new.recorded_at-source_due))/86400))::int end;
 if new.observed_prior_days_overdue>=30 and new.outcome_kind in
   ('reopening_evidence_current','replay_continuity_confirmed','owner_escalation_pending') then
  raise exception 'Thirty-day overdue independent evidence requires explicit escalation'; end if;
 if new.outcome_kind in('reopening_evidence_current','replay_continuity_confirmed') and
  (new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0
   or new.observed_recent_owner_escalations>0) then
  raise exception 'Stable recurrence replay cannot ignore unresolved peer or owner exceptions'; end if;
 if new.verified_resolution_event_id is not null then
  select * into resolution_record from public.owner_export_closure_recurrence_events
   where id=new.verified_resolution_event_id;
  new.observed_verified_resolution_linked:=resolution_record.id is not null
   and resolution_record.event_kind='independent_followup_verify'
   and resolution_record.outcome_kind='verify_followup_evidence'
   and resolution_record.root_reopen_id=reopening_record.id
   and resolution_record.source_campground_id=new.source_campground_id
   and resolution_record.target_campground_id=new.target_campground_id
   and resolution_record.recorded_at>reopening_record.recorded_at
   and resolution_record.observed_original_proof_verified;
  if not coalesce(new.observed_verified_resolution_linked,false) then
   raise exception 'Decision replay requires verified same-root reopening follow-up proof'; end if;
  if new.recorded_by_user_id=resolution_record.recorded_by_user_id then
   raise exception 'Independent replayer cannot verify their own source resolution'; end if;
 end if;
 if new.outcome_kind='owner_escalation_resolved' then
  if new.prior_oversight_id is null or prior_record.oversight_kind<>'owner_escalation_oversight'
   or new.next_due_at is not null or not new.observed_verified_resolution_linked
   or new.observed_open_peer_recurrences>0 or new.observed_open_owner_dispositions>0 then
   raise exception 'Escalation closure requires independent prior oversight and verified, exception-free source proof'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=new.recorded_at
   or new.next_due_at>new.recorded_at+interval '90 days' then
   raise exception 'Open reopening follow-up must be due within 90 days'; end if;
 end if;
 return new;
end $$;
create trigger reopening_followup_oversight_guard before insert
 on public.owner_export_reopening_followup_oversights for each row
 execute function icamp_private.reopening_followup_oversight_guard();
create trigger reopening_followup_oversight_immutable before update or delete
 on public.owner_export_reopening_followup_oversights for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_reopening_followup_oversights enable row level security;
alter table public.owner_export_reopening_followup_oversights force row level security;
revoke all on public.owner_export_reopening_followup_oversights from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_reopening_followup_oversights from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_reopening_followup_oversights to icamp_app;
create policy reopening_followup_oversight_read on public.owner_export_reopening_followup_oversights
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy reopening_followup_oversight_insert on public.owner_export_reopening_followup_oversights
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.reopening_followup_oversight_guard() from public;

-- Rosevear Integration Contract v1: only server-authenticated, read-only
-- handshake receipts. No customer data, cross-app database link, or commands.
create table icamp_private.integration_handshake_receipts (
 id uuid primary key,
 issuer text not null check(issuer='ai-data-platform'),
 target_system text not null check(target_system='icamp'),
 key_id text not null check(char_length(key_id) between 3 and 80),
 nonce uuid not null,
 campground_id uuid not null references public.campgrounds(id),
 request_path text not null check(request_path in
  ('/api/integration/v1/health','/api/integration/v1/capabilities')),
 request_timestamp timestamptz not null,
 outcome text not null check(outcome in('accepted','rejected')),
 reason_code text not null check(reason_code in('readiness_accepted','tenant_hold')),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(issuer,key_id,nonce)
);
create index integration_handshake_receipts_tenant_idx
 on icamp_private.integration_handshake_receipts(campground_id,recorded_at desc);
create trigger integration_handshake_receipts_immutable before update or delete
 on icamp_private.integration_handshake_receipts for each row
 execute function icamp_private.winterization_append_only();
alter table icamp_private.integration_handshake_receipts enable row level security;
alter table icamp_private.integration_handshake_receipts force row level security;
revoke all on icamp_private.integration_handshake_receipts from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on icamp_private.integration_handshake_receipts from %I',role_name); end if;
 end loop;
end $$;
grant insert on icamp_private.integration_handshake_receipts to icamp_app;
create policy integration_handshake_receipts_insert
 on icamp_private.integration_handshake_receipts for insert to icamp_app
 with check(issuer='ai-data-platform' and target_system='icamp');
