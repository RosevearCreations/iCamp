-- iCamp Build 068
-- Versioned Inspection Templates & Sign-Off.
--
-- Adds immutable published checklist versions, inspection occurrences/results,
-- sign-off evidence and failed-item corrective-action links to the canonical
-- Build 065 work-order engine.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values (
  'inspection.template.manage',
  'Create inspection templates and publish immutable template versions.',
  'elevated'
)
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('maintenance_main_foreman', 'inspection.template.manage'),
    ('campground_manager', 'inspection.template.manage'),
    ('owner_admin', 'inspection.template.manage')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create table public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  target_kind text not null
    check (target_kind in ('asset','site','cottage')),
  asset_id uuid,
  accommodation_id uuid,
  name text not null
    check (char_length(trim(name)) between 3 and 160),
  description text
    check (description is null or char_length(description) <= 2000),
  is_active boolean not null default true,
  current_version_id uuid,
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
  constraint inspection_templates_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_templates_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_templates_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_templates_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_templates_target_shape_check
    check (
      (
        target_kind='asset'
        and asset_id is not null
        and accommodation_id is null
      )
      or
      (
        target_kind in ('site','cottage')
        and asset_id is null
        and accommodation_id is not null
      )
    )
);

create table public.inspection_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  template_id uuid not null,
  version_number integer not null check (version_number >= 1),
  instructions text
    check (instructions is null or char_length(instructions) <= 4000),
  signoff_required boolean not null default true,
  failure_category_id uuid not null,
  failure_priority_policy_id uuid not null,
  published_at timestamptz,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint inspection_template_versions_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_template_versions_number_unique
    unique (template_id, version_number),
  constraint inspection_template_versions_template_fk
    foreign key (organization_id, campground_id, template_id)
    references public.inspection_templates(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_template_versions_failure_category_fk
    foreign key (organization_id, campground_id, failure_category_id)
    references public.maintenance_categories(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_template_versions_failure_priority_fk
    foreign key (
      organization_id,
      campground_id,
      failure_priority_policy_id
    )
    references public.maintenance_priority_policies(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict
);

alter table public.inspection_templates
  add constraint inspection_templates_current_version_fk
  foreign key (current_version_id)
  references public.inspection_template_versions(id)
  on update cascade
  on delete restrict;

create table public.inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  template_version_id uuid not null,
  item_key text not null
    check (item_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  position integer not null check (position between 1 and 1000),
  label text not null
    check (char_length(trim(label)) between 1 and 240),
  required boolean not null default true,
  failure_creates_work_order boolean not null default true,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint inspection_template_items_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_template_items_key_unique
    unique (template_version_id, item_key),
  constraint inspection_template_items_position_unique
    unique (template_version_id, position),
  constraint inspection_template_items_version_fk
    foreign key (organization_id, campground_id, template_version_id)
    references public.inspection_template_versions(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict
);

create table public.inspection_occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  template_id uuid not null,
  template_version_id uuid not null,
  target_kind text not null
    check (target_kind in ('asset','site','cottage')),
  asset_id uuid,
  accommodation_id uuid,
  inspector_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','signed_off','rejected')),
  signoff_required boolean not null,
  started_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  submitted_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  finalized_at timestamptz,
  finalized_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint inspection_occurrences_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_occurrences_template_fk
    foreign key (organization_id, campground_id, template_id)
    references public.inspection_templates(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_occurrences_version_fk
    foreign key (organization_id, campground_id, template_version_id)
    references public.inspection_template_versions(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint inspection_occurrences_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_occurrences_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_occurrences_target_shape_check
    check (
      (
        target_kind='asset'
        and asset_id is not null
        and accommodation_id is null
      )
      or
      (
        target_kind in ('site','cottage')
        and asset_id is null
        and accommodation_id is not null
      )
    ),
  constraint inspection_occurrences_lifecycle_check
    check (
      (
        status='in_progress'
        and submitted_at is null
        and submitted_by_user_id is null
        and finalized_at is null
        and finalized_by_user_id is null
      )
      or
      (
        status='submitted'
        and submitted_at is not null
        and submitted_by_user_id is not null
        and finalized_at is null
        and finalized_by_user_id is null
      )
      or
      (
        status in ('signed_off','rejected')
        and submitted_at is not null
        and submitted_by_user_id is not null
        and finalized_at is not null
        and finalized_by_user_id is not null
      )
    )
);

create table public.inspection_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  occurrence_id uuid not null,
  template_item_id uuid not null,
  result_value text not null
    check (result_value in ('pass','fail','not_applicable')),
  note text check (note is null or char_length(note) <= 2000),
  recorded_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint inspection_results_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_results_occurrence_item_unique
    unique (occurrence_id, template_item_id),
  constraint inspection_results_occurrence_fk
    foreign key (organization_id, campground_id, occurrence_id)
    references public.inspection_occurrences(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_results_item_fk
    foreign key (organization_id, campground_id, template_item_id)
    references public.inspection_template_items(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.inspection_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  occurrence_id uuid not null,
  decision text not null check (decision in ('approved','rejected')),
  note text check (note is null or char_length(note) <= 2000),
  signed_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  signed_at timestamptz not null default statement_timestamp(),
  constraint inspection_signoffs_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_signoffs_occurrence_unique
    unique (occurrence_id),
  constraint inspection_signoffs_occurrence_fk
    foreign key (organization_id, campground_id, occurrence_id)
    references public.inspection_occurrences(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.inspection_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  inspection_result_id uuid not null,
  work_order_id uuid not null,
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint inspection_corrective_actions_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint inspection_corrective_actions_result_unique
    unique (inspection_result_id),
  constraint inspection_corrective_actions_work_order_unique
    unique (work_order_id),
  constraint inspection_corrective_actions_result_fk
    foreign key (organization_id, campground_id, inspection_result_id)
    references public.inspection_results(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint inspection_corrective_actions_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index inspection_templates_target_asset_idx
  on public.inspection_templates(organization_id,campground_id,asset_id)
  where asset_id is not null;

create index inspection_templates_target_accommodation_idx
  on public.inspection_templates(organization_id,campground_id,accommodation_id)
  where accommodation_id is not null;

create index inspection_templates_current_version_idx
  on public.inspection_templates(current_version_id)
  where current_version_id is not null;

create index inspection_templates_created_by_idx
  on public.inspection_templates(created_by_user_id);

create index inspection_templates_updated_by_idx
  on public.inspection_templates(updated_by_user_id);

create index inspection_template_versions_template_idx
  on public.inspection_template_versions(organization_id,campground_id,template_id,version_number);

create index inspection_template_versions_failure_category_idx
  on public.inspection_template_versions(organization_id,campground_id,failure_category_id);

create index inspection_template_versions_failure_priority_idx
  on public.inspection_template_versions(organization_id,campground_id,failure_priority_policy_id);

create index inspection_template_versions_created_by_idx
  on public.inspection_template_versions(created_by_user_id);

create index inspection_template_items_version_idx
  on public.inspection_template_items(organization_id,campground_id,template_version_id,position);

create index inspection_template_items_created_by_idx
  on public.inspection_template_items(created_by_user_id);

create index inspection_occurrences_queue_idx
  on public.inspection_occurrences(campground_id,status,started_at desc);

create index inspection_occurrences_template_idx
  on public.inspection_occurrences(organization_id,campground_id,template_id);

create index inspection_occurrences_version_idx
  on public.inspection_occurrences(organization_id,campground_id,template_version_id);

create index inspection_occurrences_asset_idx
  on public.inspection_occurrences(organization_id,campground_id,asset_id)
  where asset_id is not null;

create index inspection_occurrences_accommodation_idx
  on public.inspection_occurrences(organization_id,campground_id,accommodation_id)
  where accommodation_id is not null;

create index inspection_occurrences_inspector_idx
  on public.inspection_occurrences(inspector_user_id);

create index inspection_occurrences_submitted_by_idx
  on public.inspection_occurrences(submitted_by_user_id)
  where submitted_by_user_id is not null;

create index inspection_occurrences_finalized_by_idx
  on public.inspection_occurrences(finalized_by_user_id)
  where finalized_by_user_id is not null;

create index inspection_results_occurrence_idx
  on public.inspection_results(organization_id,campground_id,occurrence_id);

create index inspection_results_item_idx
  on public.inspection_results(organization_id,campground_id,template_item_id);

create index inspection_results_recorded_by_idx
  on public.inspection_results(recorded_by_user_id);

create index inspection_signoffs_signed_by_idx
  on public.inspection_signoffs(signed_by_user_id);

create index inspection_corrective_actions_result_idx
  on public.inspection_corrective_actions(organization_id,campground_id,inspection_result_id);

create index inspection_corrective_actions_work_order_idx
  on public.inspection_corrective_actions(organization_id,campground_id,work_order_id);

create index inspection_corrective_actions_created_by_idx
  on public.inspection_corrective_actions(created_by_user_id);

create trigger inspection_templates_touch
before update on public.inspection_templates
for each row execute function icamp_private.touch_row();

create trigger inspection_occurrences_touch
before update on public.inspection_occurrences
for each row execute function icamp_private.touch_row();

create trigger inspection_results_touch
before update on public.inspection_results
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_inspection_template_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accommodation_kind_value text;
begin
  if new.target_kind='asset' then
    if not exists (
      select 1
      from public.operational_assets a
      where a.id=new.asset_id
        and a.organization_id=new.organization_id
        and a.campground_id=new.campground_id
        and a.lifecycle_state <> 'archived'
    ) then
      raise exception 'Inspection asset target is unavailable';
    end if;
  else
    select accommodation_kind
      into accommodation_kind_value
    from public.accommodations a
    where a.id=new.accommodation_id
      and a.organization_id=new.organization_id
      and a.campground_id=new.campground_id
      and a.lifecycle_state <> 'archived';

    if accommodation_kind_value is null then
      raise exception 'Inspection accommodation target is unavailable';
    end if;

    if new.target_kind='site' and accommodation_kind_value <> 'campsite' then
      raise exception 'Site inspection templates must target a campsite';
    end if;

    if new.target_kind='cottage'
       and accommodation_kind_value <> 'rental_cottage' then
      raise exception 'Cottage inspection templates must target a rental cottage';
    end if;
  end if;

  return new;
end;
$$;

create trigger inspection_templates_validate_target
before insert or update of target_kind,asset_id,accommodation_id
on public.inspection_templates
for each row execute function icamp_private.validate_inspection_template_target();

create or replace function icamp_private.guard_inspection_template_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  version_template_id uuid;
  version_published_at timestamptz;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.target_kind is distinct from new.target_kind
     or old.asset_id is distinct from new.asset_id
     or old.accommodation_id is distinct from new.accommodation_id
     or old.name is distinct from new.name
     or old.description is distinct from new.description
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Inspection template identity is immutable';
  end if;

  if not icamp_private.has_campground_permission(
    new.campground_id,
    'inspection.template.manage'
  ) then
    raise exception 'inspection.template.manage permission is required';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'updated_by_user_id must match the request actor';
  end if;

  if old.current_version_id is distinct from new.current_version_id then
    if new.current_version_id is null then
      raise exception 'Published inspection template cannot clear its current version';
    end if;

    select v.template_id,v.published_at
      into version_template_id,version_published_at
    from public.inspection_template_versions v
    where v.id=new.current_version_id
      and v.organization_id=new.organization_id
      and v.campground_id=new.campground_id;

    if version_template_id is distinct from new.id
       or version_published_at is null then
      raise exception 'Current inspection version must be a published version of this template';
    end if;
  end if;

  return new;
end;
$$;

create trigger inspection_templates_guard_update
before update on public.inspection_templates
for each row execute function icamp_private.guard_inspection_template_update();

create or replace function icamp_private.guard_inspection_version_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.template_id is distinct from new.template_id
     or old.version_number is distinct from new.version_number
     or old.instructions is distinct from new.instructions
     or old.signoff_required is distinct from new.signoff_required
     or old.failure_category_id is distinct from new.failure_category_id
     or old.failure_priority_policy_id is distinct from new.failure_priority_policy_id
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Inspection template version content is immutable';
  end if;

  if old.published_at is not null then
    raise exception 'Published inspection template versions are immutable';
  end if;

  if new.published_at is null then
    raise exception 'Inspection template version update may only publish the version';
  end if;

  if not icamp_private.has_campground_permission(
    new.campground_id,
    'inspection.template.manage'
  ) then
    raise exception 'inspection.template.manage permission is required';
  end if;

  if not exists (
    select 1
    from public.inspection_template_items i
    where i.template_version_id=new.id
  ) then
    raise exception 'Inspection template version requires at least one checklist item';
  end if;

  return new;
end;
$$;

create trigger inspection_template_versions_guard_update
before update on public.inspection_template_versions
for each row execute function icamp_private.guard_inspection_version_update();

create or replace function icamp_private.guard_inspection_item_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  published_at_value timestamptz;
begin
  select v.published_at
    into published_at_value
  from public.inspection_template_versions v
  where v.id=new.template_version_id
    and v.organization_id=new.organization_id
    and v.campground_id=new.campground_id;

  if not found then
    raise exception 'Inspection template version is unavailable';
  end if;

  if published_at_value is not null then
    raise exception 'Cannot add items to a published inspection template version';
  end if;

  if new.created_by_user_id is distinct from
     nullif(current_setting('icamp.user_id',true),'')::uuid then
    raise exception 'Inspection item creator must match the request actor';
  end if;

  return new;
end;
$$;

create trigger inspection_template_items_guard_insert
before insert on public.inspection_template_items
for each row execute function icamp_private.guard_inspection_item_insert();

create or replace function icamp_private.guard_inspection_occurrence_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.template_id is distinct from new.template_id
     or old.template_version_id is distinct from new.template_version_id
     or old.target_kind is distinct from new.target_kind
     or old.asset_id is distinct from new.asset_id
     or old.accommodation_id is distinct from new.accommodation_id
     or old.inspector_user_id is distinct from new.inspector_user_id
     or old.signoff_required is distinct from new.signoff_required
     or old.started_at is distinct from new.started_at then
    raise exception 'Inspection occurrence identity is immutable';
  end if;

  if old.status='in_progress' and new.status in ('submitted','signed_off') then
    if actor_id is distinct from old.inspector_user_id
       or not icamp_private.has_campground_permission(
         new.campground_id,
         'inspection.perform'
       ) then
      raise exception 'Only the assigned inspector may submit this inspection';
    end if;

    if new.submitted_by_user_id is distinct from actor_id
       or new.submitted_at is null then
      raise exception 'Inspection submission evidence is required';
    end if;

    if new.status='signed_off' and old.signoff_required then
      raise exception 'Required sign-off cannot be bypassed by the inspector';
    end if;

    if new.status='submitted'
       and not old.signoff_required then
      raise exception 'Inspection without required sign-off must finalize on submission';
    end if;
  elsif old.status='submitted' and new.status in ('signed_off','rejected') then
    if actor_id is not distinct from old.inspector_user_id then
      raise exception 'Inspector cannot sign off their own inspection';
    end if;

    if not icamp_private.has_campground_permission(
      new.campground_id,
      'inspection.signoff'
    ) then
      raise exception 'inspection.signoff permission is required';
    end if;

    if new.finalized_by_user_id is distinct from actor_id
       or new.finalized_at is null then
      raise exception 'Inspection sign-off evidence is required';
    end if;
  elsif old.status is distinct from new.status then
    raise exception 'Unsupported inspection occurrence status transition';
  end if;

  return new;
end;
$$;

create trigger inspection_occurrences_guard_update
before update on public.inspection_occurrences
for each row execute function icamp_private.guard_inspection_occurrence_update();

create or replace function icamp_private.guard_inspection_result_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  occurrence_version_id uuid;
  occurrence_status text;
  occurrence_inspector_id uuid;
  item_version_id uuid;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  if tg_op='UPDATE'
     and (
       old.organization_id is distinct from new.organization_id
       or old.campground_id is distinct from new.campground_id
       or old.occurrence_id is distinct from new.occurrence_id
       or old.template_item_id is distinct from new.template_item_id
       or old.created_at is distinct from new.created_at
     ) then
    raise exception 'Inspection result identity is immutable';
  end if;

  select o.template_version_id,o.status,o.inspector_user_id
    into occurrence_version_id,occurrence_status,occurrence_inspector_id
  from public.inspection_occurrences o
  where o.id=new.occurrence_id
    and o.organization_id=new.organization_id
    and o.campground_id=new.campground_id;

  select i.template_version_id
    into item_version_id
  from public.inspection_template_items i
  where i.id=new.template_item_id
    and i.organization_id=new.organization_id
    and i.campground_id=new.campground_id;

  if occurrence_version_id is null or item_version_id is null then
    raise exception 'Inspection occurrence/item is unavailable';
  end if;

  if occurrence_version_id is distinct from item_version_id then
    raise exception 'Inspection result item does not belong to occurrence version';
  end if;

  if occurrence_status <> 'in_progress' then
    raise exception 'Inspection results are immutable after submission';
  end if;

  if actor_id is distinct from occurrence_inspector_id
     or new.recorded_by_user_id is distinct from actor_id then
    raise exception 'Only the assigned inspector may record checklist results';
  end if;

  return new;
end;
$$;

create trigger inspection_results_guard_insert
before insert on public.inspection_results
for each row execute function icamp_private.guard_inspection_result_write();

create trigger inspection_results_guard_update
before update on public.inspection_results
for each row execute function icamp_private.guard_inspection_result_write();

create or replace function icamp_private.guard_inspection_signoff_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  occurrence_status text;
  occurrence_inspector_id uuid;
  signoff_required_value boolean;
  actor_id uuid;
begin
  actor_id := nullif(current_setting('icamp.user_id',true),'')::uuid;

  select o.status,o.inspector_user_id,o.signoff_required
    into occurrence_status,occurrence_inspector_id,signoff_required_value
  from public.inspection_occurrences o
  where o.id=new.occurrence_id
    and o.organization_id=new.organization_id
    and o.campground_id=new.campground_id;

  if occurrence_status <> 'submitted' or not signoff_required_value then
    raise exception 'Inspection is not awaiting sign-off';
  end if;

  if new.signed_by_user_id is distinct from actor_id then
    raise exception 'Sign-off actor must match the request actor';
  end if;

  if actor_id is not distinct from occurrence_inspector_id then
    raise exception 'Inspector cannot sign off their own inspection';
  end if;

  if not icamp_private.has_campground_permission(
    new.campground_id,
    'inspection.signoff'
  ) then
    raise exception 'inspection.signoff permission is required';
  end if;

  if new.decision='rejected'
     and (new.note is null or char_length(trim(new.note)) < 3) then
    raise exception 'Rejected inspection sign-off requires a note';
  end if;

  return new;
end;
$$;

create trigger inspection_signoffs_guard_insert
before insert on public.inspection_signoffs
for each row execute function icamp_private.guard_inspection_signoff_insert();

alter table public.inspection_templates enable row level security;
alter table public.inspection_templates force row level security;
alter table public.inspection_template_versions enable row level security;
alter table public.inspection_template_versions force row level security;
alter table public.inspection_template_items enable row level security;
alter table public.inspection_template_items force row level security;
alter table public.inspection_occurrences enable row level security;
alter table public.inspection_occurrences force row level security;
alter table public.inspection_results enable row level security;
alter table public.inspection_results force row level security;
alter table public.inspection_signoffs enable row level security;
alter table public.inspection_signoffs force row level security;
alter table public.inspection_corrective_actions enable row level security;
alter table public.inspection_corrective_actions force row level security;

revoke all on public.inspection_templates from public;
revoke all on public.inspection_template_versions from public;
revoke all on public.inspection_template_items from public;
revoke all on public.inspection_occurrences from public;
revoke all on public.inspection_results from public;
revoke all on public.inspection_signoffs from public;
revoke all on public.inspection_corrective_actions from public;

grant select,insert,update on public.inspection_templates to icamp_app;
grant select,insert,update on public.inspection_template_versions to icamp_app;
grant select,insert on public.inspection_template_items to icamp_app;
grant select,insert,update on public.inspection_occurrences to icamp_app;
grant select,insert,update on public.inspection_results to icamp_app;
grant select,insert on public.inspection_signoffs to icamp_app;
grant select,insert on public.inspection_corrective_actions to icamp_app;

do $revoke_data_api$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format('revoke all on public.inspection_templates from %I',role_name);
      execute format('revoke all on public.inspection_template_versions from %I',role_name);
      execute format('revoke all on public.inspection_template_items from %I',role_name);
      execute format('revoke all on public.inspection_occurrences from %I',role_name);
      execute format('revoke all on public.inspection_results from %I',role_name);
      execute format('revoke all on public.inspection_signoffs from %I',role_name);
      execute format('revoke all on public.inspection_corrective_actions from %I',role_name);
    end if;
  end loop;
end
$revoke_data_api$;

create policy inspection_templates_read
on public.inspection_templates
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
);

create policy inspection_templates_insert
on public.inspection_templates
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
  and created_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_templates_update
on public.inspection_templates
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
  and updated_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_versions_read
on public.inspection_template_versions
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
);

create policy inspection_versions_insert
on public.inspection_template_versions
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
  and created_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_versions_update
on public.inspection_template_versions
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
);

create policy inspection_items_read
on public.inspection_template_items
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
  or icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
);

create policy inspection_items_insert
on public.inspection_template_items
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.template.manage')
  and created_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_occurrences_read
on public.inspection_occurrences
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy inspection_occurrences_insert
on public.inspection_occurrences
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  and inspector_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_occurrences_update
on public.inspection_occurrences
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
)
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy inspection_results_read
on public.inspection_results
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy inspection_results_insert
on public.inspection_results
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  and recorded_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_results_update
on public.inspection_results
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
)
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  and recorded_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_signoffs_read
on public.inspection_signoffs
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy inspection_signoffs_insert
on public.inspection_signoffs
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.signoff')
  and signed_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy inspection_corrective_actions_read
on public.inspection_corrective_actions
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy inspection_corrective_actions_insert
on public.inspection_corrective_actions
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  and created_by_user_id=
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.inspection_templates is
  'Build 068 stable inspection-template identity bound to one asset, campsite or rental cottage.';

comment on table public.inspection_template_versions is
  'Build 068 immutable published inspection-template versions with sign-off and corrective-action policy snapshots.';

comment on table public.inspection_template_items is
  'Build 068 immutable checklist items belonging to one unpublished-then-published template version.';

comment on table public.inspection_occurrences is
  'Build 068 live/historical inspection executions pinned to one immutable template version.';

comment on table public.inspection_results is
  'Build 068 item-level pass/fail/not-applicable inspection evidence.';

comment on table public.inspection_signoffs is
  'Build 068 independent inspection sign-off evidence; inspector self-signoff is prohibited when sign-off is required.';

comment on table public.inspection_corrective_actions is
  'Build 068 failed-item link to the canonical Build 065 maintenance work order.';
