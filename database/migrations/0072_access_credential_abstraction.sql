-- iCamp Build 056
-- Access Credential Abstraction.
--
-- Provider-neutral credential records intentionally never store raw PINs, QR
-- payloads, card secrets or provider API secrets. Digital credential material
-- is represented by a one-way fingerprint plus a masked display hint.

create table public.access_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  credential_number text not null
    check (credential_number ~ '^AC-[A-Z0-9]{8,40}$'),
  credential_type text not null
    check (credential_type in (
      'key_card','fob','keypad_pin','qr_pass','printed_pass',
      'wristband','provider_reference'
    )),
  subject_kind text not null
    check (subject_kind in (
      'reservation','guest','visitor','vehicle','staff','other'
    )),
  subject_reference_id uuid,
  subject_label text not null
    check (char_length(trim(subject_label)) between 1 and 240),
  provider_code text
    check (
      provider_code is null
      or provider_code ~ '^[a-z][a-z0-9_-]{1,63}$'
    ),
  provider_credential_reference text
    check (
      provider_credential_reference is null
      or char_length(trim(provider_credential_reference)) between 1 and 240
    ),
  secret_fingerprint text
    check (
      secret_fingerprint is null
      or secret_fingerprint ~ '^[a-f0-9]{64}$'
    ),
  display_hint text
    check (
      display_hint is null
      or char_length(trim(display_hint)) between 1 and 80
    ),
  status text not null default 'active'
    check (status in ('active','revoked')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  issued_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  revocation_reason text
    check (
      revocation_reason is null
      or char_length(trim(revocation_reason)) between 3 and 500
    ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint access_credentials_scope_number_unique
    unique (organization_id,campground_id,credential_number),
  constraint access_credentials_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint access_credentials_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict,
  constraint access_credentials_validity_check
    check (valid_until is null or valid_until > valid_from),
  constraint access_credentials_revocation_check
    check (
      (status='active' and revoked_at is null and revoked_by_user_id is null
        and revocation_reason is null)
      or
      (status='revoked' and revoked_at is not null
        and revocation_reason is not null)
    ),
  constraint access_credentials_provider_pair_check
    check (
      (provider_code is null and provider_credential_reference is null)
      or
      (provider_code is not null and provider_credential_reference is not null)
    )
);

create unique index access_credentials_provider_reference_unique
  on public.access_credentials(campground_id,provider_code,provider_credential_reference)
  where provider_code is not null and provider_credential_reference is not null;

create index access_credentials_subject_idx
  on public.access_credentials(campground_id,subject_kind,subject_reference_id,status);

create index access_credentials_validity_idx
  on public.access_credentials(campground_id,status,valid_from,valid_until);

create index access_credentials_issued_by_idx
  on public.access_credentials(issued_by_user_id)
  where issued_by_user_id is not null;

create index access_credentials_revoked_by_idx
  on public.access_credentials(revoked_by_user_id)
  where revoked_by_user_id is not null;

create table public.access_credential_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  credential_id uuid not null,
  event_kind text not null
    check (event_kind in ('issued','revoked','expired_observed','provider_linked')),
  actor_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  occurred_at timestamptz not null default statement_timestamp(),
  reason text
    check (reason is null or char_length(trim(reason)) between 1 and 500),
  event_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_metadata)='object'),
  constraint access_credential_events_scope_credential_fk
    foreign key (organization_id,campground_id,credential_id)
    references public.access_credentials(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index access_credential_events_credential_idx
  on public.access_credential_events(campground_id,credential_id,occurred_at desc);

create index access_credential_events_actor_idx
  on public.access_credential_events(actor_user_id)
  where actor_user_id is not null;

create or replace function icamp_private.validate_access_credential()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.credential_type in ('keypad_pin','qr_pass')
     and new.secret_fingerprint is null then
    raise exception 'Digital access credentials require a one-way secret fingerprint';
  end if;

  if new.credential_type not in ('keypad_pin','qr_pass')
     and new.secret_fingerprint is not null then
    raise exception 'Only keypad PIN and QR credentials may carry a secret fingerprint';
  end if;

  if tg_op='UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.campground_id is distinct from new.campground_id
      or old.credential_number is distinct from new.credential_number
      or old.credential_type is distinct from new.credential_type
      or old.subject_kind is distinct from new.subject_kind
      or old.subject_reference_id is distinct from new.subject_reference_id
      or old.created_at is distinct from new.created_at then
      raise exception 'Access credential scope and identity are immutable';
    end if;

    if old.status='revoked' and new.status <> 'revoked' then
      raise exception 'Revoked access credentials cannot be reactivated';
    end if;
  end if;

  return new;
end;
$$;

create trigger access_credentials_validate
before insert or update on public.access_credentials
for each row execute function icamp_private.validate_access_credential();

create trigger access_credentials_touch
before update on public.access_credentials
for each row execute function icamp_private.touch_row();

alter table public.access_credentials enable row level security;
alter table public.access_credentials force row level security;
alter table public.access_credential_events enable row level security;
alter table public.access_credential_events force row level security;

revoke all on public.access_credentials from public;
revoke all on public.access_credential_events from public;
grant select,insert,update on public.access_credentials to icamp_app;
grant select,insert on public.access_credential_events to icamp_app;

create policy access_credentials_read on public.access_credentials
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

create policy access_credentials_issue on public.access_credentials
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
);

create policy access_credentials_manage on public.access_credentials
for update to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
)
with check (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

create policy access_credential_events_read on public.access_credential_events
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

create policy access_credential_events_append on public.access_credential_events
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key
from icamp_private.roles r
cross join (
  values ('access.credential.issue'),('access.credential.revoke')
) as p(permission_key)
where r.role_kind='template'
  and r.role_code in ('front_desk','security','campground_manager','owner_admin')
on conflict do nothing;

comment on table public.access_credentials is
  'Build 056 provider-neutral access credential abstraction. Raw PINs, QR payloads and provider secrets are never stored. Build 057+ owns hardware/control and Build 063 owns full arrival/departure lifecycle.';

comment on table public.access_credential_events is
  'Build 056 append-only issuance/revocation/provider-link evidence for access credentials.';
