-- iCamp Build 250: append-only, tenant-private, owner-supervised SOURCE
-- REVIEW REQUESTS. This never grants CONNECTED, signed operational acceptance,
-- provider authorization or access to a Master runtime.
create table public.service_fulfillment_owner_ceremony_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  source_revision text not null check (source_revision ~ '^[0-9a-f]{40}$'),
  dossier_snapshot_id uuid references public.service_fulfillment_owner_dossier_snapshots(id),
  signature_verification_id uuid references public.service_fulfillment_device_signature_verifications(id),
  original_witness_id uuid references public.service_fulfillment_original_device_witness_admissions(id),
  source_health_nonce_digest_sha256 text check (source_health_nonce_digest_sha256 ~ '^[a-f0-9]{64}$'),
  three_master_evidence_digest_sha256 text check (three_master_evidence_digest_sha256 ~ '^[a-f0-9]{64}$'),
  dossier_digest_sha256 text check (dossier_digest_sha256 ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('hold','reject','request_supervised_review')),
  explanation text not null check (char_length(trim(explanation)) between 12 and 300),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  check (
    decision <> 'request_supervised_review'
    or (dossier_snapshot_id is not null
      and signature_verification_id is not null
      and original_witness_id is not null
      and source_health_nonce_digest_sha256 is not null
      and three_master_evidence_digest_sha256 is not null
      and dossier_digest_sha256 is not null)
  )
);
create unique index service_fulfillment_owner_ceremony_source_nonce_once
  on public.service_fulfillment_owner_ceremony_reviews (source_health_nonce_digest_sha256)
  where source_health_nonce_digest_sha256 is not null;
create index service_fulfillment_owner_ceremony_recent_idx
  on public.service_fulfillment_owner_ceremony_reviews
  (campground_id,recorded_at desc,id desc);

create function icamp_private.guard_service_fulfillment_owner_ceremony()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  dossier record;
  witness record;
  signature_row record;
  latest_dossier uuid;
  latest_signature uuid;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Current campground owner authority required';
  end if;
  if current_setting('icamp.source_revision',true) is distinct from new.source_revision
    or new.source_revision !~ '^[0-9a-f]{40}$' then
    raise exception 'Exact current source SHA required for owner ceremony';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.campground_id::text),
    pg_catalog.hashtext('icamp-owner-ceremony'));
  if new.decision='request_supervised_review' then
    select id,source_revision,dossier_digest_sha256,recorded_by_user_id,
      recorded_at into dossier
    from public.service_fulfillment_owner_dossier_snapshots
    where id=new.dossier_snapshot_id and organization_id=new.organization_id
      and campground_id=new.campground_id;
    select id into latest_dossier
    from public.service_fulfillment_owner_dossier_snapshots
    where organization_id=new.organization_id and campground_id=new.campground_id
    order by recorded_at desc,id desc limit 1;
    select id,dispatch_id,signature_verification_id,original_review_id,
      admitted_by_user_id,admitted_at,decision,source_revision into witness
    from public.service_fulfillment_original_device_witness_admissions
    where id=new.original_witness_id and organization_id=new.organization_id
      and campground_id=new.campground_id;
    select id,dispatch_id,original_review_id,source_revision,verified_by_user_id
      into signature_row
    from public.service_fulfillment_device_signature_verifications
    where id=new.signature_verification_id and organization_id=new.organization_id
      and campground_id=new.campground_id;
    select id into latest_signature
    from public.service_fulfillment_device_signature_verifications
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=witness.dispatch_id
    order by verified_at desc,id desc limit 1;
    if dossier.id is null or dossier.id is distinct from latest_dossier
      or dossier.source_revision is distinct from new.source_revision
      or dossier.dossier_digest_sha256 is distinct from new.dossier_digest_sha256
      or dossier.recorded_by_user_id=new.reviewed_by_user_id
      or dossier.recorded_at < statement_timestamp()-interval '24 hours'
      or witness.id is null or witness.source_revision is distinct from new.source_revision
      or witness.decision <> 'source_observed_pending_external_authority'
      or witness.admitted_by_user_id=new.reviewed_by_user_id
      or witness.admitted_at < statement_timestamp()-interval '24 hours'
      or witness.signature_verification_id is distinct from new.signature_verification_id
      or signature_row.id is null or signature_row.id is distinct from latest_signature
      or signature_row.source_revision is distinct from new.source_revision
      or signature_row.original_review_id is distinct from witness.original_review_id
      or signature_row.dispatch_id is distinct from witness.dispatch_id
      or signature_row.verified_by_user_id=new.reviewed_by_user_id
      then raise exception 'Original independently supervised source custody incomplete';
    end if;
  else
    -- HOLD / REJECT may be recorded without inventing missing evidence.
    new.dossier_snapshot_id := null;
    new.signature_verification_id := null;
    new.original_witness_id := null;
    new.source_health_nonce_digest_sha256 := null;
    new.three_master_evidence_digest_sha256 := null;
    new.dossier_digest_sha256 := null;
  end if;
  new.recorded_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_owner_ceremony_guard
before insert on public.service_fulfillment_owner_ceremony_reviews
for each row execute function icamp_private.guard_service_fulfillment_owner_ceremony();

alter table public.service_fulfillment_owner_ceremony_reviews
  enable row level security;
alter table public.service_fulfillment_owner_ceremony_reviews
  force row level security;
revoke all on public.service_fulfillment_owner_ceremony_reviews from public;
do $revoke$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.service_fulfillment_owner_ceremony_reviews from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.service_fulfillment_owner_ceremony_reviews from authenticated;
  end if;
end $revoke$;
grant select,insert on public.service_fulfillment_owner_ceremony_reviews to icamp_app;
create policy service_fulfillment_owner_ceremony_read
  on public.service_fulfillment_owner_ceremony_reviews
  for select to icamp_app
  using (icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_owner_ceremony_insert
  on public.service_fulfillment_owner_ceremony_reviews
  for insert to icamp_app
  with check (reviewed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
