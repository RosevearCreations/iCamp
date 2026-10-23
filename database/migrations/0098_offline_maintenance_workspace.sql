-- iCamp Build 076
-- Offline Maintenance Workspace.
--
-- Canonical maintenance work orders remain owned by Build 065 and inspection
-- execution remains owned by Build 068. This build adds only a durable,
-- idempotent sync receipt plus a narrowly scoped internal-media upload
-- authority for queued maintenance evidence.

insert into icamp_private.permission_catalog (
  permission_key,
  description,
  risk_level
)
values (
  'maintenance.offline.media',
  'Upload validated internal media from the offline maintenance evidence queue.',
  'standard'
)
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join (
  values
    ('maintenance', 'maintenance.offline.media'),
    ('maintenance_lead', 'maintenance.offline.media'),
    ('maintenance_foreman', 'maintenance.offline.media'),
    ('maintenance_main_foreman', 'maintenance.offline.media'),
    ('campground_manager', 'maintenance.offline.media'),
    ('owner_admin', 'maintenance.offline.media')
) as grants(role_code, permission_key)
  on r.role_code = grants.role_code
 and r.role_kind = 'template'
join icamp_private.permission_catalog p
  on p.permission_key = grants.permission_key
on conflict do nothing;

create table public.maintenance_offline_sync_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  client_operation_id uuid not null,
  operation_kind text not null
    check (
      operation_kind in (
        'work_order_note',
        'inspection_result',
        'work_order_media'
      )
    ),
  target_id uuid not null,
  payload_fingerprint text not null
    check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  result_entity_id uuid,
  applied_at timestamptz not null default statement_timestamp(),
  constraint maintenance_offline_sync_receipts_scope_client_unique
    unique (actor_user_id, campground_id, client_operation_id),
  constraint maintenance_offline_sync_receipts_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create index maintenance_offline_sync_receipts_scope_campground_fk_idx
  on public.maintenance_offline_sync_receipts(
    organization_id,
    campground_id
  );

create index maintenance_offline_sync_receipts_actor_fk_idx
  on public.maintenance_offline_sync_receipts(actor_user_id);

create index maintenance_offline_sync_receipts_target_idx
  on public.maintenance_offline_sync_receipts(
    campground_id,
    operation_kind,
    target_id,
    applied_at desc
  );

alter table public.maintenance_offline_sync_receipts enable row level security;
alter table public.maintenance_offline_sync_receipts force row level security;

revoke all on public.maintenance_offline_sync_receipts from public;
grant select,insert on public.maintenance_offline_sync_receipts to icamp_app;

do $revoke_data_api$
declare
  role_name text;
begin
  foreach role_name in array array['anon','authenticated']
  loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format(
        'revoke all on public.maintenance_offline_sync_receipts from %I',
        role_name
      );
    end if;
  end loop;
end
$revoke_data_api$;

create policy maintenance_offline_sync_receipts_read
on public.maintenance_offline_sync_receipts
for select
to icamp_app
using (
  actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (
    icamp_private.has_campground_permission(campground_id,'maintenance.read')
    or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    or icamp_private.has_campground_permission(campground_id,'inspection.perform')
    or icamp_private.has_campground_permission(campground_id,'maintenance.offline.media')
  )
);

create policy maintenance_offline_sync_receipts_insert
on public.maintenance_offline_sync_receipts
for insert
to icamp_app
with check (
  actor_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
  and (
    (
      operation_kind='work_order_note'
      and (
        icamp_private.has_campground_permission(campground_id,'maintenance.create')
        or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
        or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
      )
    )
    or
    (
      operation_kind='inspection_result'
      and icamp_private.has_campground_permission(
        campground_id,
        'inspection.perform'
      )
    )
    or
    (
      operation_kind='work_order_media'
      and icamp_private.has_campground_permission(
        campground_id,
        'maintenance.offline.media'
      )
    )
  )
);

comment on table public.maintenance_offline_sync_receipts is
  'Build 076 append-only idempotency receipts for canonical offline maintenance sync operations; queue payloads remain device-local.';
