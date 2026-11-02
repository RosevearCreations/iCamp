-- Build 104: independent, append-only reassessment and explicit owner acceptance of Build 103 plans.
-- These are planning evidence only: no financing, hold, customer or communication mutations.
create table public.permanent_unit_finance_owner_resolution_reassessments (
 id uuid primary key,
 resolution_id uuid not null references public.permanent_unit_finance_owner_handoff_resolutions(id),
 plan_id uuid not null references public.permanent_unit_finance_owner_handoff_plans(id),
 source_organization_id uuid not null,
 source_campground_id uuid not null,
 target_organization_id uuid not null,
 target_campground_id uuid not null,
 review_kind text not null check(review_kind in ('resolution_supported','additional_evidence_needed','resolution_requires_revisit')),
 next_review_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 reviewer_note text not null check(char_length(trim(reviewer_note)) between 12 and 800),
 reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
 reviewed_at timestamptz not null default clock_timestamp()
);
create index finance_owner_resolution_reviews_source_idx on public.permanent_unit_finance_owner_resolution_reassessments(source_campground_id,reviewed_at desc);
create index finance_owner_resolution_reviews_target_idx on public.permanent_unit_finance_owner_resolution_reassessments(target_campground_id,reviewed_at desc);
create index finance_owner_resolution_reviews_resolution_idx on public.permanent_unit_finance_owner_resolution_reassessments(resolution_id,reviewed_at desc,id desc);

create table public.permanent_unit_finance_owner_resolution_acceptances (
 id uuid primary key,
 resolution_id uuid not null unique references public.permanent_unit_finance_owner_handoff_resolutions(id),
 plan_id uuid not null references public.permanent_unit_finance_owner_handoff_plans(id),
 reassessment_id uuid not null references public.permanent_unit_finance_owner_resolution_reassessments(id),
 source_organization_id uuid not null,
 source_campground_id uuid not null,
 target_organization_id uuid not null,
 target_campground_id uuid not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 acceptance_note text not null check(char_length(trim(acceptance_note)) between 12 and 800),
 accepted_by_user_id uuid not null references icamp_private.user_accounts(id),
 accepted_at timestamptz not null default clock_timestamp()
);
create index finance_owner_resolution_acceptances_source_idx on public.permanent_unit_finance_owner_resolution_acceptances(source_campground_id,accepted_at desc);
create index finance_owner_resolution_acceptances_target_idx on public.permanent_unit_finance_owner_resolution_acceptances(target_campground_id,accepted_at desc);
create index finance_owner_resolution_acceptances_review_idx on public.permanent_unit_finance_owner_resolution_acceptances(reassessment_id);

create function icamp_private.finance_owner_resolution_review_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare resolution record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.resolution_id::text,104104));
 select * into resolution from public.permanent_unit_finance_owner_handoff_resolutions where id=new.resolution_id;
 if resolution.id is null or resolution.plan_id<>new.plan_id
  or resolution.source_organization_id<>new.source_organization_id
  or resolution.source_campground_id<>new.source_campground_id
  or resolution.target_organization_id<>new.target_organization_id
  or resolution.target_campground_id<>new.target_campground_id
  or resolution.resolved_by_user_id=new.reviewed_by_user_id
  or exists(select 1 from public.permanent_unit_finance_owner_resolution_acceptances where resolution_id=new.resolution_id) then
  raise exception 'Independent reassessment requires an unaccepted resolution and a different owner reviewer';
 end if;
 if new.review_kind='resolution_supported' then
  if new.next_review_at is not null then raise exception 'Supported resolution cannot have an open reassessment deadline'; end if;
 elsif new.next_review_at is null or new.next_review_at<=clock_timestamp()
  or new.next_review_at>clock_timestamp()+interval '90 days' then
  raise exception 'Outstanding owner review needs a next review within 90 days';
 end if;
 return new;
end $$;
create trigger finance_owner_resolution_review_guard before insert on public.permanent_unit_finance_owner_resolution_reassessments
 for each row execute function icamp_private.finance_owner_resolution_review_guard();

create function icamp_private.finance_owner_resolution_acceptance_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare resolution record; latest record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.resolution_id::text,104104));
 select * into resolution from public.permanent_unit_finance_owner_handoff_resolutions where id=new.resolution_id;
 select * into latest from public.permanent_unit_finance_owner_resolution_reassessments
  where resolution_id=new.resolution_id order by reviewed_at desc,id desc limit 1;
 if resolution.id is null or latest.id is null or resolution.plan_id<>new.plan_id
  or latest.id<>new.reassessment_id or latest.review_kind<>'resolution_supported'
  or new.accepted_by_user_id=latest.reviewed_by_user_id
  or resolution.source_organization_id<>new.source_organization_id
  or resolution.source_campground_id<>new.source_campground_id
  or resolution.target_organization_id<>new.target_organization_id
  or resolution.target_campground_id<>new.target_campground_id then
  raise exception 'Acceptance must reference the latest supported independent reassessment and a separate accepting owner';
 end if;
 return new;
end $$;
create trigger finance_owner_resolution_acceptance_guard before insert on public.permanent_unit_finance_owner_resolution_acceptances
 for each row execute function icamp_private.finance_owner_resolution_acceptance_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_resolution_reassessments','permanent_unit_finance_owner_resolution_acceptances'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public',tab);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then
    execute format('revoke all on public.%I from %I',tab,role_name);
   end if;
  end loop;
  execute format('grant select,insert on public.%I to icamp_app',tab);
  execute format('create trigger %I before update or delete on public.%I for each row execute function icamp_private.winterization_append_only()',tab||'_immutable',tab);
  execute format('create policy %I on public.%I for select to icamp_app using(icamp_private.is_campground_finance_owner(source_campground_id) and icamp_private.is_campground_finance_owner(target_campground_id))',tab||'_read',tab);
 end loop;
end $roles$;
create policy finance_owner_resolution_review_insert on public.permanent_unit_finance_owner_resolution_reassessments for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and reviewed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_owner_resolution_acceptance_insert on public.permanent_unit_finance_owner_resolution_acceptances for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and accepted_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_owner_resolution_review_guard() from public;
revoke all on function icamp_private.finance_owner_resolution_acceptance_guard() from public;
