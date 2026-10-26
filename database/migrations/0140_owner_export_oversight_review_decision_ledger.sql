-- Build 109: private append-only owner interpretation and decision ledgers.
-- Never alters Build 105–108 receipts, exception cases, closeout, retention or export evidence.
create table public.owner_export_oversight_reviews (
 id uuid primary key,
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 window_days integer not null check(window_days in (30,90,180)),
 issue_kind text not null check(issue_kind in
  ('all','reconciliation_missing','digest_mismatch','retention_missing','retention_overdue')),
 review_kind text not null check(review_kind in ('routine_context','monitor','followup_proposed')),
 snapshot_as_of timestamptz not null default clock_timestamp(),
 cases_observed integer not null default 0 check(cases_observed>=0),
 open_cases_observed integer not null default 0 check(open_cases_observed>=0),
 repeat_receipts_observed integer not null default 0 check(repeat_receipts_observed>=0),
 next_review_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint owner_oversight_review_distinct_campgrounds check(source_campground_id<>target_campground_id)
);
create index owner_oversight_review_pair_idx on public.owner_export_oversight_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index owner_oversight_review_actor_idx on public.owner_export_oversight_reviews(reviewed_by_user_id);

create table public.owner_export_oversight_decisions (
 id uuid primary key,
 review_id uuid not null references public.owner_export_oversight_reviews(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 basis_case_id uuid references public.owner_export_exception_cases(id),
 decision_kind text not null check(decision_kind in ('monitor','followup','escalate','closed_no_action')),
 next_due_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 decision_note text not null check(char_length(trim(decision_note)) between 12 and 800),
 decided_by_user_id uuid not null references icamp_private.user_accounts(id),
 decided_at timestamptz not null default clock_timestamp(),
 constraint owner_oversight_decision_distinct_campgrounds check(source_campground_id<>target_campground_id),
 constraint owner_oversight_decision_due_kind check(
  (decision_kind='closed_no_action' and next_due_at is null)
  or (decision_kind in ('monitor','followup','escalate') and next_due_at is not null))
);
create index owner_oversight_decision_review_idx on public.owner_export_oversight_decisions
 (review_id,decided_at desc,id desc);
create index owner_oversight_decision_pair_idx on public.owner_export_oversight_decisions
 (source_campground_id,target_campground_id,decided_at desc,id desc);
create index owner_oversight_decision_case_idx on public.owner_export_oversight_decisions(basis_case_id)
 where basis_case_id is not null;
create index owner_oversight_decision_actor_idx on public.owner_export_oversight_decisions(decided_by_user_id);

create function icamp_private.owner_export_oversight_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare counts record;
begin
 new.reviewed_at:=clock_timestamp();
 new.snapshot_as_of:=new.reviewed_at;
 if new.next_review_at<=new.reviewed_at
  or new.next_review_at>new.reviewed_at+interval '90 days' then
  raise exception 'Owner oversight must specify an upcoming review within 90 days'; end if;
 -- Computed only from immutable cases and independent acceptance rows. Neither
 -- web forms nor callers can assert or backdate these snapshot measurements.
 select count(*)::int as total,
  count(*) filter(where not exists (
   select 1 from public.owner_export_exception_reviews accepted
   where accepted.case_id=c.id and accepted.review_kind='accepted'))::int as open_count,
  (select count(*)::int from (
    select previous.export_acceptance_id from public.owner_export_exception_cases previous
    where previous.source_campground_id=new.source_campground_id
     and previous.target_campground_id=new.target_campground_id
     and previous.opened_at>=new.snapshot_as_of-(new.window_days*interval '1 day')
     and previous.opened_at<=new.snapshot_as_of
     and (new.issue_kind='all' or previous.issue_kind=new.issue_kind)
    group by previous.export_acceptance_id having count(*)>1
   ) recurrence) as recurring_receipts
 into counts from public.owner_export_exception_cases c
 where c.source_campground_id=new.source_campground_id
  and c.target_campground_id=new.target_campground_id
  and c.opened_at>=new.snapshot_as_of-(new.window_days*interval '1 day')
  and c.opened_at<=new.snapshot_as_of
  and (new.issue_kind='all' or c.issue_kind=new.issue_kind);
 new.cases_observed:=counts.total;
 new.open_cases_observed:=counts.open_count;
 new.repeat_receipts_observed:=counts.recurring_receipts;
 return new;
end $$;
create trigger owner_export_oversight_review_guard before insert on public.owner_export_oversight_reviews
 for each row execute function icamp_private.owner_export_oversight_review_guard();

create function icamp_private.owner_export_oversight_decision_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare parent record;
begin
 select * into parent from public.owner_export_oversight_reviews where id=new.review_id;
 if parent.id is null then raise exception 'Owner oversight review is unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(parent.id::text,109109));
 if new.source_campground_id<>parent.source_campground_id
  or new.target_campground_id<>parent.target_campground_id then
  raise exception 'Owner follow-up must match the original two-campground review'; end if;
 if exists(select 1 from public.owner_export_oversight_decisions prior
  where prior.review_id=parent.id and prior.decision_kind='closed_no_action') then
  raise exception 'Final no-action review is immutable and cannot receive more decisions'; end if;
 if new.decision_kind='closed_no_action' then
  if new.next_due_at is not null then raise exception 'A final owner decision must not carry a pending due date'; end if;
 elsif new.next_due_at is null or new.next_due_at<=clock_timestamp()
  or new.next_due_at>clock_timestamp()+interval '90 days' then
  raise exception 'Pending owner decisions require a future due date within 90 days'; end if;
 if new.decision_kind='escalate' and new.basis_case_id is null then
  raise exception 'Manual escalation must cite one underlying Build 107 exception case'; end if;
 if new.basis_case_id is not null and not exists(
  select 1 from public.owner_export_exception_cases c
  where c.id=new.basis_case_id
   and c.source_campground_id=parent.source_campground_id
   and c.target_campground_id=parent.target_campground_id
   and c.opened_at>=parent.snapshot_as_of-(parent.window_days*interval '1 day')
   and c.opened_at<=parent.snapshot_as_of
   and (parent.issue_kind='all' or c.issue_kind=parent.issue_kind)) then
  raise exception 'Cited exception case is outside the frozen owner review scope'; end if;
 new.decided_at:=clock_timestamp();
 return new;
end $$;
create trigger owner_export_oversight_decision_guard before insert on public.owner_export_oversight_decisions
 for each row execute function icamp_private.owner_export_oversight_decision_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['owner_export_oversight_reviews','owner_export_oversight_decisions'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',tab,role_name); end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
  execute format('create trigger %I before update or delete on public.%I for each row execute function icamp_private.winterization_append_only()',tab||'_immutable',tab);
  execute format('create policy %I on public.%I for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id))',tab||'_read',tab);
 end loop;
end $roles$;
create policy owner_export_oversight_review_insert on public.owner_export_oversight_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy owner_export_oversight_decision_insert on public.owner_export_oversight_decisions for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and decided_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_export_oversight_review_guard() from public;
revoke all on function icamp_private.owner_export_oversight_decision_guard() from public;
