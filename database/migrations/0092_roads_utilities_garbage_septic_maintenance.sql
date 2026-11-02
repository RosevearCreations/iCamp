-- iCamp Build 072
-- Roads, Utilities, Garbage & Septic Maintenance.
--
-- Reuses the canonical Build 029 asset model, Build 065 work-order engine,
-- Build 067 recurring scheduler and Build 068 inspection engine. This build
-- adds only infrastructure-specific program bindings and append-only upkeep evidence.

create table public.infrastructure_maintenance_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  asset_id uuid not null,
  profile_kind text not null
    check (profile_kind in ('road','parking','utility','garbage_area','septic_area')),
  inspection_template_id uuid not null,
  maintenance_schedule_id uuid not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  updated_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint infrastructure_maintenance_programs_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint infrastructure_maintenance_programs_asset_unique unique (asset_id),
  constraint infrastructure_maintenance_programs_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_programs_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_programs_template_fk
    foreign key (organization_id, campground_id, inspection_template_id)
    references public.inspection_templates(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_programs_schedule_fk
    foreign key (organization_id, campground_id, maintenance_schedule_id)
    references public.maintenance_schedules(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.infrastructure_maintenance_inspection_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  program_id uuid not null,
  asset_id uuid not null,
  inspection_occurrence_id uuid not null,
  maintenance_schedule_occurrence_id uuid,
  work_order_id uuid,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint infrastructure_maintenance_inspection_evidence_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint infrastructure_maintenance_inspection_occurrence_unique
    unique (inspection_occurrence_id),
  constraint infrastructure_maintenance_inspection_program_fk
    foreign key (organization_id, campground_id, program_id)
    references public.infrastructure_maintenance_programs(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_inspection_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_inspection_occurrence_fk
    foreign key (organization_id, campground_id, inspection_occurrence_id)
    references public.inspection_occurrences(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_inspection_schedule_occurrence_fk
    foreign key (maintenance_schedule_occurrence_id)
    references public.maintenance_schedule_occurrences(id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_inspection_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_inspection_schedule_shape_check
    check (
      (maintenance_schedule_occurrence_id is null and work_order_id is null)
      or
      (maintenance_schedule_occurrence_id is not null and work_order_id is not null)
    )
);

create table public.infrastructure_maintenance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  program_id uuid not null,
  asset_id uuid not null,
  maintenance_schedule_occurrence_id uuid,
  work_order_id uuid,
  surface_state text not null
    check (surface_state in ('ready','attention','unsafe','not_applicable')),
  safety_state text not null
    check (safety_state in ('clear','monitor','restrict_use','close_area')),
  service_state text not null
    check (service_state in ('operational','attention','out_of_service','not_applicable')),
  notes text check (notes is null or char_length(notes) <= 2000),
  recorded_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint infrastructure_maintenance_snapshots_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint infrastructure_maintenance_snapshots_program_fk
    foreign key (organization_id, campground_id, program_id)
    references public.infrastructure_maintenance_programs(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_snapshots_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_snapshots_schedule_occurrence_fk
    foreign key (maintenance_schedule_occurrence_id)
    references public.maintenance_schedule_occurrences(id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_snapshots_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_snapshots_schedule_shape_check
    check (
      (maintenance_schedule_occurrence_id is null and work_order_id is null)
      or
      (maintenance_schedule_occurrence_id is not null and work_order_id is not null)
    )
);

create table public.infrastructure_maintenance_issue_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  program_id uuid not null,
  asset_id uuid not null,
  work_order_id uuid not null,
  issue_kind text not null
    check (
      issue_kind in ('road_surface','parking_surface','drainage','electrical','water_supply','sewer_septic','garbage_recycling','lighting','signage','safety','other')
    ),
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint infrastructure_maintenance_issue_links_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint infrastructure_maintenance_issue_links_work_order_unique unique (work_order_id),
  constraint infrastructure_maintenance_issue_links_program_fk
    foreign key (organization_id, campground_id, program_id)
    references public.infrastructure_maintenance_programs(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_issue_links_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint infrastructure_maintenance_issue_links_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index infrastructure_maintenance_programs_scope_asset_idx
  on public.infrastructure_maintenance_programs(organization_id,campground_id,asset_id);
create index infrastructure_maintenance_programs_scope_template_idx
  on public.infrastructure_maintenance_programs(organization_id,campground_id,inspection_template_id);
create index infrastructure_maintenance_programs_scope_schedule_idx
  on public.infrastructure_maintenance_programs(organization_id,campground_id,maintenance_schedule_id);
create index infrastructure_maintenance_programs_created_by_idx
  on public.infrastructure_maintenance_programs(created_by_user_id);
create index infrastructure_maintenance_programs_updated_by_idx
  on public.infrastructure_maintenance_programs(updated_by_user_id);

create index infrastructure_maintenance_inspection_program_idx
  on public.infrastructure_maintenance_inspection_evidence(organization_id,campground_id,program_id);
create index infrastructure_maintenance_inspection_asset_idx
  on public.infrastructure_maintenance_inspection_evidence(organization_id,campground_id,asset_id);
create index infrastructure_maintenance_inspection_occurrence_idx
  on public.infrastructure_maintenance_inspection_evidence(organization_id,campground_id,inspection_occurrence_id);
create index infrastructure_maintenance_inspection_schedule_occurrence_idx
  on public.infrastructure_maintenance_inspection_evidence(maintenance_schedule_occurrence_id)
  where maintenance_schedule_occurrence_id is not null;
create index infrastructure_maintenance_inspection_work_order_idx
  on public.infrastructure_maintenance_inspection_evidence(organization_id,campground_id,work_order_id)
  where work_order_id is not null;
create index infrastructure_maintenance_inspection_actor_idx
  on public.infrastructure_maintenance_inspection_evidence(created_by_user_id);

create index infrastructure_maintenance_snapshots_program_idx
  on public.infrastructure_maintenance_snapshots(organization_id,campground_id,program_id,recorded_at desc);
create index infrastructure_maintenance_snapshots_asset_idx
  on public.infrastructure_maintenance_snapshots(organization_id,campground_id,asset_id,recorded_at desc);
create index infrastructure_maintenance_snapshots_schedule_occurrence_idx
  on public.infrastructure_maintenance_snapshots(maintenance_schedule_occurrence_id)
  where maintenance_schedule_occurrence_id is not null;
create index infrastructure_maintenance_snapshots_work_order_idx
  on public.infrastructure_maintenance_snapshots(organization_id,campground_id,work_order_id)
  where work_order_id is not null;
create index infrastructure_maintenance_snapshots_actor_idx
  on public.infrastructure_maintenance_snapshots(recorded_by_user_id);

create index infrastructure_maintenance_issue_links_program_idx
  on public.infrastructure_maintenance_issue_links(organization_id,campground_id,program_id,created_at desc);
create index infrastructure_maintenance_issue_links_asset_idx
  on public.infrastructure_maintenance_issue_links(organization_id,campground_id,asset_id,created_at desc);
create index infrastructure_maintenance_issue_links_work_order_idx
  on public.infrastructure_maintenance_issue_links(organization_id,campground_id,work_order_id);
create index infrastructure_maintenance_issue_links_actor_idx
  on public.infrastructure_maintenance_issue_links(created_by_user_id);

create trigger infrastructure_maintenance_programs_touch
before update on public.infrastructure_maintenance_programs
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_infrastructure_maintenance_program()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  facility_type_value text;
  asset_lifecycle text;
  template_asset_id uuid;
  template_active boolean;
  template_version_id uuid;
  template_published_at timestamptz;
  schedule_asset_id uuid;
  schedule_active boolean;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if tg_op='UPDATE'
     and (
       old.organization_id is distinct from new.organization_id
       or old.campground_id is distinct from new.campground_id
       or old.asset_id is distinct from new.asset_id
       or old.created_by_user_id is distinct from new.created_by_user_id
       or old.created_at is distinct from new.created_at
     ) then
    raise exception 'Infrastructure maintenance program identity is immutable';
  end if;

  select f.facility_type,a.lifecycle_state
    into facility_type_value,asset_lifecycle
  from public.operational_assets a
  join public.operational_facilities f
    on f.asset_id=a.id
   and f.organization_id=a.organization_id
   and f.campground_id=a.campground_id
  where a.id=new.asset_id
    and a.organization_id=new.organization_id
    and a.campground_id=new.campground_id;

  if facility_type_value is null
     or facility_type_value not in ('road','parking','utility','garbage_area','septic_area')
     or asset_lifecycle='archived' then
    raise exception 'Infrastructure maintenance requires an active road, parking, utility, garbage/recycling or septic facility asset';
  end if;

  if new.profile_kind <> facility_type_value then
    raise exception 'Infrastructure maintenance profile must exactly match the canonical facility type';
  end if;

  select t.asset_id,t.is_active,t.current_version_id,v.published_at
    into template_asset_id,template_active,template_version_id,template_published_at
  from public.inspection_templates t
  join public.inspection_template_versions v
    on v.id=t.current_version_id
   and v.organization_id=t.organization_id
   and v.campground_id=t.campground_id
  where t.id=new.inspection_template_id
    and t.organization_id=new.organization_id
    and t.campground_id=new.campground_id
    and t.target_kind='asset';

  if template_asset_id is distinct from new.asset_id
     or template_version_id is null
     or template_published_at is null then
    raise exception 'Infrastructure maintenance requires a published inspection template for the same facility';
  end if;

  select s.asset_id,s.is_active
    into schedule_asset_id,schedule_active
  from public.maintenance_schedules s
  where s.id=new.maintenance_schedule_id
    and s.organization_id=new.organization_id
    and s.campground_id=new.campground_id;

  if schedule_asset_id is distinct from new.asset_id then
    raise exception 'Infrastructure maintenance recurring schedule must target the same facility';
  end if;

  if new.is_active and (not template_active or not schedule_active) then
    raise exception 'Active infrastructure maintenance requires active inspection template and recurring schedule';
  end if;

  if tg_op='INSERT'
     and new.created_by_user_id is distinct from actor_id then
    raise exception 'Infrastructure maintenance creator must match the request actor';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'Infrastructure maintenance updater must match the request actor';
  end if;

  return new;
end;
$$;

create trigger infrastructure_maintenance_programs_validate
before insert or update on public.infrastructure_maintenance_programs
for each row execute function icamp_private.validate_infrastructure_maintenance_program();

create or replace function icamp_private.validate_infrastructure_maintenance_inspection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_asset_id uuid;
  program_template_id uuid;
  program_schedule_id uuid;
  inspection_asset_id uuid;
  inspection_template_id uuid;
  inspection_inspector_id uuid;
  schedule_id_value uuid;
  schedule_state text;
  schedule_work_order_id uuid;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  select p.asset_id,p.inspection_template_id,p.maintenance_schedule_id
    into program_asset_id,program_template_id,program_schedule_id
  from public.infrastructure_maintenance_programs p
  where p.id=new.program_id
    and p.organization_id=new.organization_id
    and p.campground_id=new.campground_id;

  select o.asset_id,o.template_id,o.inspector_user_id
    into inspection_asset_id,inspection_template_id,inspection_inspector_id
  from public.inspection_occurrences o
  where o.id=new.inspection_occurrence_id
    and o.organization_id=new.organization_id
    and o.campground_id=new.campground_id;

  if program_asset_id is distinct from new.asset_id
     or inspection_asset_id is distinct from new.asset_id
     or inspection_template_id is distinct from program_template_id then
    raise exception 'Infrastructure maintenance inspection evidence must use the program facility and template';
  end if;

  if inspection_inspector_id is distinct from actor_id
     or new.created_by_user_id is distinct from actor_id then
    raise exception 'Infrastructure maintenance inspection must be started by its assigned inspector';
  end if;

  if new.maintenance_schedule_occurrence_id is not null then
    select o.schedule_id,o.state,o.work_order_id
      into schedule_id_value,schedule_state,schedule_work_order_id
    from public.maintenance_schedule_occurrences o
    where o.id=new.maintenance_schedule_occurrence_id;

    if schedule_id_value is distinct from program_schedule_id
       or schedule_state <> 'materialized'
       or schedule_work_order_id is distinct from new.work_order_id then
      raise exception 'Infrastructure maintenance inspection schedule evidence does not match the program occurrence';
    end if;
  end if;

  return new;
end;
$$;

create trigger infrastructure_maintenance_inspection_validate
before insert on public.infrastructure_maintenance_inspection_evidence
for each row execute function icamp_private.validate_infrastructure_maintenance_inspection();

create or replace function icamp_private.validate_infrastructure_maintenance_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_asset_id uuid;
  program_schedule_id uuid;
  schedule_id_value uuid;
  schedule_state text;
  schedule_work_order_id uuid;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  select p.asset_id,p.maintenance_schedule_id
    into program_asset_id,program_schedule_id
  from public.infrastructure_maintenance_programs p
  where p.id=new.program_id
    and p.organization_id=new.organization_id
    and p.campground_id=new.campground_id;

  if program_asset_id is distinct from new.asset_id then
    raise exception 'Infrastructure maintenance snapshot must use the program facility';
  end if;

  if new.recorded_by_user_id is distinct from actor_id then
    raise exception 'Infrastructure maintenance snapshot actor must match the request actor';
  end if;

  if new.maintenance_schedule_occurrence_id is not null then
    select o.schedule_id,o.state,o.work_order_id
      into schedule_id_value,schedule_state,schedule_work_order_id
    from public.maintenance_schedule_occurrences o
    where o.id=new.maintenance_schedule_occurrence_id;

    if schedule_id_value is distinct from program_schedule_id
       or schedule_state <> 'materialized'
       or schedule_work_order_id is distinct from new.work_order_id then
      raise exception 'Infrastructure maintenance snapshot schedule evidence does not match the program occurrence';
    end if;
  end if;

  return new;
end;
$$;

create trigger infrastructure_maintenance_snapshots_validate
before insert on public.infrastructure_maintenance_snapshots
for each row execute function icamp_private.validate_infrastructure_maintenance_snapshot();

create or replace function icamp_private.validate_infrastructure_maintenance_issue_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  program_asset_id uuid;
  order_asset_id uuid;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  select p.asset_id
    into program_asset_id
  from public.infrastructure_maintenance_programs p
  where p.id=new.program_id
    and p.organization_id=new.organization_id
    and p.campground_id=new.campground_id;

  select w.asset_id
    into order_asset_id
  from public.maintenance_work_orders w
  where w.id=new.work_order_id
    and w.organization_id=new.organization_id
    and w.campground_id=new.campground_id;

  if program_asset_id is distinct from new.asset_id
     or order_asset_id is distinct from new.asset_id then
    raise exception 'Infrastructure maintenance issue must link a work order for the same facility';
  end if;

  if new.created_by_user_id is distinct from actor_id then
    raise exception 'Infrastructure maintenance issue actor must match the request actor';
  end if;

  return new;
end;
$$;

create trigger infrastructure_maintenance_issue_links_validate
before insert on public.infrastructure_maintenance_issue_links
for each row execute function icamp_private.validate_infrastructure_maintenance_issue_link();

alter table public.infrastructure_maintenance_programs enable row level security;
alter table public.infrastructure_maintenance_inspection_evidence enable row level security;
alter table public.infrastructure_maintenance_snapshots enable row level security;
alter table public.infrastructure_maintenance_issue_links enable row level security;
alter table public.infrastructure_maintenance_programs force row level security;
alter table public.infrastructure_maintenance_inspection_evidence force row level security;
alter table public.infrastructure_maintenance_snapshots force row level security;
alter table public.infrastructure_maintenance_issue_links force row level security;

revoke all on public.infrastructure_maintenance_programs from public;
revoke all on public.infrastructure_maintenance_inspection_evidence from public;
revoke all on public.infrastructure_maintenance_snapshots from public;
revoke all on public.infrastructure_maintenance_issue_links from public;

do $build072_permissions$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.infrastructure_maintenance_programs from anon';
    execute 'revoke all on public.infrastructure_maintenance_inspection_evidence from anon';
    execute 'revoke all on public.infrastructure_maintenance_snapshots from anon';
    execute 'revoke all on public.infrastructure_maintenance_issue_links from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.infrastructure_maintenance_programs from authenticated';
    execute 'revoke all on public.infrastructure_maintenance_inspection_evidence from authenticated';
    execute 'revoke all on public.infrastructure_maintenance_snapshots from authenticated';
    execute 'revoke all on public.infrastructure_maintenance_issue_links from authenticated';
  end if;
end
$build072_permissions$;

grant select,insert,update on public.infrastructure_maintenance_programs to icamp_app;
grant select,insert on public.infrastructure_maintenance_inspection_evidence to icamp_app;
grant select,insert on public.infrastructure_maintenance_snapshots to icamp_app;
grant select,insert on public.infrastructure_maintenance_issue_links to icamp_app;

create policy infrastructure_maintenance_programs_read
on public.infrastructure_maintenance_programs
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
);

create policy infrastructure_maintenance_programs_insert
on public.infrastructure_maintenance_programs
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
);

create policy infrastructure_maintenance_programs_update
on public.infrastructure_maintenance_programs
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
);

create policy infrastructure_maintenance_inspection_read
on public.infrastructure_maintenance_inspection_evidence
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy infrastructure_maintenance_inspection_insert
on public.infrastructure_maintenance_inspection_evidence
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
);

create policy infrastructure_maintenance_snapshots_read
on public.infrastructure_maintenance_snapshots
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy infrastructure_maintenance_snapshots_insert
on public.infrastructure_maintenance_snapshots
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy infrastructure_maintenance_issue_links_read
on public.infrastructure_maintenance_issue_links
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy infrastructure_maintenance_issue_links_insert
on public.infrastructure_maintenance_issue_links
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.create')
);

comment on table public.infrastructure_maintenance_programs is
  'Build 072 road/parking/utility/garbage/septic program bindings. Recurrence, inspection and asset state remain owned by their canonical engines.';
comment on table public.infrastructure_maintenance_inspection_evidence is
  'Append-only Build 072 link between infrastructure maintenance and canonical inspection/scheduled-work evidence.';
comment on table public.infrastructure_maintenance_snapshots is
  'Append-only Build 072 surface/access, safety and infrastructure-service observations.';
comment on table public.infrastructure_maintenance_issue_links is
  'Append-only Build 072 issue-to-canonical-work-order links. Work-order status is the sole issue closure authority.';
