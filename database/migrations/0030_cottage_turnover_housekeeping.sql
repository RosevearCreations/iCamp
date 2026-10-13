-- iCamp Build 027
-- Cottage Turnover & Housekeeping Model.

alter table public.rental_cottages
  add constraint rental_cottages_scope_id_unique
    unique (organization_id, campground_id, accommodation_id);

create table public.cottage_housekeeping_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  turnover_type text not null default 'departure'
    check (turnover_type in ('departure','deep_clean','winter_open','winter_close','maintenance_reset')),
  expected_minutes smallint not null default 60 check (expected_minutes between 5 and 1440),
  linen_requirements text not null default '' check (char_length(linen_requirements) <= 2000),
  housekeeping_requirements text not null default '' check (char_length(housekeeping_requirements) <= 4000),
  damage_inspection_required boolean not null default true,
  security_inspection_required boolean not null default true,
  is_active boolean not null default true,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint cottage_housekeeping_templates_cottage_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.rental_cottages (organization_id, campground_id, accommodation_id)
    on update cascade on delete restrict,
  constraint cottage_housekeeping_templates_scope_name_unique unique (campground_id, accommodation_id, name),
  constraint cottage_housekeeping_templates_scope_id_unique unique (organization_id, campground_id, id)
);

create table public.cottage_inventory_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  template_id uuid not null,
  item_category text not null default 'other'
    check (item_category in ('linen','kitchen','bathroom','safety','security','equipment','consumable','other')),
  item_name text not null check (char_length(trim(item_name)) between 1 and 160),
  required_quantity smallint not null default 1 check (required_quantity between 1 and 999),
  unit text not null default 'item' check (char_length(trim(unit)) between 1 and 32),
  expected_condition text not null default '' check (char_length(expected_condition) <= 500),
  sort_order integer not null default 0 check (sort_order between 0 and 99999),
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint cottage_inventory_checklist_items_template_fk
    foreign key (organization_id, campground_id, template_id)
    references public.cottage_housekeeping_templates (organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint cottage_inventory_checklist_items_cottage_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.rental_cottages (organization_id, campground_id, accommodation_id)
    on update cascade on delete restrict,
  constraint cottage_inventory_checklist_items_scope_name_unique unique (template_id, item_name),
  constraint cottage_inventory_checklist_items_scope_id_unique unique (organization_id, campground_id, id)
);

create table public.cottage_turnovers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  template_id uuid not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','inspection','blocked','ready','cancelled')),
  scheduled_for timestamptz not null default statement_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  assigned_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  blocked_reason text not null default '' check (char_length(blocked_reason) <= 1000),
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint cottage_turnovers_template_fk
    foreign key (organization_id, campground_id, template_id)
    references public.cottage_housekeeping_templates (organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint cottage_turnovers_cottage_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.rental_cottages (organization_id, campground_id, accommodation_id)
    on update cascade on delete restrict,
  constraint cottage_turnovers_scope_id_unique unique (organization_id, campground_id, id),
  constraint cottage_turnovers_completed_state_check
    check ((status = 'ready' and completed_at is not null) or status <> 'ready')
);

create table public.cottage_turnover_item_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  turnover_id uuid not null,
  checklist_item_id uuid not null,
  item_category text not null,
  item_name text not null check (char_length(trim(item_name)) between 1 and 160),
  required_quantity smallint not null check (required_quantity between 1 and 999),
  unit text not null check (char_length(trim(unit)) between 1 and 32),
  expected_condition text not null default '' check (char_length(expected_condition) <= 500),
  is_required boolean not null default true,
  checked boolean not null default false,
  issue_found boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 1000),
  checked_at timestamptz,
  checked_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint cottage_turnover_item_checks_turnover_fk
    foreign key (organization_id, campground_id, turnover_id)
    references public.cottage_turnovers (organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint cottage_turnover_item_checks_source_fk
    foreign key (organization_id, campground_id, checklist_item_id)
    references public.cottage_inventory_checklist_items (organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint cottage_turnover_item_checks_cottage_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.rental_cottages (organization_id, campground_id, accommodation_id)
    on update cascade on delete restrict,
  constraint cottage_turnover_item_checks_snapshot_unique unique (turnover_id, checklist_item_id)
);

create table public.cottage_damage_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  accommodation_id uuid not null,
  turnover_id uuid not null,
  inspection_result text not null check (inspection_result in ('pass','issues_found')),
  linen_complete boolean not null default false,
  housekeeping_complete boolean not null default false,
  inventory_complete boolean not null default false,
  damage_found boolean not null default false,
  security_issue_found boolean not null default false,
  damage_notes text not null default '' check (char_length(damage_notes) <= 2000),
  security_notes text not null default '' check (char_length(security_notes) <= 2000),
  inspected_at timestamptz not null default statement_timestamp(),
  inspected_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  updated_by_user_id uuid references icamp_private.user_accounts(id) on update cascade on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint cottage_damage_inspections_turnover_fk
    foreign key (organization_id, campground_id, turnover_id)
    references public.cottage_turnovers (organization_id, campground_id, id)
    on update cascade on delete restrict,
  constraint cottage_damage_inspections_cottage_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.rental_cottages (organization_id, campground_id, accommodation_id)
    on update cascade on delete restrict
);

create trigger cottage_housekeeping_templates_touch_row before update on public.cottage_housekeeping_templates
for each row execute function icamp_private.touch_row();
create trigger cottage_inventory_checklist_items_touch_row before update on public.cottage_inventory_checklist_items
for each row execute function icamp_private.touch_row();
create trigger cottage_turnovers_touch_row before update on public.cottage_turnovers
for each row execute function icamp_private.touch_row();
create trigger cottage_turnover_item_checks_touch_row before update on public.cottage_turnover_item_checks
for each row execute function icamp_private.touch_row();
create trigger cottage_damage_inspections_touch_row before update on public.cottage_damage_inspections
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.bump_cottage_turnover_revisions()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  update public.accommodations
  set availability_revision = availability_revision + 1,
      status_revision = status_revision + 1,
      updated_by_user_id = coalesce(new.updated_by_user_id, updated_by_user_id)
  where id = new.accommodation_id
    and organization_id = new.organization_id
    and campground_id = new.campground_id;
  return null;
end;
$$;

create trigger cottage_turnovers_bump_parent_revisions
after insert or update of status, scheduled_for on public.cottage_turnovers
for each row execute function icamp_private.bump_cottage_turnover_revisions();

create index cottage_housekeeping_templates_cottage_idx on public.cottage_housekeeping_templates
  (organization_id, campground_id, accommodation_id, is_active);
create index cottage_housekeeping_templates_created_by_idx on public.cottage_housekeeping_templates (created_by_user_id)
  where created_by_user_id is not null;
create index cottage_housekeeping_templates_updated_by_idx on public.cottage_housekeeping_templates (updated_by_user_id)
  where updated_by_user_id is not null;

create index cottage_inventory_checklist_items_template_idx on public.cottage_inventory_checklist_items
  (organization_id, campground_id, template_id, is_active, sort_order);
create index cottage_inventory_checklist_items_cottage_idx on public.cottage_inventory_checklist_items
  (organization_id, campground_id, accommodation_id);
create index cottage_inventory_checklist_items_created_by_idx on public.cottage_inventory_checklist_items (created_by_user_id)
  where created_by_user_id is not null;
create index cottage_inventory_checklist_items_updated_by_idx on public.cottage_inventory_checklist_items (updated_by_user_id)
  where updated_by_user_id is not null;

create index cottage_turnovers_cottage_status_idx on public.cottage_turnovers
  (organization_id, campground_id, accommodation_id, status, scheduled_for desc);
create index cottage_turnovers_template_idx on public.cottage_turnovers (template_id);
create index cottage_turnovers_assigned_user_idx on public.cottage_turnovers (assigned_user_id)
  where assigned_user_id is not null;
create index cottage_turnovers_created_by_idx on public.cottage_turnovers (created_by_user_id)
  where created_by_user_id is not null;
create index cottage_turnovers_updated_by_idx on public.cottage_turnovers (updated_by_user_id)
  where updated_by_user_id is not null;

create index cottage_turnover_item_checks_turnover_idx on public.cottage_turnover_item_checks
  (organization_id, campground_id, turnover_id, checked, issue_found);
create index cottage_turnover_item_checks_source_idx on public.cottage_turnover_item_checks (checklist_item_id);
create index cottage_turnover_item_checks_checked_by_idx on public.cottage_turnover_item_checks (checked_by_user_id)
  where checked_by_user_id is not null;
create index cottage_turnover_item_checks_updated_by_idx on public.cottage_turnover_item_checks (updated_by_user_id)
  where updated_by_user_id is not null;

create index cottage_damage_inspections_turnover_idx on public.cottage_damage_inspections
  (organization_id, campground_id, turnover_id, inspected_at desc);
create index cottage_damage_inspections_cottage_idx on public.cottage_damage_inspections
  (organization_id, campground_id, accommodation_id, inspected_at desc);
create index cottage_damage_inspections_inspected_by_idx on public.cottage_damage_inspections (inspected_by_user_id)
  where inspected_by_user_id is not null;
create index cottage_damage_inspections_created_by_idx on public.cottage_damage_inspections (created_by_user_id)
  where created_by_user_id is not null;
create index cottage_damage_inspections_updated_by_idx on public.cottage_damage_inspections (updated_by_user_id)
  where updated_by_user_id is not null;

alter table public.cottage_housekeeping_templates enable row level security;
alter table public.cottage_inventory_checklist_items enable row level security;
alter table public.cottage_turnovers enable row level security;
alter table public.cottage_turnover_item_checks enable row level security;
alter table public.cottage_damage_inspections enable row level security;

alter table public.cottage_housekeeping_templates force row level security;
alter table public.cottage_inventory_checklist_items force row level security;
alter table public.cottage_turnovers force row level security;
alter table public.cottage_turnover_item_checks force row level security;
alter table public.cottage_damage_inspections force row level security;

revoke all on public.cottage_housekeeping_templates from public;
revoke all on public.cottage_inventory_checklist_items from public;
revoke all on public.cottage_turnovers from public;
revoke all on public.cottage_turnover_item_checks from public;
revoke all on public.cottage_damage_inspections from public;

do $build027_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.cottage_housekeeping_templates from anon';
    execute 'revoke all on public.cottage_inventory_checklist_items from anon';
    execute 'revoke all on public.cottage_turnovers from anon';
    execute 'revoke all on public.cottage_turnover_item_checks from anon';
    execute 'revoke all on public.cottage_damage_inspections from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.cottage_housekeeping_templates from authenticated';
    execute 'revoke all on public.cottage_inventory_checklist_items from authenticated';
    execute 'revoke all on public.cottage_turnovers from authenticated';
    execute 'revoke all on public.cottage_turnover_item_checks from authenticated';
    execute 'revoke all on public.cottage_damage_inspections from authenticated';
  end if;
end
$build027_permissions$;

grant select, insert, update on public.cottage_housekeeping_templates to icamp_app;
grant select, insert, update on public.cottage_inventory_checklist_items to icamp_app;
grant select, insert, update on public.cottage_turnovers to icamp_app;
grant select, insert, update on public.cottage_turnover_item_checks to icamp_app;
grant select, insert, update on public.cottage_damage_inspections to icamp_app;

create policy cottage_housekeeping_templates_read on public.cottage_housekeeping_templates
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);
create policy cottage_housekeeping_templates_manage_insert on public.cottage_housekeeping_templates
for insert to icamp_app with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));
create policy cottage_housekeeping_templates_manage_update on public.cottage_housekeeping_templates
for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));

create policy cottage_inventory_checklist_items_read on public.cottage_inventory_checklist_items
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);
create policy cottage_inventory_checklist_items_manage_insert on public.cottage_inventory_checklist_items
for insert to icamp_app with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));
create policy cottage_inventory_checklist_items_manage_update on public.cottage_inventory_checklist_items
for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));

create policy cottage_turnovers_read on public.cottage_turnovers
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);
create policy cottage_turnovers_manage_insert on public.cottage_turnovers
for insert to icamp_app with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));
create policy cottage_turnovers_manage_update on public.cottage_turnovers
for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));

create policy cottage_turnover_item_checks_read on public.cottage_turnover_item_checks
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);
create policy cottage_turnover_item_checks_manage_insert on public.cottage_turnover_item_checks
for insert to icamp_app with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));
create policy cottage_turnover_item_checks_manage_update on public.cottage_turnover_item_checks
for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));

create policy cottage_damage_inspections_read on public.cottage_damage_inspections
for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);
create policy cottage_damage_inspections_manage_insert on public.cottage_damage_inspections
for insert to icamp_app with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));
create policy cottage_damage_inspections_manage_update on public.cottage_damage_inspections
for update to icamp_app
using (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'))
with check (icamp_private.has_campground_permission(campground_id, 'accommodation.manage'));

comment on table public.cottage_housekeeping_templates is
  'Reusable Build 027 turnover instructions, linen requirements and inspection requirements for rental cottages.';
comment on table public.cottage_inventory_checklist_items is
  'Reusable cottage inventory and housekeeping checklist definition attached to a Build 027 turnover template.';
comment on table public.cottage_turnovers is
  'Operational rental-cottage turnover run. Status changes advance canonical accommodation availability/status hook revisions.';
comment on table public.cottage_turnover_item_checks is
  'Snapshot checklist evidence for a cottage turnover, preserving the template state used when work began.';
comment on table public.cottage_damage_inspections is
  'Repeatable damage/security inspection evidence used to determine whether a cottage turnover is ready or blocked.';
