-- iCamp Build 069
-- Pool & Water-Park Maintenance Operations.
--
-- Reuses the canonical Build 029 asset, Build 030 status, Build 065 work-order,
-- Build 067 recurring schedule and Build 068 inspection authorities.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values
  ('aquatics.read', 'Read pool and water-park operating programs and evidence.', 'standard'),
  ('aquatics.manage', 'Configure pool/water-park maintenance programs and restrict operations.', 'elevated'),
  ('aquatics.reopen', 'Reopen a safety-sensitive pool/water-park after signed inspection evidence.', 'high')
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('maintenance', 'aquatics.read'),
    ('maintenance_foreman', 'aquatics.read'),
    ('maintenance_main_foreman', 'aquatics.read'),
    ('maintenance_main_foreman', 'aquatics.manage'),
    ('campground_manager', 'aquatics.read'),
    ('campground_manager', 'aquatics.manage'),
    ('campground_manager', 'aquatics.reopen'),
    ('owner_admin', 'aquatics.read'),
    ('owner_admin', 'aquatics.manage'),
    ('owner_admin', 'aquatics.reopen')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create table public.aquatic_facility_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  asset_id uuid not null,
  inspection_template_id uuid not null,
  maintenance_schedule_id uuid not null,
  reopen_inspection_max_age_minutes integer not null default 240
    check (reopen_inspection_max_age_minutes between 15 and 10080),
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
  constraint aquatic_facility_programs_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint aquatic_facility_programs_asset_unique
    unique (asset_id),
  constraint aquatic_facility_programs_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_facility_programs_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_facility_programs_template_fk
    foreign key (organization_id, campground_id, inspection_template_id)
    references public.inspection_templates(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_facility_programs_schedule_fk
    foreign key (organization_id, campground_id, maintenance_schedule_id)
    references public.maintenance_schedules(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.aquatic_inspection_evidence (
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
  constraint aquatic_inspection_evidence_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint aquatic_inspection_evidence_occurrence_unique
    unique (inspection_occurrence_id),
  constraint aquatic_inspection_evidence_program_fk
    foreign key (organization_id, campground_id, program_id)
    references public.aquatic_facility_programs(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_inspection_evidence_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_inspection_evidence_inspection_fk
    foreign key (organization_id, campground_id, inspection_occurrence_id)
    references public.inspection_occurrences(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_inspection_evidence_schedule_occurrence_fk
    foreign key (maintenance_schedule_occurrence_id)
    references public.maintenance_schedule_occurrences(id)
    on update cascade
    on delete restrict,
  constraint aquatic_inspection_evidence_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_inspection_evidence_schedule_shape_check
    check (
      (maintenance_schedule_occurrence_id is null and work_order_id is null)
      or
      (maintenance_schedule_occurrence_id is not null and work_order_id is not null)
    )
);

create table public.aquatic_operation_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  program_id uuid not null,
  asset_id uuid not null,
  decision_key text not null check (decision_key in ('limit','close','reopen')),
  from_state text not null,
  to_state text not null,
  status_revision bigint not null check (status_revision >= 1),
  reason text not null check (char_length(trim(reason)) between 8 and 1000),
  signed_inspection_occurrence_id uuid,
  decided_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  decided_at timestamptz not null default statement_timestamp(),
  constraint aquatic_operation_decisions_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint aquatic_operation_decisions_program_fk
    foreign key (organization_id, campground_id, program_id)
    references public.aquatic_facility_programs(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_operation_decisions_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_operation_decisions_inspection_fk
    foreign key (
      organization_id,
      campground_id,
      signed_inspection_occurrence_id
    )
    references public.inspection_occurrences(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint aquatic_operation_decisions_state_shape_check
    check (
      (decision_key='limit' and to_state='limited' and signed_inspection_occurrence_id is null)
      or
      (decision_key='close' and to_state='closed' and signed_inspection_occurrence_id is null)
      or
      (decision_key='reopen' and to_state='operational' and signed_inspection_occurrence_id is not null)
    )
);

create index aquatic_facility_programs_scope_asset_fk_idx
  on public.aquatic_facility_programs(organization_id,campground_id,asset_id);

create index aquatic_facility_programs_scope_template_fk_idx
  on public.aquatic_facility_programs(
    organization_id,
    campground_id,
    inspection_template_id
  );

create index aquatic_facility_programs_scope_schedule_fk_idx
  on public.aquatic_facility_programs(
    organization_id,
    campground_id,
    maintenance_schedule_id
  );

create index aquatic_facility_programs_created_by_idx
  on public.aquatic_facility_programs(created_by_user_id);

create index aquatic_facility_programs_updated_by_idx
  on public.aquatic_facility_programs(updated_by_user_id);

create index aquatic_inspection_evidence_scope_program_fk_idx
  on public.aquatic_inspection_evidence(
    organization_id,
    campground_id,
    program_id
  );

create index aquatic_inspection_evidence_scope_asset_fk_idx
  on public.aquatic_inspection_evidence(
    organization_id,
    campground_id,
    asset_id
  );

create index aquatic_inspection_evidence_scope_inspection_fk_idx
  on public.aquatic_inspection_evidence(
    organization_id,
    campground_id,
    inspection_occurrence_id
  );

create index aquatic_inspection_evidence_schedule_occurrence_fk_idx
  on public.aquatic_inspection_evidence(maintenance_schedule_occurrence_id)
  where maintenance_schedule_occurrence_id is not null;

create index aquatic_inspection_evidence_scope_work_order_fk_idx
  on public.aquatic_inspection_evidence(
    organization_id,
    campground_id,
    work_order_id
  )
  where work_order_id is not null;

create index aquatic_inspection_evidence_created_by_idx
  on public.aquatic_inspection_evidence(created_by_user_id);

create index aquatic_operation_decisions_scope_program_fk_idx
  on public.aquatic_operation_decisions(
    organization_id,
    campground_id,
    program_id
  );

create index aquatic_operation_decisions_scope_asset_fk_idx
  on public.aquatic_operation_decisions(
    organization_id,
    campground_id,
    asset_id
  );

create index aquatic_operation_decisions_scope_inspection_fk_idx
  on public.aquatic_operation_decisions(
    organization_id,
    campground_id,
    signed_inspection_occurrence_id
  )
  where signed_inspection_occurrence_id is not null;

create index aquatic_operation_decisions_actor_idx
  on public.aquatic_operation_decisions(decided_by_user_id);

create index aquatic_operation_decisions_history_idx
  on public.aquatic_operation_decisions(
    campground_id,
    asset_id,
    decided_at desc
  );

create trigger aquatic_facility_programs_touch
before update on public.aquatic_facility_programs
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_aquatic_program()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  facility_type_value text;
  asset_state text;
  template_asset_id uuid;
  template_active boolean;
  template_version_id uuid;
  template_signoff_required boolean;
  template_published_at timestamptz;
  schedule_asset_id uuid;
  schedule_active boolean;
begin
  if tg_op='UPDATE'
     and (
       old.organization_id is distinct from new.organization_id
       or old.campground_id is distinct from new.campground_id
       or old.asset_id is distinct from new.asset_id
       or old.created_by_user_id is distinct from new.created_by_user_id
       or old.created_at is distinct from new.created_at
     ) then
    raise exception 'Aquatic program identity is immutable';
  end if;

  select f.facility_type,a.lifecycle_state
    into facility_type_value,asset_state
  from public.operational_assets a
  join public.operational_facilities f
    on f.asset_id=a.id
   and f.organization_id=a.organization_id
   and f.campground_id=a.campground_id
  where a.id=new.asset_id
    and a.organization_id=new.organization_id
    and a.campground_id=new.campground_id;

  if facility_type_value is null
     or facility_type_value not in ('pool','water_park')
     or asset_state='archived' then
    raise exception 'Aquatic program requires an active pool or water-park asset';
  end if;

  select t.asset_id,t.is_active,t.current_version_id,
         v.signoff_required,v.published_at
    into template_asset_id,template_active,template_version_id,
         template_signoff_required,template_published_at
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
     or template_published_at is null
     or not template_signoff_required then
    raise exception 'Aquatic program requires a published sign-off inspection template for the same facility';
  end if;

  select s.asset_id,s.is_active
    into schedule_asset_id,schedule_active
  from public.maintenance_schedules s
  where s.id=new.maintenance_schedule_id
    and s.organization_id=new.organization_id
    and s.campground_id=new.campground_id;

  if schedule_asset_id is distinct from new.asset_id then
    raise exception 'Aquatic program recurring schedule must target the same facility';
  end if;

  if new.is_active and (not template_active or not schedule_active) then
    raise exception 'Active aquatic program requires active inspection template and recurring schedule';
  end if;

  if new.created_by_user_id is distinct from
     nullif(current_setting('icamp.user_id',true),'')::uuid
     and tg_op='INSERT' then
    raise exception 'Aquatic program creator must match the request actor';
  end if;

  if new.updated_by_user_id is distinct from
     nullif(current_setting('icamp.user_id',true),'')::uuid then
    raise exception 'Aquatic program updater must match the request actor';
  end if;

  return new;
end;
$$;

create trigger aquatic_facility_programs_validate
before insert or update
on public.aquatic_facility_programs
for each row execute function icamp_private.validate_aquatic_program();

create or replace function icamp_private.validate_aquatic_inspection_evidence()
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
begin
  select p.asset_id,p.inspection_template_id,p.maintenance_schedule_id
    into program_asset_id,program_template_id,program_schedule_id
  from public.aquatic_facility_programs p
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
    raise exception 'Aquatic inspection evidence must use the program facility and template';
  end if;

  if inspection_inspector_id is distinct from
     nullif(current_setting('icamp.user_id',true),'')::uuid
     or new.created_by_user_id is distinct from inspection_inspector_id then
    raise exception 'Aquatic inspection evidence must be started by its assigned inspector';
  end if;

  if new.maintenance_schedule_occurrence_id is not null then
    select o.schedule_id,o.state,o.work_order_id
      into schedule_id_value,schedule_state,schedule_work_order_id
    from public.maintenance_schedule_occurrences o
    where o.id=new.maintenance_schedule_occurrence_id;

    if schedule_id_value is distinct from program_schedule_id
       or schedule_state <> 'materialized'
       or schedule_work_order_id is distinct from new.work_order_id then
      raise exception 'Aquatic inspection schedule evidence does not match the program occurrence';
    end if;
  end if;

  return new;
end;
$$;

create trigger aquatic_inspection_evidence_validate
before insert on public.aquatic_inspection_evidence
for each row execute function icamp_private.validate_aquatic_inspection_evidence();

create or replace function icamp_private.validate_aquatic_operation_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  facility_type_value text;
  current_state text;
  current_revision bigint;
  program_template_id uuid;
  max_age_minutes integer;
  inspection_asset_id uuid;
  inspection_template_id uuid;
  inspection_status text;
  inspection_finalized_at timestamptz;
  last_restrictive_at timestamptz;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if new.decided_by_user_id is distinct from actor_id then
    raise exception 'Aquatic operating decision actor must match the request actor';
  end if;

  select f.facility_type,a.operating_state,a.status_revision
    into facility_type_value,current_state,current_revision
  from public.operational_assets a
  join public.operational_facilities f
    on f.asset_id=a.id
   and f.organization_id=a.organization_id
   and f.campground_id=a.campground_id
  where a.id=new.asset_id
    and a.organization_id=new.organization_id
    and a.campground_id=new.campground_id;

  if facility_type_value is null
     or facility_type_value not in ('pool','water_park') then
    raise exception 'Aquatic operating decisions require a pool or water-park asset';
  end if;

  if current_state is distinct from new.to_state
     or current_revision is distinct from new.status_revision then
    raise exception 'Aquatic decision must match the canonical asset status transition';
  end if;

  if not exists (
    select 1
    from public.operational_asset_status_history h
    where h.asset_id=new.asset_id
      and h.organization_id=new.organization_id
      and h.campground_id=new.campground_id
      and h.status_revision=new.status_revision
      and h.from_state=new.from_state
      and h.to_state=new.to_state
      and h.changed_by_user_id=new.decided_by_user_id
  ) then
    raise exception 'Aquatic decision requires matching canonical status history evidence';
  end if;

  if new.decision_key <> 'reopen' then
    return new;
  end if;

  select p.inspection_template_id,p.reopen_inspection_max_age_minutes
    into program_template_id,max_age_minutes
  from public.aquatic_facility_programs p
  where p.id=new.program_id
    and p.asset_id=new.asset_id
    and p.organization_id=new.organization_id
    and p.campground_id=new.campground_id
    and p.is_active;

  select o.asset_id,o.template_id,o.status,o.finalized_at
    into inspection_asset_id,inspection_template_id,inspection_status,
         inspection_finalized_at
  from public.inspection_occurrences o
  where o.id=new.signed_inspection_occurrence_id
    and o.organization_id=new.organization_id
    and o.campground_id=new.campground_id;

  if inspection_asset_id is distinct from new.asset_id
     or inspection_template_id is distinct from program_template_id
     or inspection_status <> 'signed_off'
     or inspection_finalized_at is null then
    raise exception 'Aquatic reopening requires a signed inspection for the active program';
  end if;

  if inspection_finalized_at <
     new.decided_at - make_interval(mins => max_age_minutes) then
    raise exception 'Aquatic reopening inspection is outside the configured freshness window';
  end if;

  select max(d.decided_at)
    into last_restrictive_at
  from public.aquatic_operation_decisions d
  where d.program_id=new.program_id
    and d.asset_id=new.asset_id
    and d.decision_key in ('limit','close');

  if last_restrictive_at is not null
     and inspection_finalized_at < last_restrictive_at then
    raise exception 'Aquatic reopening requires inspection sign-off after the latest restriction';
  end if;

  if exists (
    select 1
    from public.inspection_results r
    left join public.inspection_corrective_actions ca
      on ca.inspection_result_id=r.id
    left join public.maintenance_work_orders wo
      on wo.id=ca.work_order_id
    where r.occurrence_id=new.signed_inspection_occurrence_id
      and r.result_value='fail'
      and (
        ca.id is null
        or wo.id is null
        or wo.status not in ('completed','cancelled')
      )
  ) then
    raise exception 'Aquatic reopening is blocked by unresolved failed inspection work';
  end if;

  return new;
end;
$$;

create trigger aquatic_operation_decisions_validate
before insert on public.aquatic_operation_decisions
for each row execute function icamp_private.validate_aquatic_operation_decision();

alter table public.aquatic_facility_programs enable row level security;
alter table public.aquatic_facility_programs force row level security;
alter table public.aquatic_inspection_evidence enable row level security;
alter table public.aquatic_inspection_evidence force row level security;
alter table public.aquatic_operation_decisions enable row level security;
alter table public.aquatic_operation_decisions force row level security;

revoke all on public.aquatic_facility_programs from public;
revoke all on public.aquatic_inspection_evidence from public;
revoke all on public.aquatic_operation_decisions from public;

grant select,insert,update on public.aquatic_facility_programs to icamp_app;
grant select,insert on public.aquatic_inspection_evidence to icamp_app;
grant select,insert on public.aquatic_operation_decisions to icamp_app;

do $revoke_data_api$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format('revoke all on public.aquatic_facility_programs from %I',role_name);
      execute format('revoke all on public.aquatic_inspection_evidence from %I',role_name);
      execute format('revoke all on public.aquatic_operation_decisions from %I',role_name);
    end if;
  end loop;
end
$revoke_data_api$;

create policy aquatic_programs_read
on public.aquatic_facility_programs
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'aquatics.read')
  or icamp_private.has_campground_permission(campground_id,'aquatics.manage')
  or icamp_private.has_campground_permission(campground_id,'aquatics.reopen')
);

create policy aquatic_programs_insert
on public.aquatic_facility_programs
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'aquatics.manage')
);

create policy aquatic_programs_update
on public.aquatic_facility_programs
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'aquatics.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'aquatics.manage')
);

create policy aquatic_inspection_evidence_read
on public.aquatic_inspection_evidence
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'aquatics.read')
  or icamp_private.has_campground_permission(campground_id,'aquatics.manage')
  or icamp_private.has_campground_permission(campground_id,'aquatics.reopen')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy aquatic_inspection_evidence_insert
on public.aquatic_inspection_evidence
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  and created_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy aquatic_operation_decisions_read
on public.aquatic_operation_decisions
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'aquatics.read')
  or icamp_private.has_campground_permission(campground_id,'aquatics.manage')
  or icamp_private.has_campground_permission(campground_id,'aquatics.reopen')
);

create policy aquatic_operation_decisions_insert
on public.aquatic_operation_decisions
for insert to icamp_app
with check (
  decided_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (
    (decision_key in ('limit','close')
      and icamp_private.has_campground_permission(campground_id,'aquatics.manage'))
    or
    (decision_key='reopen'
      and icamp_private.has_campground_permission(campground_id,'aquatics.reopen'))
  )
);

comment on table public.aquatic_facility_programs is
  'Build 069 pool/water-park operating program binding one canonical asset to one Build 067 recurring schedule and one Build 068 signed inspection template.';

comment on table public.aquatic_inspection_evidence is
  'Build 069 link between a pool/water-park inspection and its optional materialized recurring maintenance occurrence/work order.';

comment on table public.aquatic_operation_decisions is
  'Build 069 append-only safety-sensitive operating restriction/reopen evidence tied to canonical Build 030 asset status history.';
