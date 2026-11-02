-- iCamp Build 076 verification.
do $verify$
begin
  if to_regclass('public.maintenance_offline_sync_receipts') is null then
    raise exception 'Build 076 sync receipt table is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='maintenance_offline_sync_receipts'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'Build 076 sync receipts must enable and FORCE RLS';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.maintenance_offline_sync_receipts',
    'UPDATE'
  ) or has_table_privilege(
    'icamp_app',
    'public.maintenance_offline_sync_receipts',
    'DELETE'
  ) then
    raise exception 'Build 076 sync receipts must remain append-only';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname='maintenance_offline_sync_receipts_scope_client_unique'
  ) then
    raise exception 'Build 076 client operation idempotency constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='maintenance_offline_sync_receipts_scope_campground_fk_idx'
  ) then
    raise exception 'Build 076 campground FK covering index is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='maintenance_offline_sync_receipts_actor_fk_idx'
  ) then
    raise exception 'Build 076 actor FK covering index is missing';
  end if;

  if not exists (
    select 1
    from icamp_private.permission_catalog
    where permission_key='maintenance.offline.media'
  ) then
    raise exception 'Build 076 restricted offline media permission is missing';
  end if;

  if exists (select 1 from pg_roles where rolname='anon')
     and has_table_privilege(
       'anon',
       'public.maintenance_offline_sync_receipts',
       'SELECT'
     ) then
    raise exception 'anon direct Build 076 receipt access must remain denied';
  end if;

  if exists (select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege(
       'authenticated',
       'public.maintenance_offline_sync_receipts',
       'SELECT'
     ) then
    raise exception 'authenticated direct Build 076 receipt access must remain denied';
  end if;
end
$verify$;
