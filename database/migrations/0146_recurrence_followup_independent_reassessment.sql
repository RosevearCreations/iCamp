-- Build 116: independent append-only reassessment of a pending recurrence decision.
create table public.owner_export_recurrence_reassessments (
 id uuid primary key,
 recurrence_decision_id uuid not null unique references public.owner_export_hold_recurrence_decisions(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 assessment_kind text not null check(assessment_kind in ('continue_hold','request_new_evidence','manual_escalation','confirm_resolution')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 assessment_note text not null check(char_length(trim(assessment_note)) between 12 and 800),
 assessed_by_user_id uuid not null references icamp_private.user_accounts(id),
 assessed_at timestamptz not null default clock_timestamp(),
 constraint owner_recurrence_reassessment_pair check(source_campground_id<>target_campground_id)
);
create index owner_recurrence_reassessments_pair_idx on public.owner_export_recurrence_reassessments
 (source_campground_id,target_campground_id,assessed_at desc,id desc);
create function icamp_private.owner_recurrence_reassessment_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare d record; r record; latest_review uuid;
begin
 select * into d from public.owner_export_hold_recurrence_decisions where id=new.recurrence_decision_id;
 if d.id is null or d.source_campground_id<>new.source_campground_id or d.target_campground_id<>new.target_campground_id
  or d.decision_kind='independent_no_action' then
  raise exception 'Independent reassessment requires a pending decision for this directed pair'; end if;
 select * into r from public.owner_export_hold_recurrence_reviews where id=d.recurrence_review_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.acceptance_id::text,116116));
 select id into latest_review from public.owner_export_hold_recurrence_reviews
  where acceptance_id=r.acceptance_id order by reviewed_at desc,id desc limit 1;
 if latest_review<>r.id then raise exception 'Reassessment must concern the latest recurrence review'; end if;
 if new.assessed_by_user_id=d.decided_by_user_id or new.assessed_by_user_id=r.reviewed_by_user_id then
  raise exception 'Reassessment requires an independent third owner'; end if;
 if new.assessment_kind='confirm_resolution' and (r.observed_continued_holds>0 or r.observed_overdue_plans>0) then
  raise exception 'Resolution cannot be confirmed while captured holds or overdue plans remain'; end if;
 new.assessed_at:=clock_timestamp(); return new;
end $$;
create trigger owner_recurrence_reassessment_guard before insert on public.owner_export_recurrence_reassessments
 for each row execute function icamp_private.owner_recurrence_reassessment_guard();
create trigger owner_recurrence_reassessment_immutable before update or delete on public.owner_export_recurrence_reassessments
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_recurrence_reassessments enable row level security;
alter table public.owner_export_recurrence_reassessments force row level security;
revoke all on public.owner_export_recurrence_reassessments from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_recurrence_reassessments from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on public.owner_export_recurrence_reassessments to icamp_app;
create policy owner_recurrence_reassess_read on public.owner_export_recurrence_reassessments for select to icamp_app using(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_recurrence_reassess_insert on public.owner_export_recurrence_reassessments for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and assessed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_recurrence_reassessment_guard() from public;
