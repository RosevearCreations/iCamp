-- Build 256: independently authenticated signed-event custody, revocations
-- and a hold-only delivery outbox. Never grants T5, CONNECTED or owner ACCEPTED.
create table public.icamp_signed_event_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  deployed_revision text not null check (deployed_revision ~ '^[a-f0-9]{40}$'),
  source_revision text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  source_app text not null check (source_app in (
    'ai-data-platform','rosevear-ai-hub','rosevear-comms-hub',
    'icamp','yw','devilndove','rosiedazzlers')),
  target_app text not null check (target_app in (
    'ai-data-platform','rosevear-ai-hub','rosevear-comms-hub',
    'icamp','yw','devilndove','rosiedazzlers')),
  event_type text not null check (event_type in (
    'capability_status.v1','custody_renewal.v1',
    'security_exception.v1','fulfillment_signal.v1')),
  tenant_id uuid,
  nonce_digest_sha256 text not null check (nonce_digest_sha256 ~ '^[a-f0-9]{64}$'),
  receipt_digest_sha256 text not null check (receipt_digest_sha256 ~ '^[a-f0-9]{64}$'),
  signer_fingerprint_sha256 text not null check (signer_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  revokes_receipt_digest_sha256 text
    check (revokes_receipt_digest_sha256 ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  claimed_by_user_id uuid not null references icamp_private.user_accounts(id),
  claimed_at timestamptz not null default statement_timestamp(),
  decision text not null default 'signed_source_observed_hold'
    check (decision='signed_source_observed_hold'),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  check (source_app<>target_app),
  check (expires_at>issued_at and expires_at<=issued_at+interval '15 minutes'),
  check ((event_type='security_exception.v1' and revokes_receipt_digest_sha256 is not null)
    or revokes_receipt_digest_sha256 is null),
  -- Unique globally, even when another organization or tenant replays a nonce.
  unique (nonce_digest_sha256),
  unique (receipt_digest_sha256)
);
create index icamp_signed_event_recent
  on public.icamp_signed_event_receipts
  (organization_id,campground_id,claimed_at desc,id desc);

create table public.icamp_signed_event_revocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  deployed_revision text not null check (deployed_revision ~ '^[a-f0-9]{40}$'),
  revoked_receipt_id uuid not null references public.icamp_signed_event_receipts(id),
  signed_revocation_receipt_id uuid not null
    references public.icamp_signed_event_receipts(id),
  reason_code text not null check (reason_code in
    ('issuer_key_compromised','receipt_replaced','consent_revoked',
      'source_revoked','security_exception')),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique (revoked_receipt_id),
  unique (signed_revocation_receipt_id),
  check (revoked_receipt_id<>signed_revocation_receipt_id)
);
create index icamp_signed_revocation_recent
  on public.icamp_signed_event_revocations
  (organization_id,campground_id,reviewed_at desc,id desc);

create table public.icamp_signed_event_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  deployed_revision text not null check (deployed_revision ~ '^[a-f0-9]{40}$'),
  revocation_id uuid not null references public.icamp_signed_event_revocations(id),
  target_app text not null check (target_app in
    ('ai-data-platform','rosevear-ai-hub','rosevear-comms-hub')),
  decision text not null default 'hold_undelivered'
    check (decision='hold_undelivered'),
  queued_by_user_id uuid not null references icamp_private.user_accounts(id),
  queued_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  unique (revocation_id,target_app)
);

create function icamp_private.guard_build256_original_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.claimed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify')
  then raise exception 'Current owner with independent authority required'; end if;
  if current_setting('icamp.source_revision',true) is distinct from new.deployed_revision
  then raise exception 'Exact deployed source required'; end if;
  if new.issued_at > statement_timestamp()+interval '60 seconds'
    or new.issued_at < statement_timestamp()-interval '15 minutes'
    or new.expires_at <= statement_timestamp()
  then raise exception 'Original signed event stale or expired'; end if;
  if new.source_app='icamp' and new.tenant_id is distinct from new.campground_id
  then raise exception 'iCamp event must be scoped to its own campground'; end if;
  if new.source_app='icamp' and new.target_app in ('devilndove','rosiedazzlers')
  then raise exception 'No direct cross-brand campground transfer'; end if;
  new.claimed_at:=statement_timestamp();
  new.decision:='signed_source_observed_hold';
  return new;
end;
$$;
create trigger icamp_build256_original_event_guard
before insert on public.icamp_signed_event_receipts
for each row execute function icamp_private.guard_build256_original_event();

create function icamp_private.guard_build256_original_revocation()
returns trigger language plpgsql security definer set search_path='' as $$
declare prior record; revoker record;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify')
  then raise exception 'Independent owner reviewer required'; end if;
  if current_setting('icamp.source_revision',true) is distinct from new.deployed_revision
  then raise exception 'Exact deployed revision required'; end if;
  select * into prior from public.icamp_signed_event_receipts
    where id=new.revoked_receipt_id;
  select * into revoker from public.icamp_signed_event_receipts
    where id=new.signed_revocation_receipt_id;
  if prior.id is null or revoker.id is null
    or prior.organization_id is distinct from new.organization_id
    or prior.campground_id is distinct from new.campground_id
    or revoker.organization_id is distinct from new.organization_id
    or revoker.campground_id is distinct from new.campground_id
    or prior.source_app is distinct from revoker.source_app
    or revoker.event_type<>'security_exception.v1'
    or revoker.revokes_receipt_digest_sha256 is distinct from prior.receipt_digest_sha256
    or revoker.claimed_by_user_id = new.reviewed_by_user_id
  then raise exception 'Separate original signed revocation and reviewer required'; end if;
  new.reviewed_at:=statement_timestamp();
  return new;
end;
$$;
create trigger icamp_build256_original_revocation_guard
before insert on public.icamp_signed_event_revocations
for each row execute function icamp_private.guard_build256_original_revocation();

create function icamp_private.guard_build256_delivery_hold()
returns trigger language plpgsql security definer set search_path='' as $$
declare prior record;
begin
  if new.queued_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
  then raise exception 'Owner-authorized hold queue required'; end if;
  if current_setting('icamp.source_revision',true) is distinct from new.deployed_revision
  then raise exception 'Exact deployed source required'; end if;
  select organization_id,campground_id into prior
    from public.icamp_signed_event_revocations where id=new.revocation_id;
  if prior.organization_id is distinct from new.organization_id
    or prior.campground_id is distinct from new.campground_id
  then raise exception 'Cross-tenant delivery hold denied'; end if;
  new.decision:='hold_undelivered';
  new.queued_at:=statement_timestamp();
  return new;
end;
$$;
create trigger icamp_build256_delivery_hold_guard
before insert on public.icamp_signed_event_outbox
for each row execute function icamp_private.guard_build256_delivery_hold();

do $secure$
declare item text;
begin
  foreach item in array array[
    'icamp_signed_event_receipts',
    'icamp_signed_event_revocations',
    'icamp_signed_event_outbox'
  ] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('alter table public.%I force row level security',item);
    execute format('revoke all on public.%I from public',item);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on public.%I from anon',item);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on public.%I from authenticated',item);
    end if;
    execute format('grant select,insert on public.%I to icamp_app',item);
    execute format(
      'create policy %I on public.%I for select to icamp_app using (
        icamp_private.has_current_campground_owner_admin(campground_id)
        and icamp_private.has_campground_permission(campground_id,''staff.manage'')
        and icamp_private.has_campground_permission(campground_id,''reservation.modify''))',
      item||'_select',item);
    execute format(
      'create policy %I on public.%I for insert to icamp_app with check (
        icamp_private.has_current_campground_owner_admin(campground_id)
        and icamp_private.has_campground_permission(campground_id,''staff.manage'')
        and icamp_private.has_campground_permission(campground_id,''reservation.modify''))',
      item||'_insert',item);
  end loop;
end $secure$;
