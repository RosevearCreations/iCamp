-- iCamp Build 031
-- Management Closures, Holds & Map Publication.

insert into icamp_private.permission_catalog (permission_key, description, risk_level)
values ('campground.operations.manage', 'Campground Operations Manage', 'elevated')
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, 'campground.operations.manage'
from icamp_private.roles r
where r.organization_id is null
  and r.role_code in ('campground_manager', 'owner_admin')
on conflict (role_id, permission_key) do nothing;

create table public.management_restrictions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  target_kind text not null
    check (target_kind in ('accommodation', 'asset', 'section')),
  accommodation_id uuid,
  asset_id uuid,
  section_id uuid,
  restriction_kind text not null
    check (restriction_kind in ('closure', 'hold')),
  starts_on date not null,
  ends_on date not null,
  reason text not null
    check (char_length(trim(reason)) between 8 and 500),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  is_override boolean not null default false,
  supersedes_restriction_id uuid
    references public.management_restrictions(id)
    on update cascade
    on delete restrict,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  cancelled_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  cancelled_at timestamptz,
  cancellation_reason text
    check (
      cancellation_reason is null
      or char_length(trim(cancellation_reason)) between 8 and 500
    ),
  row_version bigint not null default 1
    check (row_version >= 1),
  constraint management_restrictions_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint management_restrictions_accommodation_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint management_restrictions_asset_fk
    foreign key (organization_id, campground_id, asset_id)
    references public.operational_assets(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint management_restrictions_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint management_restrictions_dates_check
    check (ends_on >= starts_on),
  constraint management_restrictions_target_shape_check
    check (
      (
        target_kind = 'accommodation'
        and accommodation_id is not null
        and asset_id is null
        and section_id is null
      )
      or
      (
        target_kind = 'asset'
        and accommodation_id is null
        and asset_id is not null
        and section_id is null
      )
      or
      (
        target_kind = 'section'
        and accommodation_id is null
        and asset_id is null
        and section_id is not null
      )
    ),
  constraint management_restrictions_cancel_shape_check
    check (
      (
        cancelled_at is null
        and cancelled_by_user_id is null
        and cancellation_reason is null
      )
      or
      (
        cancelled_at is not null
        and cancelled_by_user_id is not null
        and cancellation_reason is not null
      )
    ),
  constraint management_restrictions_override_shape_check
    check (
      (not is_override and supersedes_restriction_id is null)
      or
      (is_override and supersedes_restriction_id is not null)
    )
);

create index management_restrictions_scope_dates_idx
  on public.management_restrictions (
    organization_id,
    campground_id,
    starts_on,
    ends_on
  )
  where cancelled_at is null;

create index management_restrictions_accommodation_idx
  on public.management_restrictions (
    campground_id,
    accommodation_id,
    starts_on,
    ends_on
  )
  where accommodation_id is not null and cancelled_at is null;

create index management_restrictions_asset_idx
  on public.management_restrictions (
    campground_id,
    asset_id,
    starts_on,
    ends_on
  )
  where asset_id is not null and cancelled_at is null;

create index management_restrictions_section_idx
  on public.management_restrictions (
    campground_id,
    section_id,
    starts_on,
    ends_on
  )
  where section_id is not null and cancelled_at is null;

create index management_restrictions_batch_idx
  on public.management_restrictions (batch_id, created_at);

create index management_restrictions_created_by_idx
  on public.management_restrictions (created_by_user_id, created_at desc)
  where created_by_user_id is not null;

create index management_restrictions_cancelled_by_idx
  on public.management_restrictions (cancelled_by_user_id, cancelled_at desc)
  where cancelled_by_user_id is not null;

create or replace function icamp_private.guard_management_restriction_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.cancelled_at is not null then
    raise exception 'Cancelled management restrictions are immutable';
  end if;

  if old.batch_id is distinct from new.batch_id
    or old.organization_id is distinct from new.organization_id
    or old.campground_id is distinct from new.campground_id
    or old.target_kind is distinct from new.target_kind
    or old.accommodation_id is distinct from new.accommodation_id
    or old.asset_id is distinct from new.asset_id
    or old.section_id is distinct from new.section_id
    or old.restriction_kind is distinct from new.restriction_kind
    or old.starts_on is distinct from new.starts_on
    or old.ends_on is distinct from new.ends_on
    or old.reason is distinct from new.reason
    or old.notes is distinct from new.notes
    or old.is_override is distinct from new.is_override
    or old.supersedes_restriction_id is distinct from new.supersedes_restriction_id
    or old.created_by_user_id is distinct from new.created_by_user_id then
    raise exception 'Management restrictions cannot be rewritten; cancel and recreate them';
  end if;

  if new.cancelled_at is null
    or new.cancelled_by_user_id is null
    or new.cancellation_reason is null then
    raise exception 'Management restriction updates must be an auditable cancellation';
  end if;

  return new;
end;
$$;

create or replace function icamp_private.prevent_management_restriction_overlap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_key text;
  superseded record;
begin
  target_key := case new.target_kind
    when 'accommodation' then new.accommodation_id::text
    when 'asset' then new.asset_id::text
    when 'section' then new.section_id::text
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'icamp-management-restriction:' || new.target_kind || ':' || target_key,
      0
    )
  );

  if new.supersedes_restriction_id is not null then
    select *
    into superseded
    from public.management_restrictions
    where id = new.supersedes_restriction_id;

    if not found
      or superseded.campground_id <> new.campground_id
      or superseded.target_kind <> new.target_kind
      or superseded.accommodation_id is distinct from new.accommodation_id
      or superseded.asset_id is distinct from new.asset_id
      or superseded.section_id is distinct from new.section_id
      or superseded.cancelled_at is null then
      raise exception 'Superseded restriction must be a cancelled restriction on the same target';
    end if;
  end if;

  if new.cancelled_at is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.management_restrictions existing
    where existing.id <> new.id
      and existing.campground_id = new.campground_id
      and existing.cancelled_at is null
      and existing.target_kind = new.target_kind
      and existing.accommodation_id is not distinct from new.accommodation_id
      and existing.asset_id is not distinct from new.asset_id
      and existing.section_id is not distinct from new.section_id
      and daterange(existing.starts_on, existing.ends_on + 1, '[)')
          && daterange(new.starts_on, new.ends_on + 1, '[)')
  ) then
    raise exception 'Management restriction overlaps an existing active restriction';
  end if;

  return new;
end;
$$;

create trigger management_restrictions_guard_mutation
before update on public.management_restrictions
for each row execute function icamp_private.guard_management_restriction_mutation();

create trigger management_restrictions_no_overlap
before insert or update of starts_on, ends_on, accommodation_id, asset_id, section_id, cancelled_at
on public.management_restrictions
for each row execute function icamp_private.prevent_management_restriction_overlap();

create trigger management_restrictions_touch_row
before update on public.management_restrictions
for each row execute function icamp_private.touch_row();

alter table public.management_restrictions enable row level security;
alter table public.management_restrictions force row level security;

revoke all on public.management_restrictions from public;

do $build031_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.management_restrictions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.management_restrictions from authenticated';
  end if;
end
$build031_permissions$;

grant select, insert, update on public.management_restrictions to icamp_app;

create policy management_restrictions_read
on public.management_restrictions
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

create policy management_restrictions_insert
on public.management_restrictions
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
  and created_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy management_restrictions_cancel
on public.management_restrictions
for update
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
)
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
  and cancelled_by_user_id =
    nullif((select current_setting('icamp.user_id', true)), '')::uuid
);

create policy accommodations_management_operations_read
on public.accommodations
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

create policy operational_assets_management_operations_read
on public.operational_assets
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

create policy campground_sections_management_operations_read
on public.campground_sections
for select
to icamp_app
using (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

create table icamp_private.campground_map_publication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  publication_revision bigint not null
    check (publication_revision >= 1),
  from_map_version_id uuid,
  to_map_version_id uuid not null,
  actor_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  reason text not null
    check (char_length(trim(reason)) between 8 and 500),
  override_used boolean not null default false,
  readiness jsonb not null default '{}'::jsonb
    check (jsonb_typeof(readiness) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint campground_map_publication_events_scope_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_map_publication_events_from_fk
    foreign key (organization_id, campground_id, from_map_version_id)
    references icamp_private.campground_map_image_versions(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint campground_map_publication_events_to_fk
    foreign key (organization_id, campground_id, to_map_version_id)
    references icamp_private.campground_map_image_versions(
      organization_id,
      campground_id,
      id
    )
    on update cascade
    on delete restrict,
  constraint campground_map_publication_events_revision_unique
    unique (campground_id, publication_revision)
);

create index campground_map_publication_events_scope_time_idx
  on icamp_private.campground_map_publication_events (
    organization_id,
    campground_id,
    occurred_at desc
  );

create index campground_map_publication_events_actor_idx
  on icamp_private.campground_map_publication_events (
    actor_user_id,
    occurred_at desc
  )
  where actor_user_id is not null;

revoke all on icamp_private.campground_map_publication_events from public;

do $build031_private_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.campground_map_publication_events from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.campground_map_publication_events from authenticated';
  end if;
end
$build031_private_permissions$;

comment on table public.management_restrictions is
  'Build 031 dated management closures and holds. Rows are immutable after creation except for auditable cancellation; overlapping active restrictions require an explicit superseding override.';
comment on column public.management_restrictions.starts_on is
  'First campground operating date affected by this all-day management restriction.';
comment on column public.management_restrictions.ends_on is
  'Last campground operating date affected by this all-day management restriction.';
comment on table icamp_private.campground_map_publication_events is
  'Build 031 immutable evidence for each safe published-map switch, including readiness counts and explicit override use.';
