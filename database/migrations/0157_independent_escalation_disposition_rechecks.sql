-- Build 127: source-linked evidence replay and independent escalation/closure recheck.
-- An audit recheck is never an operational hold release, transfer or payment.
create table public.owner_export_independent_disposition_rechecks (
 id uuid primary key,
 independent_disposition_id uuid not null unique references public.owner_export_owner_evidence_independent_dispositions(id),
 replay_owner_outcome_id uuid not null references public.owner_export_independent_closeout_owner_outcomes(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 recheck_kind text not null check(recheck_kind in
  ('continue_followup_watch','request_owner_renewal_replay',
   'renew_escalation_recheck','confirm_closure_continuity_recheck')),
 next_due_at timestamptz,
 observed_disposition_days_overdue integer not null default 0 check(observed_disposition_days_overdue>=0),
 observed_peer_pending_dispositions integer not null default 0 check(observed_peer_pending_dispositions>=0),
 observed_peer_overdue_dispositions integer not null default 0 check(observed_peer_overdue_dispositions>=0),
 observed_recent_escalation_rechecks integer not null default 0 check(observed_recent_escalation_rechecks>=0),
 observed_recent_owner_renewals integer not null default 0 check(observed_recent_owner_renewals>=0),
 observed_replay_is_newer boolean not null default false,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 recheck_note text not null check(char_length(trim(recheck_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 rechecked_at timestamptz not null default clock_timestamp(),
 constraint independent_disposition_recheck_pair check(source_campground_id<>target_campground_id),
 constraint independent_disposition_recheck_due check(
  (recheck_kind='confirm_closure_continuity_recheck' and next_due_at is null)
  or (recheck_kind<>'confirm_closure_continuity_recheck' and next_due_at is not null))
);
create index independent_disposition_recheck_pair_idx on public.owner_export_independent_disposition_rechecks
 (source_campground_id,target_campground_id,rechecked_at desc,id desc);
create function icamp_private.independent_disposition_recheck_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare disposition_record record; source_owner record; replay_owner record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.source_campground_id::text||':'||new.target_campground_id::text,127127));
 select * into disposition_record from public.owner_export_owner_evidence_independent_dispositions
  where id=new.independent_disposition_id;
 if disposition_record.id is null or disposition_record.source_campground_id<>new.source_campground_id
  or disposition_record.target_campground_id<>new.target_campground_id then
  raise exception 'Independent recheck must match its disposition and ordered campground pair'; end if;
 select * into source_owner from public.owner_export_independent_closeout_owner_outcomes
  where id=disposition_record.owner_outcome_id;
 select * into replay_owner from public.owner_export_independent_closeout_owner_outcomes
  where id=new.replay_owner_outcome_id;
 if replay_owner.id is null or replay_owner.source_campground_id<>new.source_campground_id
  or replay_owner.target_campground_id<>new.target_campground_id then
  raise exception 'Owner evidence replay must be source-linked to the same ordered campground pair'; end if;
 if new.reviewed_by_user_id=disposition_record.reviewed_by_user_id
  or new.reviewed_by_user_id=source_owner.recorded_by_user_id
  or new.reviewed_by_user_id=replay_owner.recorded_by_user_id then
  raise exception 'An independent recheck requires a reviewer distinct from prior reviewers and evidence owners'; end if;
 new.rechecked_at:=clock_timestamp();
 new.observed_replay_is_newer:=replay_owner.id<>source_owner.id;
 if new.observed_replay_is_newer and (replay_owner.recorded_at<=source_owner.recorded_at
  or replay_owner.outcome_kind not in ('submit_refreshed_evidence','renew_escalation_exception')) then
  raise exception 'New replay evidence must be a later owner refresh or escalation renewal'; end if;
 select count(*) filter(where d.disposition_kind<>'verify_closure_continuity' and r.id is null)::int,
        count(*) filter(where d.disposition_kind<>'verify_closure_continuity'
          and d.next_due_at<new.rechecked_at and r.id is null)::int,
        count(*) filter(where r.recheck_kind='renew_escalation_recheck'
          and r.rechecked_at>=new.rechecked_at-interval '90 days')::int
 into new.observed_peer_pending_dispositions,new.observed_peer_overdue_dispositions,
      new.observed_recent_escalation_rechecks
 from public.owner_export_owner_evidence_independent_dispositions d
 left join public.owner_export_independent_disposition_rechecks r on r.independent_disposition_id=d.id
 where d.source_campground_id=new.source_campground_id and d.target_campground_id=new.target_campground_id
  and d.id<>disposition_record.id;
 select count(*)::int into new.observed_recent_owner_renewals
 from public.owner_export_independent_closeout_owner_outcomes o
 where o.source_campground_id=new.source_campground_id and o.target_campground_id=new.target_campground_id
  and o.id<>source_owner.id and o.outcome_kind='renew_escalation_exception'
  and o.recorded_at>=new.rechecked_at-interval '90 days';
 new.observed_disposition_days_overdue:=case when disposition_record.next_due_at is null then 0
  else greatest(0,floor(extract(epoch from (new.rechecked_at-disposition_record.next_due_at))/86400))::int end;
 if disposition_record.disposition_kind='verify_closure_continuity' then
  if new.recheck_kind<>'confirm_closure_continuity_recheck'
   or new.replay_owner_outcome_id<>source_owner.id
   or source_owner.outcome_kind<>'acknowledge_independent_closeout'
   or new.next_due_at is not null then
   raise exception 'Closure continuity recheck requires the same acknowledged, independently verified evidence'; end if;
  if new.observed_peer_pending_dispositions>0 or new.observed_peer_overdue_dispositions>0
   or new.observed_recent_escalation_rechecks>0 or new.observed_recent_owner_renewals>0 then
   raise exception 'Closure continuity recheck cannot ignore unresolved or renewed peer escalations'; end if;
 else
  if new.recheck_kind='confirm_closure_continuity_recheck' then
   raise exception 'An open escalation disposition cannot be rechecked as closed'; end if;
  if new.next_due_at is null or new.next_due_at<=new.rechecked_at
   or new.next_due_at>new.rechecked_at+interval '90 days' then
   raise exception 'Independent disposition recheck must follow up within 90 days'; end if;
  if (disposition_record.disposition_kind='escalate_renewal_exception'
   or new.observed_disposition_days_overdue>=30
   or new.observed_peer_overdue_dispositions>0
   or new.observed_recent_escalation_rechecks>=2
   or new.observed_recent_owner_renewals>=2
   or replay_owner.outcome_kind='renew_escalation_exception')
   and new.recheck_kind<>'renew_escalation_recheck' then
   raise exception 'Renewed or long-overdue independent escalations require an explicit escalation recheck'; end if;
  if new.recheck_kind='continue_followup_watch'
   and (disposition_record.disposition_kind<>'continue_independent_monitoring'
    or disposition_record.next_due_at<new.rechecked_at
    or new.observed_peer_pending_dispositions>0 or new.observed_replay_is_newer) then
   raise exception 'Passive recheck requires timely monitoring with unchanged evidence and no pending peers'; end if;
 end if;
 return new;
end $$;
create trigger independent_disposition_recheck_guard before insert on public.owner_export_independent_disposition_rechecks
 for each row execute function icamp_private.independent_disposition_recheck_guard();
create trigger independent_disposition_recheck_immutable before update or delete on public.owner_export_independent_disposition_rechecks
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_independent_disposition_rechecks enable row level security;
alter table public.owner_export_independent_disposition_rechecks force row level security;
revoke all on public.owner_export_independent_disposition_rechecks from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_independent_disposition_rechecks from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_independent_disposition_rechecks to icamp_app;
create policy independent_disposition_recheck_read on public.owner_export_independent_disposition_rechecks
 for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy independent_disposition_recheck_insert on public.owner_export_independent_disposition_rechecks
 for insert to icamp_app with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.independent_disposition_recheck_guard() from public;
