-- Build 102: append-only, owner-only operational trend notes and cross-property handoff plans.
-- These records cannot deliver offers, clear exceptions, transfer cases, or make credit decisions.
create or replace function icamp_private.is_campground_finance_owner(target_campground_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select icamp_private.has_campground_permission(target_campground_id,'permanent_unit.transfer')
 and exists (
   select 1 from icamp_private.campground_assignments a
   join icamp_private.campground_assignment_roles ar on ar.assignment_id=a.id
   join icamp_private.roles r on r.id=ar.role_id
   where a.user_id=icamp_private.request_user_id()
    and a.campground_id=target_campground_id
    and a.assignment_state='active' and a.starts_at<=statement_timestamp()
    and (a.ends_at is null or a.ends_at>statement_timestamp())
    and r.role_code='owner_admin' and r.lifecycle_state='active'
 );
$$;
revoke all on function icamp_private.is_campground_finance_owner(uuid) from public;
grant execute on function icamp_private.is_campground_finance_owner(uuid) to icamp_app;

create table public.permanent_unit_finance_owner_trend_annotations (
 id uuid primary key,
 organization_id uuid not null,
 campground_id uuid not null,
 week_start date not null check(extract(isodow from week_start)=1),
 metric text not null check(metric in ('consents','holds','clears','created_tasks','closed_tasks')),
 disposition text not null check(disposition in ('routine_context','monitor_next_cycle','propose_followup')),
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 note text not null check(char_length(trim(note)) between 12 and 800),
 next_review_at timestamptz not null,
 recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(organization_id,campground_id,id),
 foreign key(organization_id,campground_id) references public.campgrounds(organization_id,id)
);
create index finance_owner_trend_camp_week_idx on public.permanent_unit_finance_owner_trend_annotations(campground_id,week_start desc,recorded_at desc);
create index finance_owner_trend_actor_idx on public.permanent_unit_finance_owner_trend_annotations(recorded_by_user_id);

create table public.permanent_unit_finance_owner_handoff_plans (
 id uuid primary key,
 source_organization_id uuid not null,
 source_campground_id uuid not null,
 target_organization_id uuid not null,
 target_campground_id uuid not null,
 source_annotation_id uuid not null,
 planning_scope text not null check(planning_scope in ('followup_coordination','exception_review_planning','trend_pattern_review')),
 due_at timestamptz not null,
 evidence_reference text not null check(char_length(trim(evidence_reference)) between 8 and 400),
 owner_note text not null check(char_length(trim(owner_note)) between 12 and 800),
 planned_by_user_id uuid not null references icamp_private.user_accounts(id),
 planned_at timestamptz not null default clock_timestamp(),
 check(source_campground_id<>target_campground_id),
 foreign key(source_organization_id,source_campground_id) references public.campgrounds(organization_id,id),
 foreign key(target_organization_id,target_campground_id) references public.campgrounds(organization_id,id),
 foreign key(source_organization_id,source_campground_id,source_annotation_id)
  references public.permanent_unit_finance_owner_trend_annotations(organization_id,campground_id,id)
);
create index finance_owner_handoff_source_idx on public.permanent_unit_finance_owner_handoff_plans(source_campground_id,planned_at desc);
create index finance_owner_handoff_target_idx on public.permanent_unit_finance_owner_handoff_plans(target_campground_id,planned_at desc);
create index finance_owner_handoff_annotation_idx on public.permanent_unit_finance_owner_handoff_plans(source_annotation_id);
create index finance_owner_handoff_actor_idx on public.permanent_unit_finance_owner_handoff_plans(planned_by_user_id);

create function icamp_private.finance_owner_trend_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare utc_monday date;
begin
 utc_monday:=date_trunc('week',clock_timestamp() at time zone 'UTC')::date;
 if new.week_start<utc_monday-77 or new.week_start>utc_monday
  or new.next_review_at<=clock_timestamp()
  or new.next_review_at>clock_timestamp()+interval '90 days' then
  raise exception 'Trend review requires a retained UTC week and a future review within 90 days';
 end if;
 return new;
end $$;
create trigger finance_owner_trend_guard before insert on public.permanent_unit_finance_owner_trend_annotations
 for each row execute function icamp_private.finance_owner_trend_guard();

create function icamp_private.finance_owner_handoff_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.due_at<=clock_timestamp() or new.due_at>clock_timestamp()+interval '90 days' then
  raise exception 'Owner handoff planning date must be within the next 90 days';
 end if;
 return new;
end $$;
create trigger finance_owner_handoff_guard before insert on public.permanent_unit_finance_owner_handoff_plans
 for each row execute function icamp_private.finance_owner_handoff_guard();

do $roles$ declare tab text; role_name text; begin
 foreach tab in array array['permanent_unit_finance_owner_trend_annotations','permanent_unit_finance_owner_handoff_plans'] loop
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
 end loop;
end $roles$;
create policy finance_owner_trend_read on public.permanent_unit_finance_owner_trend_annotations for select to icamp_app
 using(icamp_private.is_campground_finance_owner(campground_id));
create policy finance_owner_trend_insert on public.permanent_unit_finance_owner_trend_annotations for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(campground_id)
  and recorded_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
create policy finance_owner_handoff_read on public.permanent_unit_finance_owner_handoff_plans for select to icamp_app
 using(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id));
create policy finance_owner_handoff_insert on public.permanent_unit_finance_owner_handoff_plans for insert to icamp_app
 with check(icamp_private.is_campground_finance_owner(source_campground_id)
  and icamp_private.is_campground_finance_owner(target_campground_id)
  and planned_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid);
revoke all on function icamp_private.finance_owner_trend_guard() from public;
revoke all on function icamp_private.finance_owner_handoff_guard() from public;
