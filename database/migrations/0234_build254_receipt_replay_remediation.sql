-- iCamp Build 254: durable ORIGINAL signed-source receipt replay resistance
-- and independently reviewed remediation HOLDs. No CONNECTED/owner grant.
create table public.service_fulfillment_source_receipt_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  source_revision text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  receipt_type text not null
    check (receipt_type in ('database_provenance','master_source')),
  master_plane text
    check (master_plane in ('ai-data-platform','rosevear-ai-hub',
      'rosevear-comms-hub')),
  nonce_digest_sha256 text not null check (nonce_digest_sha256 ~ '^[a-f0-9]{64}$'),
  receipt_digest_sha256 text not null check (receipt_digest_sha256 ~ '^[a-f0-9]{64}$'),
  signer_fingerprint_sha256 text not null
    check (signer_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  receipt_issued_at timestamptz not null,
  decision text not null default 'signed_source_observed_hold'
    check (decision='signed_source_observed_hold'),
  claimed_by_user_id uuid not null references icamp_private.user_accounts(id),
  claimed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  check ((receipt_type='database_provenance' and master_plane is null)
    or (receipt_type='master_source' and master_plane is not null)),
  -- Global across tenant/org scope: a replayed original nonce cannot
  -- become a new claim in another campground, org, or reviewer session.
  unique (nonce_digest_sha256),
  unique (receipt_digest_sha256)
);
create index service_fulfillment_claims_recent
  on public.service_fulfillment_source_receipt_claims
  (campground_id,claimed_at desc,id desc);

create function icamp_private.guard_signed_source_receipt_claim()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.claimed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify')
  then raise exception 'Current owner with two permissions required'; end if;
  if current_setting('icamp.source_revision',true) is distinct from new.source_revision
    then raise exception 'Exact original deployed source required'; end if;
  if new.receipt_issued_at > statement_timestamp()+interval '60 seconds'
    or new.receipt_issued_at <
      statement_timestamp()-case when new.receipt_type='master_source'
        then interval '15 minutes' else interval '24 hours' end
    then raise exception 'Fresh signed original source required'; end if;
  new.decision:='signed_source_observed_hold';
  new.claimed_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_signed_source_claim_guard
before insert on public.service_fulfillment_source_receipt_claims
for each row execute function icamp_private.guard_signed_source_receipt_claim();

create table public.service_fulfillment_remediation_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  source_revision text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  source_receipt_claim_id uuid not null
    references public.service_fulfillment_source_receipt_claims(id)
    on delete restrict,
  decision text not null check (decision in
    ('hold','reject','request_fresh_originals','request_independent_review')),
  explanation text not null check (char_length(trim(explanation)) between 12 and 300),
  reviewed_by_user_id uuid not null references icamp_private.user_accounts(id),
  reviewed_at timestamptz not null default statement_timestamp(),
  foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id) on delete restrict,
  -- The same receipt claim receives a single independent disposition.
  unique (source_receipt_claim_id)
);
create index service_fulfillment_remediation_recent
  on public.service_fulfillment_remediation_decisions
  (campground_id,reviewed_at desc,id desc);

create function icamp_private.guard_independent_remediation_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare prior record;
begin
  if new.reviewed_by_user_id is distinct from icamp_private.request_user_id()
    or not icamp_private.has_current_campground_owner_admin(new.campground_id)
    or not icamp_private.has_campground_permission(new.campground_id,'staff.manage')
    or not icamp_private.has_campground_permission(new.campground_id,'reservation.modify')
  then raise exception 'Independent owner authority required'; end if;
  if current_setting('icamp.source_revision',true) is distinct from new.source_revision
    then raise exception 'Current deployed source SHA required'; end if;
  select campground_id,organization_id,source_revision,claimed_by_user_id
    into prior from public.service_fulfillment_source_receipt_claims
    where id=new.source_receipt_claim_id;
  if prior.campground_id is distinct from new.campground_id
    or prior.organization_id is distinct from new.organization_id
    or prior.source_revision is distinct from new.source_revision
    or prior.claimed_by_user_id is null
    or prior.claimed_by_user_id = new.reviewed_by_user_id
  then raise exception 'Different independently authorized reviewer and scoped source claim required'; end if;
  new.reviewed_at:=statement_timestamp();
  return new;
end;
$$;
create trigger service_fulfillment_remediation_decision_guard
before insert on public.service_fulfillment_remediation_decisions
for each row execute function icamp_private.guard_independent_remediation_review();

alter table public.service_fulfillment_source_receipt_claims
  enable row level security;
alter table public.service_fulfillment_source_receipt_claims
  force row level security;
alter table public.service_fulfillment_remediation_decisions
  enable row level security;
alter table public.service_fulfillment_remediation_decisions
  force row level security;
revoke all on public.service_fulfillment_source_receipt_claims from public;
revoke all on public.service_fulfillment_remediation_decisions from public;
do $revoke$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.service_fulfillment_source_receipt_claims from anon;
    revoke all on public.service_fulfillment_remediation_decisions from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.service_fulfillment_source_receipt_claims from authenticated;
    revoke all on public.service_fulfillment_remediation_decisions from authenticated;
  end if;
end $revoke$;
grant select,insert on public.service_fulfillment_source_receipt_claims to icamp_app;
grant select,insert on public.service_fulfillment_remediation_decisions to icamp_app;
create policy service_fulfillment_signed_claim_read
  on public.service_fulfillment_source_receipt_claims for select to icamp_app
  using (icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_signed_claim_insert
  on public.service_fulfillment_source_receipt_claims for insert to icamp_app
  with check (claimed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_remediation_read
  on public.service_fulfillment_remediation_decisions for select to icamp_app
  using (icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
create policy service_fulfillment_remediation_insert
  on public.service_fulfillment_remediation_decisions for insert to icamp_app
  with check (reviewed_by_user_id=icamp_private.request_user_id()
    and icamp_private.has_current_campground_owner_admin(campground_id)
    and icamp_private.has_campground_permission(campground_id,'staff.manage')
    and icamp_private.has_campground_permission(campground_id,'reservation.modify'));
