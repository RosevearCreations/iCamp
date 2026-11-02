-- Build 112: private post-acceptance exception monitoring and evidence-reopen recommendations.
-- Historical acceptances remain immutable; a reopen is a recommendation, not a case mutation.
create table public.owner_export_acceptance_exception_reviews (
 id uuid primary key,
 acceptance_id uuid not null references public.owner_export_outcome_acceptances(id),
 source_campground_id uuid not null references public.campgrounds(id),
 target_campground_id uuid not null references public.campgrounds(id),
 review_kind text not null check(review_kind in ('monitor','exception_hold','reopen_recommended')),
 observed_unclosed_cases integer not null default 0 check(observed_unclosed_cases>=0),
 cases_since_acceptance integer not null default 0 check(cases_since_acceptance>=0),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 review_note text not null check(char_length(trim(review_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp(),
 constraint owner_acceptance_review_pair check(source_campground_id<>target_campground_id)
);
create index owner_acceptance_exception_review_pair_idx on public.owner_export_acceptance_exception_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
create index owner_acceptance_exception_review_acceptance_idx on public.owner_export_acceptance_exception_reviews
 (acceptance_id,reviewed_at desc,id desc);

create function icamp_private.owner_acceptance_exception_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare source_row record; current_decision uuid; current_reassessment uuid; current_outcome uuid;
begin
 select acc.*,o.reassessment_id,o.recorded_by_user_id,
  r.decision_id,r.review_id,r.reassessed_by_user_id,
  v.snapshot_as_of,v.window_days,v.issue_kind
 into source_row from public.owner_export_outcome_acceptances acc
 join public.owner_export_reassessment_outcomes o on o.id=acc.outcome_id
 join public.owner_export_oversight_reassessments r on r.id=o.reassessment_id
 join public.owner_export_oversight_reviews v on v.id=r.review_id
 where acc.id=new.acceptance_id;
 if source_row.id is null or source_row.source_campground_id<>new.source_campground_id
  or source_row.target_campground_id<>new.target_campground_id then
  raise exception 'Post-acceptance review must preserve the authorized directed pair'; end if;
 if source_row.acceptance_kind<>'accepted' then
  raise exception 'Only previously accepted closure evidence can enter post-acceptance monitoring'; end if;
 if new.reviewed_by_user_id in (source_row.accepted_by_user_id,source_row.recorded_by_user_id,source_row.reassessed_by_user_id) then
  raise exception 'Independent reviewer must differ from prior audit actors'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(source_row.review_id::text,109109));
 select id into current_decision from public.owner_export_oversight_decisions
  where review_id=source_row.review_id order by decided_at desc,id desc limit 1;
 select id into current_reassessment from public.owner_export_oversight_reassessments
  where decision_id=source_row.decision_id order by reassessed_at desc,id desc limit 1;
 select id into current_outcome from public.owner_export_reassessment_outcomes
  where reassessment_id=source_row.reassessment_id order by recorded_at desc,id desc limit 1;
 if current_decision<>source_row.decision_id or current_reassessment<>source_row.reassessment_id
  or current_outcome<>source_row.outcome_id then
  raise exception 'Evidence chain changed; use a fresh independent assessment'; end if;
 select count(*) filter(where not exists(select 1 from public.owner_export_exception_reviews e
   where e.case_id=c.id and e.review_kind='accepted'))::int,
  count(*) filter(where c.opened_at>source_row.accepted_at)::int
 into new.observed_unclosed_cases,new.cases_since_acceptance
 from public.owner_export_exception_cases c
 where c.source_campground_id=new.source_campground_id
  and c.target_campground_id=new.target_campground_id
  and c.opened_at>=source_row.snapshot_as_of-(source_row.window_days*interval '1 day')
  and c.opened_at<=clock_timestamp()
  and (source_row.issue_kind='all' or c.issue_kind=source_row.issue_kind);
 if new.review_kind='reopen_recommended' and
  new.observed_unclosed_cases=0 and new.cases_since_acceptance=0 then
  raise exception 'Reopen recommendation requires new or unresolved source evidence'; end if;
 if new.review_kind='monitor' and
  (new.observed_unclosed_cases>0 or new.cases_since_acceptance>0) then
  raise exception 'Source exceptions require an exception hold or reopen recommendation'; end if;
 new.reviewed_at:=clock_timestamp(); return new;
end $$;
create trigger owner_acceptance_exception_review_guard before insert
 on public.owner_export_acceptance_exception_reviews for each row
 execute function icamp_private.owner_acceptance_exception_review_guard();
create trigger owner_acceptance_exception_review_immutable before update or delete
 on public.owner_export_acceptance_exception_reviews for each row
 execute function icamp_private.winterization_append_only();
alter table public.owner_export_acceptance_exception_reviews enable row level security;
alter table public.owner_export_acceptance_exception_reviews force row level security;
revoke all on public.owner_export_acceptance_exception_reviews from public;
do $roles$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on public.owner_export_acceptance_exception_reviews from %I',role_name);
  end if;
 end loop;
end $roles$;
grant select,insert on public.owner_export_acceptance_exception_reviews to icamp_app;
create policy owner_acceptance_exception_read on public.owner_export_acceptance_exception_reviews
 for select to icamp_app using(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy owner_acceptance_exception_insert on public.owner_export_acceptance_exception_reviews
 for insert to icamp_app with check(
  icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.owner_acceptance_exception_review_guard() from public;
