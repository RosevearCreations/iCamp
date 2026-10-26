-- Build 107: independent, append-only owner export retention exception follow-up and audit closeout.
-- These ledgers never modify the Build 105 acceptance or Build 106 reconciliation / retention evidence.
create table public.owner_export_exception_cases (
 id uuid primary key,
 export_acceptance_id uuid not null references public.permanent_unit_finance_owner_evidence_export_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 issue_kind text not null check(issue_kind in ('reconciliation_missing','digest_mismatch','retention_missing','retention_overdue')),
 basis_reconciliation_id uuid references public.permanent_unit_finance_owner_export_reconciliations(id),
 basis_retention_event_id uuid references public.permanent_unit_finance_owner_export_retention_events(id),
 action_due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 issue_note text not null check(char_length(trim(issue_note)) between 12 and 800),
 opened_by_user_id uuid not null references icamp_private.user_accounts(id),
 opened_at timestamptz not null default clock_timestamp()
);
create index owner_export_exception_case_receipt_idx on public.owner_export_exception_cases
 (export_acceptance_id,opened_at desc,id desc);

create table public.owner_export_exception_outcomes (
 id uuid primary key,
 case_id uuid not null references public.owner_export_exception_cases(id),
 export_acceptance_id uuid not null references public.permanent_unit_finance_owner_evidence_export_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 action_kind text not null check(action_kind in ('followup_needed','escalated','review_ready')),
 next_due_at timestamptz,
 resolution_reconciliation_id uuid references public.permanent_unit_finance_owner_export_reconciliations(id),
 resolution_retention_event_id uuid references public.permanent_unit_finance_owner_export_retention_events(id),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 action_note text not null check(char_length(trim(action_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint owner_export_outcome_due_kind check(
  (action_kind='review_ready' and next_due_at is null)
  or (action_kind in ('followup_needed','escalated') and next_due_at is not null))
);
create index owner_export_exception_outcome_case_idx on public.owner_export_exception_outcomes
 (case_id,recorded_at desc,id desc);

create table public.owner_export_exception_reviews (
 id uuid primary key,
 case_id uuid not null references public.owner_export_exception_cases(id),
 outcome_id uuid not null unique references public.owner_export_exception_outcomes(id),
 export_acceptance_id uuid not null references public.permanent_unit_finance_owner_evidence_export_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in ('accepted','needs_followup')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp()
);
create index owner_export_exception_review_case_idx on public.owner_export_exception_reviews
 (case_id,reviewed_at desc,id desc);
create unique index owner_export_exception_one_acceptance_idx on public.owner_export_exception_reviews(case_id)
 where review_kind='accepted';

create function icamp_private.owner_export_exception_case_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare receipt record; reconciliation record; retention record; detected text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.export_acceptance_id::text,106106));
 select * into receipt from public.permanent_unit_finance_owner_evidence_export_acceptances where id=new.export_acceptance_id;
 if receipt.id is null or receipt.source_campground_id<>new.source_campground_id
  or receipt.target_campground_id<>new.target_campground_id then
  raise exception 'Export receipt does not belong to this independently authorized campground pair'; end if;
 select * into reconciliation from public.permanent_unit_finance_owner_export_reconciliations
  where export_acceptance_id=new.export_acceptance_id order by reconciled_at desc,id desc limit 1;
 select * into retention from public.permanent_unit_finance_owner_export_retention_events
  where export_acceptance_id=new.export_acceptance_id order by recorded_at desc,id desc limit 1;
 if reconciliation.id is null then detected:='reconciliation_missing';
 elsif reconciliation.result<>'matched' then detected:='digest_mismatch';
 elsif retention.id is null then detected:='retention_missing';
 elsif retention.event_kind<>'copy_disposed' and retention.retention_due_at<=clock_timestamp() then detected:='retention_overdue';
 else detected:=null; end if;
 if detected is null or new.issue_kind<>detected then
  raise exception 'Exception type must match a currently observed export audit condition'; end if;
 if exists(select 1 from public.owner_export_exception_cases prior
  where prior.export_acceptance_id=new.export_acceptance_id
  and not exists(select 1 from public.owner_export_exception_reviews review
   where review.case_id=prior.id and review.review_kind='accepted')) then
  raise exception 'One unresolved owner export exception already exists for this receipt'; end if;
 if new.action_due_at<=clock_timestamp() or new.action_due_at>clock_timestamp()+interval '90 days' then
  raise exception 'Next owner action must be within 90 days'; end if;
 new.basis_reconciliation_id:=reconciliation.id;
 new.basis_retention_event_id:=retention.id;
 return new;
end $$;
create trigger owner_export_exception_case_guard before insert on public.owner_export_exception_cases
 for each row execute function icamp_private.owner_export_exception_case_guard();

create function icamp_private.owner_export_exception_outcome_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare parent record; previous record; reconciliation record; retention record;
begin
 select * into parent from public.owner_export_exception_cases where id=new.case_id;
 if parent.id is null then raise exception 'Owner export exception case is unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(parent.export_acceptance_id::text,106106));
 if parent.export_acceptance_id<>new.export_acceptance_id
  or parent.source_campground_id<>new.source_campground_id or parent.target_campground_id<>new.target_campground_id
  or exists(select 1 from public.owner_export_exception_reviews where case_id=parent.id and review_kind='accepted') then
  raise exception 'Owner follow-up cannot alter a different or accepted exception case'; end if;
 select * into previous from public.owner_export_exception_outcomes where case_id=parent.id
  order by recorded_at desc,id desc limit 1;
 if previous.action_kind='review_ready' and not exists(
  select 1 from public.owner_export_exception_reviews where outcome_id=previous.id and review_kind='needs_followup') then
  raise exception 'A pending independent review must be completed before recording another outcome'; end if;
 select * into reconciliation from public.permanent_unit_finance_owner_export_reconciliations
  where export_acceptance_id=parent.export_acceptance_id order by reconciled_at desc,id desc limit 1;
 select * into retention from public.permanent_unit_finance_owner_export_retention_events
  where export_acceptance_id=parent.export_acceptance_id order by recorded_at desc,id desc limit 1;
 if new.action_kind='review_ready' then
  if new.next_due_at is not null then raise exception 'Review-ready outcomes cannot have an outstanding action due date'; end if;
  if (parent.issue_kind in ('reconciliation_missing','digest_mismatch') and
       (reconciliation.id is null or reconciliation.result<>'matched'))
   or (parent.issue_kind in ('retention_missing','retention_overdue') and
       (retention.id is null or (retention.event_kind<>'copy_disposed' and retention.retention_due_at<=clock_timestamp()))) then
   raise exception 'The original exception must be corrected in immutable source evidence before requesting closeout review'; end if;
 else
  if new.next_due_at is null or new.next_due_at<=clock_timestamp()
   or new.next_due_at>clock_timestamp()+interval '90 days' then
   raise exception 'Pending or escalated follow-up requires another owner action within 90 days'; end if;
 end if;
 new.resolution_reconciliation_id:=reconciliation.id;
 new.resolution_retention_event_id:=retention.id;
 return new;
end $$;
create trigger owner_export_exception_outcome_guard before insert on public.owner_export_exception_outcomes
 for each row execute function icamp_private.owner_export_exception_outcome_guard();

create function icamp_private.owner_export_exception_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare parent record; outcome record; latest record; reconciliation record; retention record;
begin
 select * into parent from public.owner_export_exception_cases where id=new.case_id;
 if parent.id is null then raise exception 'Owner exception case is unavailable'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(parent.export_acceptance_id::text,106106));
 select * into outcome from public.owner_export_exception_outcomes where id=new.outcome_id;
 select * into latest from public.owner_export_exception_outcomes where case_id=parent.id
  order by recorded_at desc,id desc limit 1;
 if outcome.id is null or outcome.case_id<>parent.id or outcome.id<>latest.id
  or outcome.action_kind<>'review_ready' or parent.export_acceptance_id<>new.export_acceptance_id
  or parent.source_campground_id<>new.source_campground_id or parent.target_campground_id<>new.target_campground_id
  or new.reviewed_by_user_id=outcome.recorded_by_user_id
  or new.reviewed_by_user_id=parent.opened_by_user_id
  or exists(select 1 from public.owner_export_exception_reviews where case_id=parent.id and review_kind='accepted') then
  raise exception 'Independent audit review requires the latest review-ready outcome and a separate owner'; end if;
 if new.review_kind='accepted' then
  select * into reconciliation from public.permanent_unit_finance_owner_export_reconciliations
   where export_acceptance_id=parent.export_acceptance_id order by reconciled_at desc,id desc limit 1;
  select * into retention from public.permanent_unit_finance_owner_export_retention_events
   where export_acceptance_id=parent.export_acceptance_id order by recorded_at desc,id desc limit 1;
  if (parent.issue_kind in ('reconciliation_missing','digest_mismatch') and
       (reconciliation.id is null or reconciliation.result<>'matched'))
   or (parent.issue_kind in ('retention_missing','retention_overdue') and
       (retention.id is null or (retention.event_kind<>'copy_disposed' and retention.retention_due_at<=clock_timestamp())))
   or outcome.resolution_reconciliation_id is distinct from reconciliation.id
   or outcome.resolution_retention_event_id is distinct from retention.id then
   raise exception 'Current corrective evidence no longer supports the cited independent closeout'; end if;
 end if;
 return new;
end $$;
create trigger owner_export_exception_review_guard before insert on public.owner_export_exception_reviews
 for each row execute function icamp_private.owner_export_exception_review_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['owner_export_exception_cases','owner_export_exception_outcomes','owner_export_exception_reviews'] loop
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
create policy owner_export_exception_case_insert on public.owner_export_exception_cases for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and opened_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy owner_export_exception_outcome_insert on public.owner_export_exception_outcomes for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy owner_export_exception_review_insert on public.owner_export_exception_reviews for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_export_exception_case_guard() from public;
revoke all on function icamp_private.owner_export_exception_outcome_guard() from public;
revoke all on function icamp_private.owner_export_exception_review_guard() from public;
