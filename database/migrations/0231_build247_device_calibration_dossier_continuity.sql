-- iCamp Build 247: independent Ed25519 source-bound device evidence,
-- owner-only calibration source closure and hash-chained unsigned dossiers.
-- No release of owner operational acceptance or Master CONNECTED.
create table public.service_fulfillment_device_signature_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  dispatch_id uuid not null,
  original_review_id uuid not null references public.service_fulfillment_original_device_review_events(id),
  signer_key_id text not null check (char_length(signer_key_id) between 8 and 96),
  signer_pin_sha256 text not null check (signer_pin_sha256 ~ '^[0-9a-f]{64}$'),
  source_revision text not null check (source_revision ~ '^[0-9a-f]{40}$'),
  nonce_digest_sha256 text not null check (nonce_digest_sha256 ~ '^[0-9a-f]{64}$'),
  signed_message_sha256 text not null check (signed_message_sha256 ~ '^[0-9a-f]{64}$'),
  decision text not null default 'signature_valid_source_bound'
    check (decision='signature_valid_source_bound'),
  verified_by_user_id uuid not null references icamp_private.user_accounts(id),
  verified_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id,dispatch_id)
    references public.service_fulfillment_dispatches(organization_id,campground_id,id) on delete restrict,
  -- One-use nonces must be unique even if two campgrounds share a device signing key.
  unique(signer_key_id,nonce_digest_sha256)
);
create index service_fulfillment_device_signatures_recent_idx
  on public.service_fulfillment_device_signature_verifications
  (campground_id,dispatch_id,verified_at desc,id desc);

create function icamp_private.guard_service_fulfillment_device_signature()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  current_review record;
  field_report record;
  field_witness record;
  matched_origin uuid;
begin
  if new.verified_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Current campground supervisor required for evidence verification';
  end if;
  -- The server must bind the transaction to the exact deployed code revision.
  if current_setting('icamp.source_revision',true) is distinct from new.source_revision
    or new.source_revision !~ '^[0-9a-f]{40}$' then
    raise exception 'Original deployed source revision is unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.dispatch_id::text),pg_catalog.hashtext('icamp-signature-replay'));
  select id,field_report_id,witness_id,reviewed_by_user_id into current_review
    from public.service_fulfillment_original_device_review_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by reviewed_at desc,id desc limit 1;
  if current_review.id is distinct from new.original_review_id then
    raise exception 'Latest source review changed; signed packet is stale';
  end if;
  select id,reported_by_user_id into field_report
    from public.service_fulfillment_mobile_field_reports
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by reported_at desc,id desc limit 1;
  select id,witnessed_by_user_id into field_witness
    from public.service_fulfillment_field_witness_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and dispatch_id=new.dispatch_id
    order by witnessed_at desc,id desc limit 1;
  if field_report.id is distinct from current_review.field_report_id
    or field_witness.id is distinct from current_review.witness_id
    or new.verified_by_user_id in (
      current_review.reviewed_by_user_id,field_report.reported_by_user_id,
      field_witness.witnessed_by_user_id
    ) then
    raise exception 'Independent evidence reviewer and latest source required';
  end if;
  new.verified_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_device_signature_guard
before insert on public.service_fulfillment_device_signature_verifications
for each row execute function icamp_private.guard_service_fulfillment_device_signature();

create table public.service_fulfillment_calibration_closure_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  checkpoint_id uuid not null references public.service_fulfillment_forecast_checkpoints(id),
  latest_followup_id uuid not null references public.service_fulfillment_calibration_followup_events(id),
  previous_closure_id uuid references public.service_fulfillment_calibration_closure_events(id),
  decision text not null check(decision in ('source_reconciled_unverified','recheck_required')),
  explanation text not null check(char_length(trim(explanation)) between 12 and 300),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key(organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique(checkpoint_id,previous_closure_id)
);
create unique index service_fulfillment_calibration_closure_first_idx
  on public.service_fulfillment_calibration_closure_events(checkpoint_id)
  where previous_closure_id is null;
create index service_fulfillment_calibration_closure_recent_idx
  on public.service_fulfillment_calibration_closure_events
  (campground_id,checkpoint_id,reviewed_at desc,id desc);

create function icamp_private.guard_service_fulfillment_calibration_closure()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  previous uuid;
  followup record;
  checkpoint record;
  observed integer;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Active campground Owner / Administrator required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.checkpoint_id::text),pg_catalog.hashtext('icamp-calibration-closure'));
  select id into previous from public.service_fulfillment_calibration_closure_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and checkpoint_id=new.checkpoint_id
    order by reviewed_at desc,id desc limit 1;
  if previous is distinct from new.previous_closure_id then
    raise exception 'Calibration closure history changed; refresh';
  end if;
  select id,decision,recorded_by_user_id,expected_new_review_events,
         observed_new_review_events,absolute_error into followup
    from public.service_fulfillment_calibration_followup_events
    where organization_id=new.organization_id and campground_id=new.campground_id
      and checkpoint_id=new.checkpoint_id
    order by recorded_at desc,id desc limit 1;
  select id,expected_new_review_events,evidence_coverage,captured_at into checkpoint
    from public.service_fulfillment_forecast_checkpoints
    where organization_id=new.organization_id and campground_id=new.campground_id
      and id=new.checkpoint_id;
  if followup.id is distinct from new.latest_followup_id
    or checkpoint.id is null
    or followup.recorded_by_user_id=new.reviewed_by_user_id
    or checkpoint.captured_at+interval '8 hours'>statement_timestamp()
    or checkpoint.evidence_coverage <> 'SOURCE_SNAPSHOT_ONLY'
    or (new.decision='source_reconciled_unverified' and followup.decision<>'mitigation_recorded') then
    raise exception 'Fresh independent source follow-up is required';
  end if;
  -- Reconcile against source events again, not a copied UI total.
  select count(*) into observed from (
    select id from public.service_fulfillment_supervisor_review_events e
      where e.organization_id=new.organization_id and e.campground_id=new.campground_id
        and e.reviewed_at>=checkpoint.captured_at
        and e.reviewed_at<checkpoint.captured_at+interval '8 hours'
        and e.decision in ('escalation_requested','blocker_escalated')
    union all
    select id from public.service_fulfillment_shift_handoff_events h
      where h.organization_id=new.organization_id and h.campground_id=new.campground_id
        and h.recorded_at>=checkpoint.captured_at
        and h.recorded_at<checkpoint.captured_at+interval '8 hours'
        and h.event_kind='request'
  ) original_events;
  if checkpoint.expected_new_review_events<>followup.expected_new_review_events
    or observed<>followup.observed_new_review_events
    or abs(observed-checkpoint.expected_new_review_events)<>followup.absolute_error then
    raise exception 'Source-side calibration changed; reopen for recheck';
  end if;
  new.reviewed_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_calibration_closure_guard
before insert on public.service_fulfillment_calibration_closure_events
for each row execute function icamp_private.guard_service_fulfillment_calibration_closure();

create table public.service_fulfillment_owner_dossier_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  previous_snapshot_id uuid references public.service_fulfillment_owner_dossier_snapshots(id),
  source_revision text not null check(source_revision ~ '^[0-9a-f]{40}$'),
  dossier_digest_sha256 text not null check(dossier_digest_sha256 ~ '^[0-9a-f]{64}$'),
  previous_digest_sha256 text check(previous_digest_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_schema text not null check(char_length(evidence_schema) between 8 and 96),
  completeness text not null check(completeness in ('SOURCE_SNAPSHOT_ONLY','PARTIAL_HOLD')),
  witness_count integer not null check(witness_count>=0),
  device_review_count integer not null check(device_review_count>=0),
  forecast_count integer not null check(forecast_count>=0),
  audited_count integer not null check(audited_count>=0),
  trust_status text not null default 'UNSIGNED_HOLD'
    check(trust_status='UNSIGNED_HOLD'),
  recorded_by_user_id uuid not null references icamp_private.user_accounts(id),
  recorded_at timestamptz not null default statement_timestamp(),
  foreign key(organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique(campground_id,previous_snapshot_id)
);
create unique index service_fulfillment_dossier_first_idx
  on public.service_fulfillment_owner_dossier_snapshots(campground_id)
  where previous_snapshot_id is null;
create index service_fulfillment_dossier_recent_idx
  on public.service_fulfillment_owner_dossier_snapshots(campground_id,recorded_at desc,id desc);

create function icamp_private.guard_service_fulfillment_owner_dossier()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  last_record record;
begin
  if new.recorded_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify') then
    raise exception 'Active campground Owner / Administrator required';
  end if;
  if current_setting('icamp.source_revision',true) is distinct from new.source_revision then
    raise exception 'Dossier must bind to deployed source revision';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.campground_id::text),pg_catalog.hashtext('icamp-dossier-chain'));
  select id,dossier_digest_sha256 into last_record
    from public.service_fulfillment_owner_dossier_snapshots
    where organization_id=new.organization_id and campground_id=new.campground_id
    order by recorded_at desc,id desc limit 1;
  if new.previous_snapshot_id is distinct from last_record.id
    or new.previous_digest_sha256 is distinct from last_record.dossier_digest_sha256 then
    raise exception 'Dossier snapshot chain changed; refresh';
  end if;
  new.recorded_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_owner_dossier_guard
before insert on public.service_fulfillment_owner_dossier_snapshots
for each row execute function icamp_private.guard_service_fulfillment_owner_dossier();

do $tables$ declare t text; begin
  foreach t in array array[
    'service_fulfillment_device_signature_verifications',
    'service_fulfillment_calibration_closure_events',
    'service_fulfillment_owner_dossier_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public',t);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on public.%I from anon',t);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on public.%I from authenticated',t);
    end if;
    execute format('grant select,insert on public.%I to icamp_app',t);
  end loop;
end $tables$;
create policy service_fulfillment_device_signature_read
  on public.service_fulfillment_device_signature_verifications for select to icamp_app
  using (icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_device_signature_insert
  on public.service_fulfillment_device_signature_verifications for insert to icamp_app
  with check (verified_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));

create policy service_fulfillment_calibration_closure_read
  on public.service_fulfillment_calibration_closure_events for select to icamp_app
  using (icamp_private.has_current_campground_owner_admin(campground_id));
create policy service_fulfillment_calibration_closure_insert
  on public.service_fulfillment_calibration_closure_events for insert to icamp_app
  with check (reviewed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_current_campground_owner_admin(campground_id));

create policy service_fulfillment_dossier_read
  on public.service_fulfillment_owner_dossier_snapshots for select to icamp_app
  using (icamp_private.has_current_campground_owner_admin(campground_id));
create policy service_fulfillment_dossier_insert
  on public.service_fulfillment_owner_dossier_snapshots for insert to icamp_app
  with check (recorded_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_current_campground_owner_admin(campground_id));
