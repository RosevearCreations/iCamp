-- Build 008 secure media/document storage schema verification.
\set ON_ERROR_STOP on

do $$
declare
  lifecycle_trigger_count integer;
begin
  if to_regclass('icamp_private.media_assets') is null then
    raise exception 'Missing icamp_private.media_assets';
  end if;

  if to_regclass('icamp_private.media_lifecycle_events') is null then
    raise exception 'Missing icamp_private.media_lifecycle_events';
  end if;

  if to_regclass('icamp_private.media_assets_scope_class_state_idx') is null then
    raise exception 'Missing media scope/class/state index';
  end if;

  if to_regclass('icamp_private.media_lifecycle_events_asset_time_idx') is null then
    raise exception 'Missing media lifecycle asset/time index';
  end if;

  if not exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key = 'media.read'
  ) then
    raise exception 'Missing media.read permission';
  end if;

  if not exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key = 'media.manage'
  ) then
    raise exception 'Missing media.manage permission';
  end if;

  if not exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key = 'media.confidential.read'
  ) then
    raise exception 'Missing media.confidential.read permission';
  end if;

  if not exists (
    select 1
    from icamp_private.roles r
    join icamp_private.role_permissions rp on rp.role_id = r.id
    where r.role_kind = 'template'
      and r.role_code = 'owner_admin'
      and rp.permission_key = 'media.manage'
  ) then
    raise exception 'owner_admin must receive media.manage';
  end if;

  select count(*)
    into lifecycle_trigger_count
  from pg_trigger
  where tgrelid = 'icamp_private.media_lifecycle_events'::regclass
    and tgname = 'media_lifecycle_events_append_only'
    and not tgisinternal;

  if lifecycle_trigger_count <> 1 then
    raise exception 'Media lifecycle append-only trigger is missing';
  end if;

  if has_schema_privilege('public', 'icamp_private', 'USAGE') then
    raise exception 'PUBLIC must not have USAGE on icamp_private';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege('anon', 'icamp_private.media_assets', 'SELECT') then
      raise exception 'anon must not read private media metadata';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    if has_table_privilege('authenticated', 'icamp_private.media_assets', 'SELECT') then
      raise exception 'authenticated must not read private media metadata directly';
    end if;
  end if;
end
$$;

begin;

insert into public.organizations (name, slug)
values ('Build 008 Verify Org', 'build-008-verify-org')
returning id as media_verify_org
\gset

insert into public.campgrounds (
  organization_id,
  name,
  slug,
  timezone
)
values (
  :'media_verify_org',
  'Build 008 Verify Camp',
  'build-008-verify-camp',
  'America/Toronto'
)
returning id as media_verify_camp
\gset

insert into icamp_private.user_accounts (
  email_normalized,
  account_type
)
values ('build008-verify@example.test', 'staff')
returning id as media_verify_user
\gset

insert into icamp_private.media_assets (
  organization_id,
  campground_id,
  classification,
  media_kind,
  storage_provider,
  bucket_key,
  object_key,
  original_filename,
  content_type,
  byte_size,
  checksum_sha256,
  validation_state,
  created_by_user_id
)
values (
  :'media_verify_org',
  :'media_verify_camp',
  'internal',
  'image',
  'supabase',
  'icamp-internal-media',
  'verify/asset.png',
  'asset.png',
  'image/png',
  8,
  repeat('a', 64),
  'validated',
  :'media_verify_user'
)
returning id as media_verify_asset
\gset

update icamp_private.media_assets
set lifecycle_state = 'active'
where id = :'media_verify_asset';

insert into icamp_private.media_lifecycle_events (
  media_asset_id,
  event_type,
  from_state,
  to_state,
  actor_user_id,
  reason
)
values (
  :'media_verify_asset',
  'activated',
  'pending',
  'active',
  :'media_verify_user',
  'Build 008 schema verification activation.'
);

savepoint media_event_mutation_check;

\set ON_ERROR_STOP off
update icamp_private.media_lifecycle_events
set reason = 'Mutation must fail.'
where media_asset_id = :'media_verify_asset';
\set media_event_mutation_sqlstate :SQLSTATE
\set ON_ERROR_STOP on

rollback to savepoint media_event_mutation_check;

select (:'media_event_mutation_sqlstate' = '55000') as media_append_only_ok
\gset

\if :media_append_only_ok
\else
  \quit 1
\endif

rollback;
