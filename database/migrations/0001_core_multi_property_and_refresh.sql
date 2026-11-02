-- iCamp Build 003
-- Core multi-property and admin freshness foundation.
-- Provider-portable PostgreSQL 15+ SQL.

create schema if not exists icamp_private;
revoke all on schema icamp_private from public;

create or replace function icamp_private.touch_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();

  if tg_op = 'UPDATE' then
    new.row_version = old.row_version + 1;
  end if;

  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint organizations_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create table public.campgrounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'UTC'
    check (char_length(trim(timezone)) between 1 and 100),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campgrounds_org_slug_unique unique (organization_id, slug),
  constraint campgrounds_org_id_unique unique (organization_id, id),
  constraint campgrounds_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create table public.campground_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  code text not null
    check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  sort_order integer not null default 0,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_sections_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint campground_sections_scope_code_unique
    unique (organization_id, campground_id, code),
  constraint campground_sections_scope_id_unique
    unique (organization_id, campground_id, id),
  constraint campground_sections_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create table public.campground_subsections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  section_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  code text not null
    check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  sort_order integer not null default 0,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_subsections_section_fk
    foreign key (organization_id, campground_id, section_id)
    references public.campground_sections(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint campground_subsections_scope_code_unique
    unique (organization_id, campground_id, section_id, code),
  constraint campground_subsections_archive_state_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    )
);

create table public.admin_refresh_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid,
  section_key text not null
    check (section_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  source_key text not null default 'primary'
    check (source_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  refresh_status text not null default 'idle'
    check (
      refresh_status in ('idle', 'refreshing', 'fresh', 'stale', 'failed')
    ),
  last_requested_at timestamptz,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error_code text
    check (
      last_error_code is null
      or char_length(last_error_code) between 1 and 120
    ),
  source_watermark text
    check (
      source_watermark is null
      or char_length(source_watermark) between 1 and 255
    ),
  refreshed_through timestamptz,
  stale_after_seconds integer not null default 300
    check (stale_after_seconds between 15 and 604800),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint admin_refresh_states_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint admin_refresh_states_scope_unique
    unique nulls not distinct (
      organization_id,
      campground_id,
      section_key,
      source_key
    ),
  constraint admin_refresh_states_timeline_check
    check (
      last_started_at is null
      or last_requested_at is null
      or last_started_at >= last_requested_at
    )
);

create index campgrounds_organization_idx
  on public.campgrounds (organization_id);

create index campground_sections_scope_idx
  on public.campground_sections (organization_id, campground_id, sort_order);

create index campground_subsections_scope_idx
  on public.campground_subsections (
    organization_id,
    campground_id,
    section_id,
    sort_order
  );

create index admin_refresh_states_lookup_idx
  on public.admin_refresh_states (
    organization_id,
    campground_id,
    section_key,
    refresh_status
  );

create trigger organizations_touch_row
before update on public.organizations
for each row execute function icamp_private.touch_row();

create trigger campgrounds_touch_row
before update on public.campgrounds
for each row execute function icamp_private.touch_row();

create trigger campground_sections_touch_row
before update on public.campground_sections
for each row execute function icamp_private.touch_row();

create trigger campground_subsections_touch_row
before update on public.campground_subsections
for each row execute function icamp_private.touch_row();

create trigger admin_refresh_states_touch_row
before update on public.admin_refresh_states
for each row execute function icamp_private.touch_row();

alter table public.organizations enable row level security;
alter table public.campgrounds enable row level security;
alter table public.campground_sections enable row level security;
alter table public.campground_subsections enable row level security;
alter table public.admin_refresh_states enable row level security;

comment on table public.organizations is
  'Top-level tenant/owner boundary for iCamp.';

comment on table public.campgrounds is
  'Campground/property records owned by an organization.';

comment on table public.campground_sections is
  'First-level operational/booking subdivisions within a campground.';

comment on table public.campground_subsections is
  'Optional second-level subdivisions within a campground section.';

comment on table public.admin_refresh_states is
  'Metadata-only admin data freshness/refresh tracking; never store sensitive payloads here.';
