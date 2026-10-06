-- iCamp Build 008
-- Secure media/document metadata, lifecycle and permission foundation.
-- Canonical domain schema remains provider-portable PostgreSQL.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values
  ('media.read', 'Read internal campground media', 'standard'),
  ('media.manage', 'Register and manage campground media', 'elevated'),
  ('media.confidential.read', 'Read confidential campground media', 'standard')
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, grants.permission_key
from icamp_private.roles r
join (
  values
    ('front_desk', 'media.read'),
    ('maintenance', 'media.read'),
    ('maintenance_lead', 'media.read'),
    ('security', 'media.read'),
    ('finance', 'media.read'),
    ('finance', 'media.confidential.read'),
    ('it_admin', 'media.read'),
    ('campground_manager', 'media.read'),
    ('campground_manager', 'media.manage'),
    ('campground_manager', 'media.confidential.read'),
    ('owner_admin', 'media.read'),
    ('owner_admin', 'media.manage'),
    ('owner_admin', 'media.confidential.read')
) as grants(role_code, permission_key)
  on grants.role_code = r.role_code
where r.role_kind = 'template'
on conflict do nothing;

create table icamp_private.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  classification text not null
    check (classification in ('public', 'internal', 'confidential')),
  media_kind text not null
    check (media_kind in ('image', 'document')),
  storage_provider text not null
    check (storage_provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  bucket_key text not null
    check (bucket_key ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
  object_key text not null
    check (
      char_length(object_key) between 1 and 1024
      and object_key !~ '[\\\\]'
      and object_key !~ '(^|/)\\.\\.?(/|$)'
      and object_key !~ '^/'
    ),
  original_filename text not null
    check (
      char_length(original_filename) between 1 and 240
      and original_filename !~ '[\\x00-\\x1F\\x7F]'
      and original_filename !~ '[/\\\\]'
    ),
  content_type text not null
    check (
      content_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf'
      )
    ),
  byte_size bigint not null
    check (
      (media_kind = 'image' and byte_size between 1 and 12582912)
      or
      (
        media_kind = 'document'
        and content_type = 'application/pdf'
        and byte_size between 1 and 26214400
      )
    ),
  checksum_sha256 text
    check (
      checksum_sha256 is null
      or checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
  validation_state text not null default 'pending'
    check (validation_state in ('pending', 'validated', 'rejected')),
  lifecycle_state text not null default 'pending'
    check (
      lifecycle_state in (
        'pending',
        'active',
        'quarantined',
        'archived',
        'deleted'
      )
    ),
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint media_assets_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint media_assets_storage_object_unique
    unique (storage_provider, bucket_key, object_key),
  constraint media_assets_active_validation_check
    check (
      lifecycle_state <> 'active'
      or validation_state = 'validated'
    ),
  constraint media_assets_archive_time_check
    check (
      lifecycle_state <> 'archived'
      or archived_at is not null
    ),
  constraint media_assets_delete_time_check
    check (
      lifecycle_state <> 'deleted'
      or deleted_at is not null
    )
);

create table icamp_private.media_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  event_type text not null
    check (
      event_type in (
        'registered',
        'activated',
        'quarantined',
        'archived',
        'restored',
        'deleted'
      )
    ),
  from_state text
    check (
      from_state is null
      or from_state in (
        'pending',
        'active',
        'quarantined',
        'archived',
        'deleted'
      )
    ),
  to_state text not null
    check (
      to_state in (
        'pending',
        'active',
        'quarantined',
        'archived',
        'deleted'
      )
    ),
  actor_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  reason text
    check (
      reason is null
      or char_length(trim(reason)) between 8 and 500
    ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp()
);

create index media_assets_scope_class_state_idx
  on icamp_private.media_assets (
    organization_id,
    campground_id,
    classification,
    lifecycle_state
  );

create index media_assets_created_by_idx
  on icamp_private.media_assets (
    created_by_user_id,
    created_at desc
  );

create index media_lifecycle_events_asset_time_idx
  on icamp_private.media_lifecycle_events (
    media_asset_id,
    occurred_at desc
  );

create index media_lifecycle_events_actor_time_idx
  on icamp_private.media_lifecycle_events (
    actor_user_id,
    occurred_at desc
  );

create or replace function icamp_private.validate_media_lifecycle_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.lifecycle_state = new.lifecycle_state then
    return new;
  end if;

  if old.lifecycle_state = 'deleted' then
    raise exception using
      errcode = '23514',
      message = 'Deleted media is terminal and cannot change lifecycle state';
  end if;

  if not (
    (old.lifecycle_state = 'pending'
      and new.lifecycle_state in ('active', 'quarantined', 'deleted'))
    or
    (old.lifecycle_state = 'active'
      and new.lifecycle_state in ('quarantined', 'archived', 'deleted'))
    or
    (old.lifecycle_state = 'quarantined'
      and new.lifecycle_state in ('active', 'archived', 'deleted'))
    or
    (old.lifecycle_state = 'archived'
      and new.lifecycle_state in ('active', 'deleted'))
  ) then
    raise exception using
      errcode = '23514',
      message = 'Unsupported media lifecycle transition';
  end if;

  if new.lifecycle_state = 'active' then
    if new.validation_state <> 'validated' then
      raise exception using
        errcode = '23514',
        message = 'Only validated media can become active';
    end if;

    new.activated_at = coalesce(new.activated_at, statement_timestamp());
    new.archived_at = null;
  elsif new.lifecycle_state = 'archived' then
    new.archived_at = statement_timestamp();
  elsif new.lifecycle_state = 'deleted' then
    new.deleted_at = statement_timestamp();
  end if;

  return new;
end;
$$;

create trigger media_assets_lifecycle_guard
before update of lifecycle_state on icamp_private.media_assets
for each row execute function icamp_private.validate_media_lifecycle_transition();

create trigger media_assets_touch_row
before update on icamp_private.media_assets
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.prevent_media_lifecycle_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Media lifecycle events are append-only and cannot be updated or deleted';
end;
$$;

create trigger media_lifecycle_events_append_only
before update or delete on icamp_private.media_lifecycle_events
for each row execute function icamp_private.prevent_media_lifecycle_event_mutation();

revoke all on icamp_private.media_assets from public;
revoke all on icamp_private.media_lifecycle_events from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.media_assets from anon';
    execute 'revoke all on icamp_private.media_lifecycle_events from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.media_assets from authenticated';
    execute 'revoke all on icamp_private.media_lifecycle_events from authenticated';
  end if;
end
$$;

comment on table icamp_private.media_assets is
  'Provider-neutral secure media metadata. Storage objects remain outside PostgreSQL; object identifiers stay private.';

comment on table icamp_private.media_lifecycle_events is
  'Append-only media lifecycle evidence. Never store object bytes, secrets, signed URLs, or sensitive document contents here.';
