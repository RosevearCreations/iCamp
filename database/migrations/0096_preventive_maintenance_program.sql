-- iCamp Build 075
-- Preventive Maintenance Program.
--
-- Reuses Build 029 canonical facility/equipment assets, Build 067 recurring
-- maintenance schedules, and Build 065 work orders/material/labour evidence.
-- Build 075 adds only reusable preventive-service definitions and immutable
-- asset-to-schedule program bindings.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values (
  'maintenance.preventive',
  'Create and manage preventive-maintenance templates and programs.',
  'elevated'
)
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('maintenance_main_foreman', 'maintenance.preventive'),
    ('campground_manager', 'maintenance.preventive'),
    ('owner_admin', 'maintenance.preventive')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create table public.preventive_maintenance_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  target_asset_class text not null
    check (target_asset_class in ('facility','equipment','either')),
  name text not null
    check (char_length(trim(name)) between 3 and 160),
  description text
    check (description is null or char_length(description) <= 4000),
  service_instructions text not null
    check (char_length(trim(service_instructions)) between 3 and 8000),
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
  constraint preventive_maintenance_templates_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint preventive_maintenance_templates_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create table public.preventive_maintenance_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  asset_id uuid not null,
  template_id uuid not null,
  maintenance_schedule_id uuid not null,
  notes text
    check (notes is null or char_length(notes) <= 2000),
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
  constraint preventive_maintenance_programs_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint preventive_maintenance_programs_schedule_unique
    unique (campground_id, maintenance_schedule_id),
  constraint preventive_maintenance_programs_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint preventive_maintenance_programs_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint preventive_maintenance_programs_template_fk
    foreign key (organization_id, campground_id, template_id)
    references public.preventive_maintenance_templates(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint preventive_maintenance_programs_schedule_fk
    foreign key (organization_id, campground_id, maintenance_schedule_id)
    references public.maintenance_schedules(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index preventive_maintenance_templates_scope_active_idx
  on public.preventive_maintenance_templates(
    organization_id,
    campground_id,
    is_active,
    target_asset_class,
    name
  );

create index preventive_maintenance_templates_created_by_idx
  on public.preventive_maintenance_templates(created_by_user_id);

create index preventive_maintenance_templates_updated_by_idx
  on public.preventive_maintenance_templates(updated_by_user_id);

create index preventive_maintenance_programs_scope_active_idx
  on public.preventive_maintenance_programs(
    organization_id,
    campground_id,
    is_active,
    asset_id
  );

create index preventive_maintenance_programs_asset_idx
  on public.preventive_maintenance_programs(asset_id);

create index preventive_maintenance_programs_template_idx
  on public.preventive_maintenance_programs(template_id);

create index preventive_maintenance_programs_created_by_idx
  on public.preventive_maintenance_programs(created_by_user_id);

create index preventive_maintenance_programs_updated_by_idx
  on public.preventive_maintenance_programs(updated_by_user_id);

create trigger preventive_maintenance_templates_touch
before update on public.preventive_maintenance_templates
for each row execute function icamp_private.touch_row();

create trigger preventive_maintenance_programs_touch
before update on public.preventive_maintenance_programs
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_preventive_maintenance_template_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.target_asset_class is distinct from new.target_asset_class
     or old.name is distinct from new.name
     or old.description is distinct from new.description
     or old.service_instructions is distinct from new.service_instructions
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Preventive-maintenance template definition is immutable; deactivate and create a replacement template';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'Preventive-maintenance template actor must match the request actor';
  end if;

  return new;
end;
$$;

create trigger preventive_maintenance_templates_guard_update
before update on public.preventive_maintenance_templates
for each row execute function icamp_private.guard_preventive_maintenance_template_update();

create or replace function icamp_private.validate_preventive_maintenance_program()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  asset_class_value text;
  asset_lifecycle_value text;
  template_class_value text;
  template_active_value boolean;
  schedule_asset_id uuid;
  schedule_accommodation_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  select a.asset_class, a.lifecycle_state
    into asset_class_value, asset_lifecycle_value
  from public.operational_assets a
  where a.organization_id=new.organization_id
    and a.campground_id=new.campground_id
    and a.id=new.asset_id;

  if not found or asset_lifecycle_value='archived' then
    raise exception 'Preventive-maintenance asset is unavailable';
  end if;

  select t.target_asset_class, t.is_active
    into template_class_value, template_active_value
  from public.preventive_maintenance_templates t
  where t.organization_id=new.organization_id
    and t.campground_id=new.campground_id
    and t.id=new.template_id;

  if not found then
    raise exception 'Preventive-maintenance template is unavailable';
  end if;

  if new.is_active and not template_active_value then
    raise exception 'Active preventive-maintenance programs require an active template';
  end if;

  if template_class_value <> 'either'
     and template_class_value <> asset_class_value then
    raise exception 'Preventive-maintenance template does not match the asset class';
  end if;

  select s.asset_id, s.accommodation_id
    into schedule_asset_id, schedule_accommodation_id
  from public.maintenance_schedules s
  where s.organization_id=new.organization_id
    and s.campground_id=new.campground_id
    and s.id=new.maintenance_schedule_id;

  if not found then
    raise exception 'Preventive-maintenance schedule is unavailable';
  end if;

  if schedule_asset_id is distinct from new.asset_id
     or schedule_accommodation_id is not null then
    raise exception 'Preventive-maintenance schedule must target the exact canonical asset';
  end if;

  if tg_op='INSERT' and new.created_by_user_id is distinct from actor_id then
    raise exception 'Preventive-maintenance program creator must match the request actor';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'Preventive-maintenance program actor must match the request actor';
  end if;

  return new;
end;
$$;

create trigger preventive_maintenance_programs_validate
before insert or update on public.preventive_maintenance_programs
for each row execute function icamp_private.validate_preventive_maintenance_program();

create or replace function icamp_private.guard_preventive_maintenance_program_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.asset_id is distinct from new.asset_id
     or old.template_id is distinct from new.template_id
     or old.maintenance_schedule_id is distinct from new.maintenance_schedule_id
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Preventive-maintenance program definition is immutable; deactivate and create a replacement program';
  end if;

  return new;
end;
$$;

create trigger preventive_maintenance_programs_guard_update
before update on public.preventive_maintenance_programs
for each row execute function icamp_private.guard_preventive_maintenance_program_update();

alter table public.preventive_maintenance_templates enable row level security;
alter table public.preventive_maintenance_templates force row level security;
alter table public.preventive_maintenance_programs enable row level security;
alter table public.preventive_maintenance_programs force row level security;

revoke all on public.preventive_maintenance_templates from public;
revoke all on public.preventive_maintenance_programs from public;

grant select,insert,update on public.preventive_maintenance_templates to icamp_app;
grant select,insert,update on public.preventive_maintenance_programs to icamp_app;

do $revoke_data_api$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format(
        'revoke all on public.preventive_maintenance_templates from %I',
        role_name
      );
      execute format(
        'revoke all on public.preventive_maintenance_programs from %I',
        role_name
      );
    end if;
  end loop;
end
$revoke_data_api$;

create policy preventive_maintenance_templates_read
on public.preventive_maintenance_templates
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
);

create policy preventive_maintenance_templates_insert
on public.preventive_maintenance_templates
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy preventive_maintenance_templates_update
on public.preventive_maintenance_templates
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy preventive_maintenance_programs_read
on public.preventive_maintenance_programs
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.schedule')
  or icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
);

create policy preventive_maintenance_programs_insert
on public.preventive_maintenance_programs
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy preventive_maintenance_programs_update
on public.preventive_maintenance_programs
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
)
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.preventive')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.preventive_maintenance_templates is
  'Build 075 immutable reusable service instructions for canonical campground facilities/equipment. Create a replacement template instead of rewriting historical instructions.';
comment on table public.preventive_maintenance_programs is
  'Build 075 asset-to-template-to-Build-067 schedule bindings. Build 065 work orders remain the parts/labour/completion authority.';
