-- Build 189: append-only, actor-scoped offline conflict evidence and reviewed replay.
-- No offline work-order completion, inspection sign-off or external dispatch.
create table public.maintenance_offline_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
  client_operation_id uuid not null,
  operation_kind text not null check (operation_kind in ('work_order_note','inspection_result','work_order_media')),
  target_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code in ('stale_version','assignment_changed','finalized','result_changed','operation_reused')),
  detected_at timestamptz not null default statement_timestamp(),
  constraint maintenance_offline_sync_conflicts_scope_fk foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  constraint maintenance_offline_sync_conflicts_operation_unique unique (actor_user_id,campground_id,client_operation_id)
);

create index maintenance_offline_sync_conflicts_campground_fk_idx
  on public.maintenance_offline_sync_conflicts(organization_id,campground_id);
create index maintenance_offline_sync_conflicts_actor_idx
  on public.maintenance_offline_sync_conflicts(actor_user_id,detected_at desc);

create function icamp_private.guard_offline_sync_conflict_immutability()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  raise exception 'Offline sync conflict evidence is immutable';
end $$;
create trigger guard_offline_sync_conflict_immutability
  before update or delete on public.maintenance_offline_sync_conflicts
  for each row execute function icamp_private.guard_offline_sync_conflict_immutability();

alter table public.maintenance_offline_sync_conflicts enable row level security;
alter table public.maintenance_offline_sync_conflicts force row level security;
revoke all on public.maintenance_offline_sync_conflicts from public;
grant select,insert on public.maintenance_offline_sync_conflicts to icamp_app;
do $revoke_data_api$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname=role_name) then
      execute format('revoke all on public.maintenance_offline_sync_conflicts from %I',role_name);
    end if;
  end loop;
end $revoke_data_api$;

create policy maintenance_offline_sync_conflicts_read
on public.maintenance_offline_sync_conflicts for select to icamp_app using (
  actor_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and (
    icamp_private.has_campground_permission(campground_id,'maintenance.read')
    or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    or icamp_private.has_campground_permission(campground_id,'inspection.perform')
    or icamp_private.has_campground_permission(campground_id,'maintenance.offline.media')
  )
);
create policy maintenance_offline_sync_conflicts_insert
on public.maintenance_offline_sync_conflicts for insert to icamp_app with check (
  actor_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid
  and (
    (operation_kind='inspection_result' and icamp_private.has_campground_permission(campground_id,'inspection.perform'))
    or (operation_kind='work_order_media' and icamp_private.has_campground_permission(campground_id,'maintenance.offline.media'))
    or (operation_kind='work_order_note' and (
      icamp_private.has_campground_permission(campground_id,'maintenance.create')
      or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
      or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
    ))
  )
);

alter table public.maintenance_offline_sync_receipts
  add column reviewed_conflict_id uuid references public.maintenance_offline_sync_conflicts(id) on delete restrict,
  add column resolution_reason text,
  add constraint maintenance_offline_receipts_review_pair check (
    (reviewed_conflict_id is null and resolution_reason is null)
    or (reviewed_conflict_id is not null and char_length(trim(resolution_reason)) between 20 and 500)
  );
create index maintenance_offline_receipts_review_fk_idx
  on public.maintenance_offline_sync_receipts(reviewed_conflict_id)
  where reviewed_conflict_id is not null;

-- Defense in depth: even a permitted receipt insert cannot cite a foreign
-- user, campground, target or operation as the reviewed conflict.
create function icamp_private.guard_offline_receipt_review()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.reviewed_conflict_id is not null and not exists (
    select 1 from public.maintenance_offline_sync_conflicts c
    where c.id=new.reviewed_conflict_id and c.actor_user_id=new.actor_user_id
      and c.organization_id=new.organization_id and c.campground_id=new.campground_id
      and c.operation_kind=new.operation_kind and c.target_id=new.target_id
      and c.client_operation_id<>new.client_operation_id
  ) then
    raise exception 'Reviewed offline conflict does not match replay scope';
  end if;
  return new;
end $$;
create trigger guard_offline_receipt_review
  before insert on public.maintenance_offline_sync_receipts
  for each row execute function icamp_private.guard_offline_receipt_review();

comment on table public.maintenance_offline_sync_conflicts is
  'Build 189 immutable, idempotent conflict evidence; only the original staff actor can read. Raw draft notes and images stay on the device.';
