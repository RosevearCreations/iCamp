-- iCamp Build 024
-- Unified Accommodation Model.

alter table public.campground_subsections
  add constraint campground_subsections_scope_section_id_unique
    unique (organization_id, campground_id, section_id, id);

alter table icamp_private.campground_map_objects
  drop constraint if exists campground_map_objects_object_kind_check;

alter table icamp_private.campground_map_objects
  add constraint campground_map_objects_object_kind_check
  check (
    object_kind in (
      'site',
      'cottage',
      'permanent_unit',
      'pool',
      'washroom',
      'gate',
      'dock',
      'road',
      'building',
      'asset'
    )
  );

create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  section_id uuid not null,
  subsection_id uuid,
  map_object_id uuid not null,
  accommodation_kind text not null
    check (
      accommodation_kind in (
        'campsite',
        'rental_cottage',
        'permanent_unit'
      )
    ),
  code text not null
    check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 160),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  availability_revision bigint not null default 1
    check (availability_revision >= 1),
  status_revision bigint not null default 1
    check (status_revision >= 1),
  archived_at timestamptz,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint accommodations_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint accommodations_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint accommodations_subsection_fk
    foreign key (
      organization_id,
      campground_id,
      section_id,
      subsection_id
    )
    references public.campground_subsections(
      organization_id,
      campground_id,
      section_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint accommodations_map_object_fk
    foreign key (organization_id, campground_id, map_object_id)
    references icamp_private.campground_map_objects(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint accommodations_scope_code_unique
    unique (campground_id, code),
  constraint accommodations_map_object_unique
    unique (map_object_id),
  constraint accommodations_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint accommodations_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create table public.campsites (
  accommodation_id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint campsites_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.rental_cottages (
  accommodation_id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint rental_cottages_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create table public.permanent_units (
  accommodation_id uuid primary key,
  organization_id uuid not null,
  campground_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint permanent_units_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict
);

create or replace function icamp_private.validate_accommodation_map_object()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  object_row record;
  expected_kind text;
begin
  expected_kind := case new.accommodation_kind
    when 'campsite' then 'site'
    when 'rental_cottage' then 'cottage'
    when 'permanent_unit' then 'permanent_unit'
  end;

  select
    object_kind,
    section_id,
    lifecycle_state
  into object_row
  from icamp_private.campground_map_objects
  where id = new.map_object_id
    and organization_id = new.organization_id
    and campground_id = new.campground_id;

  if not found then
    raise exception 'Accommodation map object is unavailable or outside the campground';
  end if;

  if object_row.object_kind <> expected_kind then
    raise exception 'Accommodation subtype does not match canonical map object kind';
  end if;

  if object_row.section_id is distinct from new.section_id then
    raise exception 'Accommodation section must match its canonical map object section';
  end if;

  if object_row.lifecycle_state = 'archived' and new.lifecycle_state <> 'archived' then
    raise exception 'Active accommodation cannot use an archived map object';
  end if;

  return new;
end;
$$;

create trigger accommodations_validate_map_object
before insert or update of
  organization_id,
  campground_id,
  section_id,
  map_object_id,
  accommodation_kind,
  lifecycle_state
on public.accommodations
for each row execute function icamp_private.validate_accommodation_map_object();

create or replace function icamp_private.validate_accommodation_subtype()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_kind text;
  expected_kind text;
begin
  expected_kind := case tg_table_name
    when 'campsites' then 'campsite'
    when 'rental_cottages' then 'rental_cottage'
    when 'permanent_units' then 'permanent_unit'
  end;

  select accommodation_kind
  into parent_kind
  from public.accommodations
  where id = new.accommodation_id
    and organization_id = new.organization_id
    and campground_id = new.campground_id;

  if parent_kind is null then
    raise exception 'Accommodation subtype parent is unavailable';
  end if;

  if parent_kind <> expected_kind then
    raise exception 'Accommodation subtype table does not match parent kind';
  end if;

  return new;
end;
$$;

create trigger campsites_validate_parent
before insert or update on public.campsites
for each row execute function icamp_private.validate_accommodation_subtype();

create trigger rental_cottages_validate_parent
before insert or update on public.rental_cottages
for each row execute function icamp_private.validate_accommodation_subtype();

create trigger permanent_units_validate_parent
before insert or update on public.permanent_units
for each row execute function icamp_private.validate_accommodation_subtype();

create or replace function icamp_private.enforce_accommodation_subtype_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_id uuid;
  parent_kind text;
  campsite_count integer;
  cottage_count integer;
  permanent_count integer;
begin
  target_id := case when tg_op = 'DELETE' then old.accommodation_id else coalesce(new.id, new.accommodation_id) end;

  select accommodation_kind
  into parent_kind
  from public.accommodations
  where id = target_id;

  if parent_kind is null then
    return null;
  end if;

  select count(*) into campsite_count
  from public.campsites
  where accommodation_id = target_id;

  select count(*) into cottage_count
  from public.rental_cottages
  where accommodation_id = target_id;

  select count(*) into permanent_count
  from public.permanent_units
  where accommodation_id = target_id;

  if campsite_count + cottage_count + permanent_count <> 1 then
    raise exception 'Accommodation must have exactly one subtype row';
  end if;

  if (parent_kind = 'campsite' and campsite_count <> 1)
    or (parent_kind = 'rental_cottage' and cottage_count <> 1)
    or (parent_kind = 'permanent_unit' and permanent_count <> 1) then
    raise exception 'Accommodation subtype row does not match parent kind';
  end if;

  return null;
end;
$$;

create constraint trigger accommodations_require_subtype
after insert or update of accommodation_kind on public.accommodations
deferrable initially deferred
for each row execute function icamp_private.enforce_accommodation_subtype_link();

create constraint trigger campsites_keep_subtype
after insert or update or delete on public.campsites
deferrable initially deferred
for each row execute function icamp_private.enforce_accommodation_subtype_link();

create constraint trigger rental_cottages_keep_subtype
after insert or update or delete on public.rental_cottages
deferrable initially deferred
for each row execute function icamp_private.enforce_accommodation_subtype_link();

create constraint trigger permanent_units_keep_subtype
after insert or update or delete on public.permanent_units
deferrable initially deferred
for each row execute function icamp_private.enforce_accommodation_subtype_link();

create trigger accommodations_touch_row
before update on public.accommodations
for each row execute function icamp_private.touch_row();

create index accommodations_scope_idx
  on public.accommodations (
    organization_id,
    campground_id,
    lifecycle_state,
    accommodation_kind,
    code
  );

create index accommodations_section_idx
  on public.accommodations (
    organization_id,
    campground_id,
    section_id
  );

create index accommodations_subsection_idx
  on public.accommodations (
    organization_id,
    campground_id,
    section_id,
    subsection_id
  )
  where subsection_id is not null;

create index accommodations_map_object_idx
  on public.accommodations (
    organization_id,
    campground_id,
    map_object_id
  );

create index accommodations_created_by_idx
  on public.accommodations (created_by_user_id)
  where created_by_user_id is not null;

create index accommodations_updated_by_idx
  on public.accommodations (updated_by_user_id)
  where updated_by_user_id is not null;

create index campsites_scope_idx
  on public.campsites (organization_id, campground_id, accommodation_id);

create index rental_cottages_scope_idx
  on public.rental_cottages (organization_id, campground_id, accommodation_id);

create index permanent_units_scope_idx
  on public.permanent_units (organization_id, campground_id, accommodation_id);

alter table public.accommodations enable row level security;
alter table public.campsites enable row level security;
alter table public.rental_cottages enable row level security;
alter table public.permanent_units enable row level security;

alter table public.accommodations force row level security;
alter table public.campsites force row level security;
alter table public.rental_cottages force row level security;
alter table public.permanent_units force row level security;

revoke all on public.accommodations from public;
revoke all on public.campsites from public;
revoke all on public.rental_cottages from public;
revoke all on public.permanent_units from public;

do $build024_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.accommodations from anon';
    execute 'revoke all on public.campsites from anon';
    execute 'revoke all on public.rental_cottages from anon';
    execute 'revoke all on public.permanent_units from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.accommodations from authenticated';
    execute 'revoke all on public.campsites from authenticated';
    execute 'revoke all on public.rental_cottages from authenticated';
    execute 'revoke all on public.permanent_units from authenticated';
  end if;
end
$build024_permissions$;

grant select, insert, update on public.accommodations to icamp_app;
grant select, insert, update on public.campsites to icamp_app;
grant select, insert, update on public.rental_cottages to icamp_app;
grant select, insert, update on public.permanent_units to icamp_app;
grant select on icamp_private.campground_map_objects to icamp_app;

create policy accommodations_read
on public.accommodations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy accommodations_manage_insert
on public.accommodations
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy accommodations_manage_update
on public.accommodations
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy campsites_read
on public.campsites
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy campsites_manage_insert
on public.campsites
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy campsites_manage_update
on public.campsites
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy rental_cottages_read
on public.rental_cottages
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy rental_cottages_manage_insert
on public.rental_cottages
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy rental_cottages_manage_update
on public.rental_cottages
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy permanent_units_read
on public.permanent_units
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy permanent_units_manage_insert
on public.permanent_units
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy permanent_units_manage_update
on public.permanent_units
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

comment on table public.accommodations is
  'Canonical shared accommodation parent for campsites, rental cottages and permanent units. Builds 025-030 add subtype detail and status engines without changing this identity.';
comment on column public.accommodations.availability_revision is
  'Shared availability-hook revision. Build 024 exposes the stable hook; later availability engines increment or resolve it.';
comment on column public.accommodations.status_revision is
  'Shared status-hook revision. Build 024 exposes the stable hook; Build 030 owns detailed status states/history/transitions.';
comment on table public.campsites is
  'Campsite subtype linkage shell. Build 025 owns campsite type, utilities, dimensions and characteristics.';
comment on table public.rental_cottages is
  'Rental-cottage subtype linkage shell. Build 026 owns cottage occupancy, facilities, appliances and accessibility.';
comment on table public.permanent_units is
  'Permanent-unit subtype linkage shell. Later permanent ownership/transfer builds own ownership and financing detail.';
