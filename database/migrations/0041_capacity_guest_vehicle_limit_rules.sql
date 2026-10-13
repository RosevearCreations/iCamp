-- iCamp Build 033
-- Capacity, Guest & Vehicle Limit Rules.

create table public.capacity_limit_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  scope_kind text not null
    check (
      scope_kind in (
        'campground',
        'section',
        'accommodation_type',
        'accommodation'
      )
    ),
  section_id uuid,
  accommodation_kind text
    check (
      accommodation_kind is null
      or accommodation_kind in (
        'campsite',
        'rental_cottage',
        'permanent_unit'
      )
    ),
  accommodation_id uuid,
  minimum_site_area_m2 numeric(10,2)
    check (minimum_site_area_m2 is null or minimum_site_area_m2 > 0),
  maximum_site_area_m2 numeric(10,2)
    check (maximum_site_area_m2 is null or maximum_site_area_m2 > 0),
  max_occupants smallint
    check (max_occupants is null or max_occupants between 1 and 80),
  max_visitors smallint
    check (max_visitors is null or max_visitors between 0 and 80),
  max_vehicles smallint
    check (max_vehicles is null or max_vehicles between 0 and 20),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
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
  constraint capacity_limit_rules_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint capacity_limit_rules_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint capacity_limit_rules_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint capacity_limit_rules_scope_shape_check
    check (
      (
        scope_kind = 'campground'
        and section_id is null
        and accommodation_kind is null
        and accommodation_id is null
      )
      or
      (
        scope_kind = 'section'
        and section_id is not null
        and accommodation_kind is null
        and accommodation_id is null
      )
      or
      (
        scope_kind = 'accommodation_type'
        and section_id is null
        and accommodation_kind is not null
        and accommodation_id is null
      )
      or
      (
        scope_kind = 'accommodation'
        and section_id is null
        and accommodation_kind is null
        and accommodation_id is not null
      )
    ),
  constraint capacity_limit_rules_has_limit_check
    check (
      max_occupants is not null
      or max_visitors is not null
      or max_vehicles is not null
    ),
  constraint capacity_limit_rules_site_area_window_check
    check (
      minimum_site_area_m2 is null
      or maximum_site_area_m2 is null
      or maximum_site_area_m2 >= minimum_site_area_m2
    ),
  constraint capacity_limit_rules_archive_shape_check
    check (
      (is_active and archived_at is null)
      or
      (not is_active and archived_at is not null)
    )
);

create index capacity_limit_rules_scope_idx
  on public.capacity_limit_rules (
    organization_id,
    campground_id,
    is_active,
    scope_kind
  );

create index capacity_limit_rules_section_fk_idx
  on public.capacity_limit_rules (
    organization_id,
    campground_id,
    section_id
  )
  where section_id is not null;

create index capacity_limit_rules_accommodation_fk_idx
  on public.capacity_limit_rules (
    organization_id,
    campground_id,
    accommodation_id
  )
  where accommodation_id is not null;

create index capacity_limit_rules_type_idx
  on public.capacity_limit_rules (
    organization_id,
    campground_id,
    accommodation_kind,
    is_active
  )
  where accommodation_kind is not null;

create index capacity_limit_rules_created_by_fk_idx
  on public.capacity_limit_rules (created_by_user_id)
  where created_by_user_id is not null;

create index capacity_limit_rules_updated_by_fk_idx
  on public.capacity_limit_rules (updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function icamp_private.guard_capacity_limit_rule_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.scope_kind is distinct from new.scope_kind
    or old.section_id is distinct from new.section_id
    or old.accommodation_kind is distinct from new.accommodation_kind
    or old.accommodation_id is distinct from new.accommodation_id
    or old.minimum_site_area_m2 is distinct from new.minimum_site_area_m2
    or old.maximum_site_area_m2 is distinct from new.maximum_site_area_m2
    or old.max_occupants is distinct from new.max_occupants
    or old.max_visitors is distinct from new.max_visitors
    or old.max_vehicles is distinct from new.max_vehicles
    or old.notes is distinct from new.notes
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Capacity limit rules are append-preserved; archive and create a replacement instead';
  end if;

  if not old.is_active and new.is_active then
    raise exception 'Archived capacity limit rules cannot be reactivated';
  end if;

  if old.is_active and not new.is_active then
    if new.archived_at is null or new.updated_by_user_id is null then
      raise exception 'Archiving a capacity limit rule requires actor and timestamp evidence';
    end if;
  elsif old.is_active is distinct from new.is_active
    or old.archived_at is distinct from new.archived_at
  then
    raise exception 'Invalid capacity limit rule archive transition';
  end if;

  return new;
end;
$$;

create or replace function icamp_private.prevent_capacity_rule_ambiguity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  scope_lock text;
  new_has_area_band boolean;
begin
  if not new.is_active then
    return new;
  end if;

  scope_lock :=
    new.campground_id::text || ':' ||
    new.scope_kind || ':' ||
    coalesce(new.section_id::text, '-') || ':' ||
    coalesce(new.accommodation_kind, '-') || ':' ||
    coalesce(new.accommodation_id::text, '-');

  perform pg_advisory_xact_lock(
    hashtextextended('icamp-capacity-rule:' || scope_lock, 0)
  );

  new_has_area_band :=
    new.minimum_site_area_m2 is not null
    or new.maximum_site_area_m2 is not null;

  if not new_has_area_band then
    if exists (
      select 1
      from public.capacity_limit_rules existing
      where existing.campground_id = new.campground_id
        and existing.scope_kind = new.scope_kind
        and existing.section_id is not distinct from new.section_id
        and existing.accommodation_kind is not distinct from new.accommodation_kind
        and existing.accommodation_id is not distinct from new.accommodation_id
        and existing.is_active
        and existing.minimum_site_area_m2 is null
        and existing.maximum_site_area_m2 is null
    ) then
      raise exception 'Only one active default capacity rule is allowed for the same scope';
    end if;

    return new;
  end if;

  if exists (
    select 1
    from public.capacity_limit_rules existing
    where existing.campground_id = new.campground_id
      and existing.scope_kind = new.scope_kind
      and existing.section_id is not distinct from new.section_id
      and existing.accommodation_kind is not distinct from new.accommodation_kind
      and existing.accommodation_id is not distinct from new.accommodation_id
      and existing.is_active
      and (
        existing.minimum_site_area_m2 is not null
        or existing.maximum_site_area_m2 is not null
      )
      and coalesce(existing.maximum_site_area_m2, 1000000000)
          >= coalesce(new.minimum_site_area_m2, 0)
      and coalesce(new.maximum_site_area_m2, 1000000000)
          >= coalesce(existing.minimum_site_area_m2, 0)
  ) then
    raise exception 'Active capacity size bands cannot overlap within the same scope';
  end if;

  return new;
end;
$$;

create trigger capacity_limit_rules_guard_mutation
before update on public.capacity_limit_rules
for each row execute function icamp_private.guard_capacity_limit_rule_mutation();

create trigger capacity_limit_rules_no_ambiguity
before insert on public.capacity_limit_rules
for each row execute function icamp_private.prevent_capacity_rule_ambiguity();

create trigger capacity_limit_rules_touch_row
before update on public.capacity_limit_rules
for each row execute function icamp_private.touch_row();

alter table public.capacity_limit_rules enable row level security;
alter table public.capacity_limit_rules force row level security;

revoke all on public.capacity_limit_rules from public;

do $build033_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.capacity_limit_rules from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.capacity_limit_rules from authenticated';
  end if;
end
$build033_permissions$;

grant select, insert, update on public.capacity_limit_rules to icamp_app;

create policy capacity_limit_rules_read
on public.capacity_limit_rules
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id, 'reservation.read')
  or icamp_private.has_campground_permission(campground_id, 'reservation.create')
  or icamp_private.has_campground_permission(campground_id, 'reservation.modify')
  or icamp_private.has_campground_permission(campground_id, 'reservation.override')
);

create policy capacity_limit_rules_insert
on public.capacity_limit_rules
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy capacity_limit_rules_archive
on public.capacity_limit_rules
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'campground.configuration')
  and updated_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

comment on table public.capacity_limit_rules is
  'Build 033 append-preserved occupant, visitor and vehicle limits layered by campground, accommodation type, section, accommodation and optional campsite area bands.';

comment on column public.capacity_limit_rules.minimum_site_area_m2 is
  'Optional inclusive campsite-area lower bound. Size-banded rules are ignored when an accommodation has no measurable site area.';

comment on column public.capacity_limit_rules.maximum_site_area_m2 is
  'Optional inclusive campsite-area upper bound. Active size bands within one exact scope may not overlap.';
