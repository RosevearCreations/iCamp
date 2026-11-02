-- Build 117: immutable owner reconciliation history; never mutates holds or original evidence.
create table public.owner_export_reassessment_owner_actions (
 id uuid primary key,
 reassessment_id uuid not null references public.owner_export_recurrence_reassessments(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 action_kind text not null check(action_kind in ('evidence_requested','evidence_submitted','manual_escalation','owner_reconciled')),
 next_due_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 action_note text not null check(char_length(trim(action_note)) between 12 and 800),
 acted_by_user_id uuid not null references icamp_private.user_accounts(id),
 acted_at timestamptz not null default clock_timestamp(),
 constraint owner_reassessment_action_pair check(source_campground_id<>target_campground_id),
 constraint owner_reassessment_action_due check(
  (action_kind in ('evidence_requested','manual_escalation') and next_due_at is not null)
  or (action_kind in ('evidence_submitted','owner_reconciled') and next_due_at is null))
);
create index owner_reassessment_actions_pair_idx on public.owner_export_reassessment_owner_actions
 (source_campground_id,target_campground_id,acted_at desc,id desc);
create index owner_reassessment_actions_parent_idx on public.owner_export_reassessment_owner_actions
 (reassessment_id,acted_at desc,id desc);
create function icamp_private.owner_reassessment_action_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare a record; prior_kind text;
begin
 select * into a from public.owner_export_recurrence_reassessments where id=new.reassessment_id;
 if a.id is null or a.source_campground_id<>new.source_campground_id
  or a.target_campground_id<>new.target_campground_id or a.assessment_kind='confirm_resolution' then
  raise exception 'Evidence action requires an open reassessment in the directed campground pair'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.id::text,117117));
 select action_kind into prior_kind from public.owner_export_reassessment_owner_actions
  where reassessment_id=a.id order by acted_at desc,id desc limit 1;
 if prior_kind='owner_reconciled' then raise exception 'Owner-reconciled evidence is immutable; a fresh reassessment is required'; end if;
 if new.action_kind='owner_reconciled' then
  if prior_kind is distinct from 'evidence_submitted' or new.acted_by_user_id=a.assessed_by_user_id then
   raise exception 'Owner reconciliation requires submitted evidence and a separate owner'; end if;
  if exists(select 1 from public.owner_export_hold_recurrence_reviews r
   join public.owner_export_hold_recurrence_decisions d on d.recurrence_review_id=r.id
   where d.id=a.recurrence_decision_id and (r.observed_continued_holds>0 or r.observed_overdue_plans>0)) then
   raise exception 'Evidence reconciliation cannot clear captured outstanding holds or overdue plans'; end if;
 end if;
 new.acted_at:=clock_timestamp();
 if new.action_kind in ('evidence_requested','manual_escalation') and
  (new.next_due_at<=new.acted_at or new.next_due_at>new.acted_at+interval '90 days') then
  raise exception 'Owner evidence follow-up must be due within 90 days'; end if;
 return new;
end $$;
create trigger owner_reassessment_action_guard before insert on public.owner_export_reassessment_owner_actions
 for each row execute function icamp_private.owner_reassessment_action_guard();
create trigger owner_reassessment_action_immutable before update or delete on public.owner_export_reassessment_owner_actions
 for each row execute function icamp_private.winterization_append_only();
alter table public.owner_export_reassessment_owner_actions enable row level security;
alter table public.owner_export_reassessment_owner_actions force row level security;
revoke all on public.owner_export_reassessment_owner_actions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_reassessment_owner_actions from %I',role_name); end if;
 end loop;
end $$;
grant select,insert on public.owner_export_reassessment_owner_actions to icamp_app;
create policy owner_reassessment_action_read on public.owner_export_reassessment_owner_actions for select to icamp_app using(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_reassessment_action_insert on public.owner_export_reassessment_owner_actions for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and acted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_reassessment_action_guard() from public;
