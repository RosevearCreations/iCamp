-- iCamp Build 065
-- Work Order Engine.
--
-- Canonical maintenance work orders reuse Build 064 categories and priority
-- policies. Notes, secure-media links, materials, labour and status history are
-- append-only evidence. Recurring scheduling remains a later build.

alter table public.maintenance_categories
  add constraint maintenance_categories_scope_id_unique
  unique (organization_id, campground_id, id);

alter table public.maintenance_priority_policies
  add constraint maintenance_priority_policies_scope_id_unique
  unique (organization_id, campground_id, id);

alter table icamp_private.media_assets
  add constraint media_assets_scope_id_unique
  unique (organization_id, campground_id, id);

create table public.maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  category_id uuid not null,
  priority_policy_id uuid not null,
  section_id uuid,
  asset_id uuid,
  accommodation_id uuid,
  location_description text
    check (
      location_description is null
      or char_length(trim(location_description)) between 1 and 240
    ),
  title text not null
    check (char_length(trim(title)) between 3 and 160),
  description text
    check (description is null or char_length(description) <= 4000),
  status text not null default 'open'
    check (
      status in (
        'open',
        'assigned',
        'in_progress',
        'blocked',
        'completed',
        'cancelled'
      )
    ),
  assigned_to_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  response_due_at timestamptz not null,
  completion_due_at timestamptz not null,
  responded_at timestamptz,
  completed_at timestamptz,
  completed_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  completion_summary text
    check (
      completion_summary is null
      or char_length(trim(completion_summary)) between 8 and 4000
    ),
  cancelled_at timestamptz,
  cancelled_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  cancellation_reason text
    check (
      cancellation_reason is null
      or char_length(trim(cancellation_reason)) between 3 and 1000
    ),
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
  constraint maintenance_work_orders_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_orders_category_fk
    foreign key (organization_id, campground_id, category_id)
    references public.maintenance_categories(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_orders_priority_fk
    foreign key (organization_id, campground_id, priority_policy_id)
    references public.maintenance_priority_policies(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint maintenance_work_orders_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_orders_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_orders_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_orders_location_check
    check (
      section_id is not null
      or asset_id is not null
      or accommodation_id is not null
      or location_description is not null
    ),
  constraint maintenance_work_orders_due_order_check
    check (completion_due_at >= response_due_at),
  constraint maintenance_work_orders_completion_check
    check (
      (
        status = 'completed'
        and completed_at is not null
        and completed_by_user_id is not null
        and completion_summary is not null
      )
      or
      (
        status <> 'completed'
        and completed_at is null
        and completed_by_user_id is null
        and completion_summary is null
      )
    ),
  constraint maintenance_work_orders_cancellation_check
    check (
      (
        status = 'cancelled'
        and cancelled_at is not null
        and cancelled_by_user_id is not null
        and cancellation_reason is not null
      )
      or
      (
        status <> 'cancelled'
        and cancelled_at is null
        and cancelled_by_user_id is null
        and cancellation_reason is null
      )
    )
);

alter table public.maintenance_work_orders
  add constraint maintenance_work_orders_scope_id_unique
  unique (organization_id, campground_id, id);

create table public.maintenance_work_order_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  work_order_id uuid not null,
  from_status text,
  to_status text not null,
  actor_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  note text
    check (note is null or char_length(trim(note)) between 1 and 1000),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint maintenance_work_order_status_events_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_order_status_events_from_check
    check (
      from_status is null
      or from_status in (
        'open','assigned','in_progress','blocked','completed','cancelled'
      )
    ),
  constraint maintenance_work_order_status_events_to_check
    check (
      to_status in (
        'open','assigned','in_progress','blocked','completed','cancelled'
      )
    )
);

create table public.maintenance_work_order_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  work_order_id uuid not null,
  note_text text not null
    check (char_length(trim(note_text)) between 1 and 4000),
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint maintenance_work_order_notes_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.maintenance_work_order_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  work_order_id uuid not null,
  media_asset_id uuid not null,
  caption text
    check (caption is null or char_length(trim(caption)) between 1 and 500),
  created_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint maintenance_work_order_media_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_order_media_asset_fk
    foreign key (organization_id, campground_id, media_asset_id)
    references icamp_private.media_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint maintenance_work_order_media_unique
    unique (work_order_id, media_asset_id)
);

create table public.maintenance_work_order_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  work_order_id uuid not null,
  item_name text not null
    check (char_length(trim(item_name)) between 1 and 160),
  quantity numeric(14,3) not null
    check (quantity > 0 and quantity <= 1000000),
  unit text not null
    check (char_length(trim(unit)) between 1 and 40),
  unit_cost_cents bigint
    check (unit_cost_cents is null or unit_cost_cents between 0 and 1000000000),
  recorded_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint maintenance_work_order_materials_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.maintenance_work_order_labor (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  work_order_id uuid not null,
  worker_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  minutes integer not null check (minutes between 1 and 10080),
  note text check (note is null or char_length(note) <= 1000),
  recorded_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  worked_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint maintenance_work_order_labor_work_order_fk
    foreign key (organization_id, campground_id, work_order_id)
    references public.maintenance_work_orders(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create index maintenance_work_orders_scope_status_priority_idx
  on public.maintenance_work_orders(
    organization_id,
    campground_id,
    status,
    priority_policy_id,
    created_at desc
  );
create index maintenance_work_orders_assignee_status_idx
  on public.maintenance_work_orders(
    assigned_to_user_id,
    status,
    completion_due_at
  )
  where assigned_to_user_id is not null;
create index maintenance_work_orders_category_idx
  on public.maintenance_work_orders(category_id, status);
create index maintenance_work_orders_section_idx
  on public.maintenance_work_orders(section_id)
  where section_id is not null;
create index maintenance_work_orders_asset_idx
  on public.maintenance_work_orders(asset_id)
  where asset_id is not null;
create index maintenance_work_orders_accommodation_idx
  on public.maintenance_work_orders(accommodation_id)
  where accommodation_id is not null;
create index maintenance_work_orders_created_by_idx
  on public.maintenance_work_orders(created_by_user_id);
create index maintenance_work_orders_updated_by_idx
  on public.maintenance_work_orders(updated_by_user_id);
create index maintenance_work_orders_completed_by_idx
  on public.maintenance_work_orders(completed_by_user_id)
  where completed_by_user_id is not null;
create index maintenance_work_orders_cancelled_by_idx
  on public.maintenance_work_orders(cancelled_by_user_id)
  where cancelled_by_user_id is not null;
create index maintenance_work_order_status_events_order_idx
  on public.maintenance_work_order_status_events(work_order_id, occurred_at desc);
create index maintenance_work_order_status_events_actor_idx
  on public.maintenance_work_order_status_events(actor_user_id)
  where actor_user_id is not null;
create index maintenance_work_order_notes_order_idx
  on public.maintenance_work_order_notes(work_order_id, created_at desc);
create index maintenance_work_order_notes_actor_idx
  on public.maintenance_work_order_notes(created_by_user_id);
create index maintenance_work_order_media_order_idx
  on public.maintenance_work_order_media(work_order_id, created_at desc);
create index maintenance_work_order_media_actor_idx
  on public.maintenance_work_order_media(created_by_user_id);
create index maintenance_work_order_media_asset_idx
  on public.maintenance_work_order_media(media_asset_id);
create index maintenance_work_order_materials_order_idx
  on public.maintenance_work_order_materials(work_order_id, recorded_at desc);
create index maintenance_work_order_materials_actor_idx
  on public.maintenance_work_order_materials(recorded_by_user_id);
create index maintenance_work_order_labor_order_idx
  on public.maintenance_work_order_labor(work_order_id, worked_at desc);
create index maintenance_work_order_labor_worker_idx
  on public.maintenance_work_order_labor(worker_user_id);
create index maintenance_work_order_labor_recorder_idx
  on public.maintenance_work_order_labor(recorded_by_user_id);

create trigger maintenance_work_orders_touch
before update on public.maintenance_work_orders
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.guard_maintenance_work_order_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  assigned_is_current boolean;
begin
  actor_id := nullif(current_setting('icamp.user_id', true), '')::uuid;

  if old.organization_id is distinct from new.organization_id
     or old.campground_id is distinct from new.campground_id
     or old.category_id is distinct from new.category_id
     or old.priority_policy_id is distinct from new.priority_policy_id
     or old.section_id is distinct from new.section_id
     or old.asset_id is distinct from new.asset_id
     or old.accommodation_id is distinct from new.accommodation_id
     or old.location_description is distinct from new.location_description
     or old.title is distinct from new.title
     or old.description is distinct from new.description
     or old.response_due_at is distinct from new.response_due_at
     or old.completion_due_at is distinct from new.completion_due_at
     or old.created_by_user_id is distinct from new.created_by_user_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Build 065 work-order classification and creation evidence is immutable';
  end if;

  if old.status in ('completed','cancelled')
     and old.assigned_to_user_id is distinct from new.assigned_to_user_id then
    raise exception 'Closed maintenance work orders cannot be reassigned';
  end if;

  if new.assigned_to_user_id is not null then
    select exists (
      select 1
      from icamp_private.campground_assignments a
      join icamp_private.user_accounts u on u.id = a.user_id
      where a.user_id = new.assigned_to_user_id
        and a.organization_id = new.organization_id
        and a.campground_id = new.campground_id
        and a.assignment_state = 'active'
        and a.starts_at <= statement_timestamp()
        and (a.ends_at is null or a.ends_at > statement_timestamp())
        and u.account_type = 'staff'
        and u.account_state = 'active'
    ) into assigned_is_current;

    if not assigned_is_current then
      raise exception 'Assigned maintenance worker must have an active campground staff assignment';
    end if;
  end if;

  if new.status in ('assigned','in_progress')
     and new.assigned_to_user_id is null then
    raise exception 'Assigned and in-progress work orders require an assignee';
  end if;

  if old.status is distinct from new.status then
    if old.status = 'open' and new.status not in ('assigned','in_progress','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status = 'assigned' and new.status not in ('open','in_progress','blocked','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status = 'in_progress' and new.status not in ('assigned','blocked','completed','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status = 'blocked' and new.status not in ('assigned','in_progress','cancelled') then
      raise exception 'Unsupported maintenance work-order status transition';
    elsif old.status in ('completed','cancelled') then
      raise exception 'Completed or cancelled maintenance work orders are terminal';
    end if;

    if new.status = 'completed' then
      if not icamp_private.has_campground_permission(
        new.campground_id,
        'maintenance.complete'
      ) then
        raise exception 'maintenance.complete permission is required';
      end if;
    elsif not icamp_private.has_campground_permission(
      new.campground_id,
      'maintenance.assign'
    ) then
      raise exception 'maintenance.assign permission is required for status changes';
    end if;
  end if;

  if old.assigned_to_user_id is distinct from new.assigned_to_user_id
     and not icamp_private.has_campground_permission(
       new.campground_id,
       'maintenance.assign'
     ) then
    raise exception 'maintenance.assign permission is required for assignment changes';
  end if;

  if new.updated_by_user_id is distinct from actor_id then
    raise exception 'updated_by_user_id must match the request actor';
  end if;

  return new;
end;
$$;

create trigger maintenance_work_orders_guard_update
before update on public.maintenance_work_orders
for each row execute function icamp_private.guard_maintenance_work_order_update();

alter table public.maintenance_work_orders enable row level security;
alter table public.maintenance_work_orders force row level security;
alter table public.maintenance_work_order_status_events enable row level security;
alter table public.maintenance_work_order_status_events force row level security;
alter table public.maintenance_work_order_notes enable row level security;
alter table public.maintenance_work_order_notes force row level security;
alter table public.maintenance_work_order_media enable row level security;
alter table public.maintenance_work_order_media force row level security;
alter table public.maintenance_work_order_materials enable row level security;
alter table public.maintenance_work_order_materials force row level security;
alter table public.maintenance_work_order_labor enable row level security;
alter table public.maintenance_work_order_labor force row level security;

revoke all on public.maintenance_work_orders from public;
revoke all on public.maintenance_work_order_status_events from public;
revoke all on public.maintenance_work_order_notes from public;
revoke all on public.maintenance_work_order_media from public;
revoke all on public.maintenance_work_order_materials from public;
revoke all on public.maintenance_work_order_labor from public;

grant select,insert,update on public.maintenance_work_orders to icamp_app;
grant select on public.maintenance_work_order_status_events to icamp_app;
grant select,insert on public.maintenance_work_order_notes to icamp_app;
grant select,insert on public.maintenance_work_order_media to icamp_app;
grant select,insert on public.maintenance_work_order_materials to icamp_app;
grant select,insert on public.maintenance_work_order_labor to icamp_app;

do $revoke_data_api$
declare
  role_name text;
  table_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      foreach table_name in array array[
        'maintenance_work_orders',
        'maintenance_work_order_status_events',
        'maintenance_work_order_notes',
        'maintenance_work_order_media',
        'maintenance_work_order_materials',
        'maintenance_work_order_labor'
      ]
      loop
        execute format('revoke all on public.%I from %I', table_name, role_name);
      end loop;
    end if;
  end loop;
end
$revoke_data_api$;

create policy maintenance_work_orders_read
on public.maintenance_work_orders
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy maintenance_work_orders_insert
on public.maintenance_work_orders
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'maintenance.create')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_orders_update
on public.maintenance_work_orders
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
)
with check (
  (
    icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  )
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_order_status_events_read
on public.maintenance_work_order_status_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy maintenance_work_order_notes_read
on public.maintenance_work_order_notes
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy maintenance_work_order_notes_insert
on public.maintenance_work_order_notes
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  )
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_order_media_read
on public.maintenance_work_order_media
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy maintenance_work_order_media_insert
on public.maintenance_work_order_media
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  )
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_order_materials_read
on public.maintenance_work_order_materials
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy maintenance_work_order_materials_insert
on public.maintenance_work_order_materials
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  )
  and recorded_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy maintenance_work_order_labor_read
on public.maintenance_work_order_labor
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.create')
  or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
);

create policy maintenance_work_order_labor_insert
on public.maintenance_work_order_labor
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  )
  and recorded_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on table public.maintenance_work_orders is
  'Build 065 canonical campground maintenance work orders reusing Build 064 category and priority authorities.';
comment on table public.maintenance_work_order_status_events is
  'Build 065 append-only maintenance work-order status transition evidence.';
comment on table public.maintenance_work_order_notes is
  'Build 065 append-only maintenance work-order notes.';
comment on table public.maintenance_work_order_media is
  'Build 065 links maintenance work orders to validated Build 008 secure-media assets without duplicating storage.';
comment on table public.maintenance_work_order_materials is
  'Build 065 append-only material usage evidence for maintenance work orders.';
comment on table public.maintenance_work_order_labor is
  'Build 065 append-only labour evidence for maintenance work orders.';
