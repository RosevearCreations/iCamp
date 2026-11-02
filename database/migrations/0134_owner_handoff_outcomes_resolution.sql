-- Build 103: immutable owner-to-owner coordination outcomes and planning-resolution evidence.
-- Resolution is administrative planning evidence only, never an applicant, finance or hold state change.
create table public.permanent_unit_finance_owner_handoff_outcomes (
 id uuid primary key,
 plan_id uuid not null references public.permanent_unit_finance_owner_handoff_plans(id),
 source_organization_id uuid not null,
 source_campground_id uuid not null,
 target_organization_id uuid not null,
 target_campground_id uuid not null,
 outcome_kind text not null check(outcome_kind in ('coordination_in_progress','additional_review_needed','target_review_completed','unable_to_proceed')),
 next_action_at timestamptz,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 owner_note text not null check(char_length(trim(owner_note)) between 12 and 800),
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp()
);
create index finance_owner_outcomes_plan_idx on public.permanent_unit_finance_owner_handoff_outcomes(plan_id,recorded_at desc,id desc);
create index finance_owner_outcomes_source_idx on public.permanent_unit_finance_owner_handoff_outcomes(source_campground_id,recorded_at desc);
create index finance_owner_outcomes_target_idx on public.permanent_unit_finance_owner_handoff_outcomes(target_campground_id,recorded_at desc);
create index finance_owner_outcomes_actor_idx on public.permanent_unit_finance_owner_handoff_outcomes(recorded_by_user_id);

create table public.permanent_unit_finance_owner_handoff_resolutions (
 id uuid primary key,
 plan_id uuid not null unique references public.permanent_unit_finance_owner_handoff_plans(id),
 latest_outcome_id uuid not null references public.permanent_unit_finance_owner_handoff_outcomes(id),
 source_organization_id uuid not null,
 source_campground_id uuid not null,
 target_organization_id uuid not null,
 target_campground_id uuid not null,
 resolution_kind text not null check(resolution_kind in ('owner_coordination_complete','planning_closed_unresolved','new_plan_recommended')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 owner_note text not null check(char_length(trim(owner_note)) between 12 and 800),
 resolved_by_user_id uuid not null references icamp_private.user_accounts(id),
 resolved_at timestamptz not null default clock_timestamp()
);
create index finance_owner_resolutions_outcome_idx on public.permanent_unit_finance_owner_handoff_resolutions(latest_outcome_id);
create index finance_owner_resolutions_source_idx on public.permanent_unit_finance_owner_handoff_resolutions(source_campground_id,resolved_at desc);
create index finance_owner_resolutions_target_idx on public.permanent_unit_finance_owner_handoff_resolutions(target_campground_id,resolved_at desc);
create index finance_owner_resolutions_actor_idx on public.permanent_unit_finance_owner_handoff_resolutions(resolved_by_user_id);

create function icamp_private.finance_owner_handoff_outcome_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare handoff record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,103103));
 select * into handoff from public.permanent_unit_finance_owner_handoff_plans where id=new.plan_id;
 if handoff.id is null or handoff.source_campground_id<>new.source_campground_id
  or handoff.target_campground_id<>new.target_campground_id
  or handoff.source_organization_id<>new.source_organization_id
  or handoff.target_organization_id<>new.target_organization_id
  or exists(select 1 from public.permanent_unit_finance_owner_handoff_resolutions where plan_id=new.plan_id) then
  raise exception 'Outcome must reference an authorized, unresolved handoff plan';
 end if;
 if new.outcome_kind in ('coordination_in_progress','additional_review_needed') then
  if new.next_action_at is null or new.next_action_at<=clock_timestamp()
   or new.next_action_at>clock_timestamp()+interval '90 days' then
   raise exception 'Open coordination outcomes require an upcoming review within 90 days';
  end if;
 elsif new.next_action_at is not null then
  raise exception 'Terminal coordination outcomes must not create a pending next action';
 end if;
 return new;
end $$;
create trigger finance_owner_handoff_outcome_guard before insert on public.permanent_unit_finance_owner_handoff_outcomes
 for each row execute function icamp_private.finance_owner_handoff_outcome_guard();

create function icamp_private.finance_owner_handoff_resolution_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare handoff record; latest record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.plan_id::text,103103));
 select * into handoff from public.permanent_unit_finance_owner_handoff_plans where id=new.plan_id;
 select * into latest from public.permanent_unit_finance_owner_handoff_outcomes
  where plan_id=new.plan_id order by recorded_at desc,id desc limit 1;
 if handoff.id is null or latest.id is null or new.latest_outcome_id<>latest.id
  or latest.outcome_kind not in ('target_review_completed','unable_to_proceed')
  or handoff.source_campground_id<>new.source_campground_id
  or handoff.target_campground_id<>new.target_campground_id
  or handoff.source_organization_id<>new.source_organization_id
  or handoff.target_organization_id<>new.target_organization_id then
  raise exception 'Resolution must cite latest completed or unable-to-proceed source evidence';
 end if;
 return new;
end $$;
create trigger finance_owner_handoff_resolution_guard before insert on public.permanent_unit_finance_owner_handoff_resolutions
 for each row execute function icamp_private.finance_owner_handoff_resolution_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_handoff_outcomes','permanent_unit_finance_owner_handoff_resolutions'] loop
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
create policy finance_owner_handoff_outcome_insert on public.permanent_unit_finance_owner_handoff_outcomes for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_owner_handoff_resolution_insert on public.permanent_unit_finance_owner_handoff_resolutions for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and resolved_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_owner_handoff_outcome_guard() from public;
revoke all on function icamp_private.finance_owner_handoff_resolution_guard() from public;
