-- Build 118: immutable owner exception recurrence snapshot and separate closure recheck.
create table public.owner_export_reconciliation_exception_reviews (
 id uuid primary key,
 owner_action_id uuid not null unique references public.owner_export_reassessment_owner_actions(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 observed_open_gaps integer not null default 0 check(observed_open_gaps>=0),
 observed_overdue_gaps integer not null default 0 check(observed_overdue_gaps>=0),
 observed_recurrence_count integer not null default 0 check(observed_recurrence_count>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint owner_reconciliation_exception_pair check(source_campground_id<>target_campground_id)
);
create index owner_reconciliation_exception_pair_idx on public.owner_export_reconciliation_exception_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create table public.owner_export_reconciliation_closure_rechecks (
 id uuid primary key,
 exception_review_id uuid not null unique references public.owner_export_reconciliation_exception_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 recheck_kind text not null check(recheck_kind in ('continue_exception','request_new_evidence','manual_escalation','independent_audit_closed')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 recheck_note text not null check(char_length(trim(recheck_note)) between 12 and 800),
 rechecked_by_user_id uuid not null references icamp_private.user_accounts(id),
 rechecked_at timestamptz not null default clock_timestamp(),
 constraint owner_reconciliation_closure_pair check(source_campground_id<>target_campground_id)
);
create index owner_reconciliation_closure_pair_idx on public.owner_export_reconciliation_closure_rechecks
 (source_campground_id,target_campground_id,rechecked_at desc,id desc);

create function icamp_private.owner_reconciliation_exception_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare anchor record;
begin
 select * into anchor from public.owner_export_reassessment_owner_actions where id=new.owner_action_id;
 if anchor.id is null or anchor.action_kind<>'owner_reconciled'
  or anchor.source_campground_id<>new.source_campground_id or anchor.target_campground_id<>new.target_campground_id then
  raise exception 'Exception recurrence review requires a reconciled owner action in the directed pair'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(anchor.reassessment_id::text,118118));
 -- Freeze pair-wide gap status from the most recent action for each reassessment,
 -- including reassessments with no owner action at all.
 with latest as (
  select r.id,r.assessed_at,a.action_kind,a.next_due_at
  from public.owner_export_recurrence_reassessments r
  left join lateral (
   select x.action_kind,x.next_due_at from public.owner_export_reassessment_owner_actions x
   where x.reassessment_id=r.id order by x.acted_at desc,x.id desc limit 1
  ) a on true
  where r.source_campground_id=new.source_campground_id and r.target_campground_id=new.target_campground_id
 ) select count(*) filter(where action_kind is distinct from 'owner_reconciled')::int,
  count(*) filter(where (action_kind in ('evidence_requested','manual_escalation') and next_due_at<clock_timestamp())
   or (action_kind is null and assessed_at<clock_timestamp()-interval '30 days'))::int
 into new.observed_open_gaps,new.observed_overdue_gaps from latest;
 select count(*)::int into new.observed_recurrence_count
 from public.owner_export_reassessment_owner_actions x
 where x.source_campground_id=new.source_campground_id and x.target_campground_id=new.target_campground_id
  and x.id<>anchor.id and x.action_kind='owner_reconciled'
  and x.acted_at>=anchor.acted_at-interval '90 days' and x.acted_at<=clock_timestamp();
 new.reviewed_at:=clock_timestamp(); return new;
end $$;
create function icamp_private.owner_reconciliation_closure_recheck_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare r record; anchor record; prior_review record;
begin
 select * into r from public.owner_export_reconciliation_exception_reviews where id=new.exception_review_id;
 if r.id is null or r.source_campground_id<>new.source_campground_id or r.target_campground_id<>new.target_campground_id then
  raise exception 'Independent closure recheck requires original directed exception review'; end if;
 select * into anchor from public.owner_export_reassessment_owner_actions where id=r.owner_action_id;
 if new.rechecked_by_user_id=r.reviewed_by_user_id or new.rechecked_by_user_id=anchor.acted_by_user_id then
  raise exception 'Independent closure rechecker must differ from the owner reconciler and exception reviewer'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(anchor.reassessment_id::text,118119));
 if new.recheck_kind='independent_audit_closed' then
  if r.observed_open_gaps>0 or r.observed_overdue_gaps>0 or r.observed_recurrence_count>0 then
   raise exception 'Audit closure requires no captured open, overdue, or recurrent exception gaps'; end if;
  select h.observed_continued_holds,h.observed_overdue_plans into prior_review
   from public.owner_export_recurrence_reassessments z
   join public.owner_export_hold_recurrence_decisions d on d.id=z.recurrence_decision_id
   join public.owner_export_hold_recurrence_reviews h on h.id=d.recurrence_review_id
   where z.id=anchor.reassessment_id;
  if prior_review.observed_continued_holds>0 or prior_review.observed_overdue_plans>0 then
   raise exception 'Independent audit closure cannot override captured holds or overdue plans'; end if;
 end if;
 new.rechecked_at:=clock_timestamp(); return new;
end $$;
create trigger owner_reconciliation_exception_review_guard before insert on public.owner_export_reconciliation_exception_reviews
 for each row execute function icamp_private.owner_reconciliation_exception_review_guard();
create trigger owner_reconciliation_closure_recheck_guard before insert on public.owner_export_reconciliation_closure_rechecks
 for each row execute function icamp_private.owner_reconciliation_closure_recheck_guard();
create trigger owner_reconciliation_exception_immutable before update or delete on public.owner_export_reconciliation_exception_reviews
 for each row execute function icamp_private.winterization_append_only();
create trigger owner_reconciliation_recheck_immutable before update or delete on public.owner_export_reconciliation_closure_rechecks
 for each row execute function icamp_private.winterization_append_only();
do $security$ declare name text; role_name text; begin
 foreach name in array array['owner_export_reconciliation_exception_reviews','owner_export_reconciliation_closure_rechecks'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('alter table public.%I force row level security',name);
  execute format('revoke all on public.%I from public',name);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',name,role_name); end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',name);
  execute format('create policy owner_pair_read on public.%I for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id))',name);
 end loop;
end $security$;
create policy owner_reconciliation_exception_insert on public.owner_export_reconciliation_exception_reviews for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy owner_reconciliation_recheck_insert on public.owner_export_reconciliation_closure_rechecks for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and rechecked_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_reconciliation_exception_review_guard() from public;
revoke all on function icamp_private.owner_reconciliation_closure_recheck_guard() from public;
