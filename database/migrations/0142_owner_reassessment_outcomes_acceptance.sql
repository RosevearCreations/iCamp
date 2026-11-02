-- Build 111: two independent, append-only attestations; no source-row mutations.
create table public.owner_export_reassessment_outcomes (
 id uuid primary key,
 reassessment_id uuid not null references public.owner_export_oversight_reassessments(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 outcome_kind text not null check(outcome_kind in ('monitoring_completed','evidence_pending','escalated','closure_evidence_ready')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 outcome_note text not null check(char_length(trim(outcome_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint owner_outcome_distinct_pair check(source_campground_id<>target_campground_id)
);
create index owner_export_reassessment_outcomes_source_idx on public.owner_export_reassessment_outcomes
 (reassessment_id,recorded_at desc,id desc);
create table public.owner_export_outcome_acceptances (
 id uuid primary key,
 outcome_id uuid not null references public.owner_export_reassessment_outcomes(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 acceptance_kind text not null check(acceptance_kind in ('accepted','held')),
 audit_note text not null check(char_length(trim(audit_note)) between 12 and 800),
 accepted_by_user_id uuid not null references icamp_private.user_accounts(id),
 accepted_at timestamptz not null default clock_timestamp(),
 constraint owner_acceptance_distinct_pair check(source_campground_id<>target_campground_id),
 constraint owner_acceptance_once unique(outcome_id)
);
create index owner_export_outcome_acceptances_pair_idx on public.owner_export_outcome_acceptances
 (source_campground_id,target_campground_id,accepted_at desc);

create function icamp_private.owner_export_outcome_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare r record; latest_reassessment uuid; latest_decision uuid;
begin
 select a.*,d.decided_by_user_id,d.review_id into r
 from public.owner_export_oversight_reassessments a
 join public.owner_export_oversight_decisions d on d.id=a.decision_id
 where a.id=new.reassessment_id;
 if r.id is null or r.source_campground_id<>new.source_campground_id
  or r.target_campground_id<>new.target_campground_id then
  raise exception 'Outcome must match an authorized source reassessment and directed pair'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.review_id::text,109109));
 select id into latest_decision from public.owner_export_oversight_decisions
  where review_id=r.review_id order by decided_at desc,id desc limit 1;
 select id into latest_reassessment from public.owner_export_oversight_reassessments
  where decision_id=r.decision_id order by reassessed_at desc,id desc limit 1;
 if latest_decision<>r.decision_id or latest_reassessment<>r.id then
  raise exception 'Outcome requires the current independent reassessment'; end if;
 if new.recorded_by_user_id=r.reassessed_by_user_id then
  raise exception 'Outcome owner must differ from independent reassessor'; end if;
 if new.outcome_kind='closure_evidence_ready' and r.assessment_kind<>'closure_recommended' then
  raise exception 'Closure evidence requires an independent closure recommendation'; end if;
 if new.outcome_kind='closure_evidence_ready' and (r.observed_unclosed_cases<>0 or r.new_cases_since_review<>0) then
  raise exception 'Unresolved or newly opened exception cases prevent closure evidence'; end if;
 new.recorded_at:=clock_timestamp(); return new;
end $$;

create function icamp_private.owner_export_outcome_acceptance_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare o record; latest_outcome uuid; latest_reassessment uuid; latest_decision uuid; open_count int; new_count int;
begin
 select x.*,a.decision_id,a.review_id,a.assessment_kind,a.reassessed_by_user_id,
  v.snapshot_as_of,v.window_days,v.issue_kind
 into o from public.owner_export_reassessment_outcomes x
 join public.owner_export_oversight_reassessments a on a.id=x.reassessment_id
 join public.owner_export_oversight_reviews v on v.id=a.review_id
 where x.id=new.outcome_id;
 if o.id is null or o.source_campground_id<>new.source_campground_id
  or o.target_campground_id<>new.target_campground_id then
  raise exception 'Independent acceptance must preserve original campground scope'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(o.review_id::text,109109));
 select id into latest_decision from public.owner_export_oversight_decisions
  where review_id=o.review_id order by decided_at desc,id desc limit 1;
 select id into latest_reassessment from public.owner_export_oversight_reassessments
  where decision_id=o.decision_id order by reassessed_at desc,id desc limit 1;
 select id into latest_outcome from public.owner_export_reassessment_outcomes
  where reassessment_id=o.reassessment_id order by recorded_at desc,id desc limit 1;
 if latest_decision<>o.decision_id or latest_reassessment<>o.reassessment_id or latest_outcome<>o.id then
  raise exception 'Independent acceptance cannot attest stale evidence'; end if;
 if new.accepted_by_user_id in (o.recorded_by_user_id,o.reassessed_by_user_id) then
  raise exception 'Independent acceptance requires a different owner from outcome and reassessment'; end if;
 if new.acceptance_kind='accepted' then
  if o.outcome_kind<>'closure_evidence_ready' or o.assessment_kind<>'closure_recommended' then
   raise exception 'Final acceptance requires independently recommended closure evidence'; end if;
  select count(*) filter(where not exists(select 1 from public.owner_export_exception_reviews e
    where e.case_id=c.id and e.review_kind='accepted'))::int,
    count(*) filter(where c.opened_at>o.snapshot_as_of)::int
   into open_count,new_count from public.owner_export_exception_cases c
   where c.source_campground_id=o.source_campground_id and c.target_campground_id=o.target_campground_id
   and c.opened_at>=o.snapshot_as_of-(o.window_days*interval '1 day')
   and c.opened_at<=clock_timestamp()
   and (o.issue_kind='all' or c.issue_kind=o.issue_kind);
  if open_count>0 or new_count>0 then
   raise exception 'New or unresolved source exceptions require fresh review before final acceptance'; end if;
 end if;
 new.accepted_at:=clock_timestamp(); return new;
end $$;
create trigger owner_export_outcome_guard before insert on public.owner_export_reassessment_outcomes
 for each row execute function icamp_private.owner_export_outcome_guard();
create trigger owner_export_acceptance_guard before insert on public.owner_export_outcome_acceptances
 for each row execute function icamp_private.owner_export_outcome_acceptance_guard();
create trigger owner_export_outcome_immutable before update or delete on public.owner_export_reassessment_outcomes
 for each row execute function icamp_private.winterization_append_only();
create trigger owner_export_acceptance_immutable before update or delete on public.owner_export_outcome_acceptances
 for each row execute function icamp_private.winterization_append_only();
do $security$ declare name text; role_name text; begin
 foreach name in array array['owner_export_reassessment_outcomes','owner_export_outcome_acceptances'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('alter table public.%I force row level security',name);
  execute format('revoke all on public.%I from public',name);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',name,role_name);
   end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',name);
  execute format('create policy owner_pair_read on public.%I for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id))',name);
 end loop;
end $security$;
create policy outcome_pair_insert on public.owner_export_reassessment_outcomes for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy acceptance_pair_insert on public.owner_export_outcome_acceptances for insert to icamp_app with check(
 icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id)
 and accepted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_export_outcome_guard() from public;
revoke all on function icamp_private.owner_export_outcome_acceptance_guard() from public;
