-- iCamp Build 004
-- Authentication identities, password credentials, sessions, recovery and MFA readiness.
-- Sensitive auth records live in the non-exposed icamp_private schema.

create table icamp_private.user_accounts (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique
    check (
      email_normalized = lower(trim(email_normalized))
      and char_length(email_normalized) between 3 and 320
      and position('@' in email_normalized) > 1
    ),
  account_type text not null
    check (account_type in ('guest', 'staff')),
  account_state text not null default 'active'
    check (account_state in ('active', 'disabled')),
  email_verified_at timestamptz,
  failed_sign_in_count integer not null default 0
    check (failed_sign_in_count >= 0),
  locked_until timestamptz,
  mfa_required boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  row_version bigint not null default 1 check (row_version >= 1),
  constraint user_accounts_archive_state_check
    check (
      archived_at is null
      or account_state = 'disabled'
    )
);

create table icamp_private.password_credentials (
  user_id uuid primary key
    references icamp_private.user_accounts(id)
    on update cascade
    on delete cascade,
  password_hash text not null
    check (char_length(password_hash) between 40 and 1024),
  algorithm text not null default 'scrypt'
    check (algorithm = 'scrypt'),
  changed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1)
);

create table icamp_private.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete cascade,
  token_hash bytea not null unique,
  assurance_level text not null default 'aal1'
    check (assurance_level in ('aal1', 'aal2')),
  created_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text
    check (
      revoke_reason is null
      or char_length(revoke_reason) between 1 and 120
    ),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint auth_sessions_expiry_check
    check (expires_at > created_at),
  constraint auth_sessions_revocation_check
    check (
      (revoked_at is null and revoke_reason is null)
      or revoked_at is not null
    )
);

create table icamp_private.password_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete cascade,
  token_hash bytea not null unique,
  requested_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint password_recovery_expiry_check
    check (expires_at > requested_at),
  constraint password_recovery_consumed_check
    check (consumed_at is null or consumed_at >= requested_at)
);

create table icamp_private.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete cascade,
  factor_type text not null
    check (factor_type in ('totp', 'webauthn', 'recovery_code')),
  factor_state text not null default 'pending'
    check (factor_state in ('pending', 'verified', 'disabled')),
  provider_reference text,
  enrolled_at timestamptz not null default statement_timestamp(),
  verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1)
);

create index auth_sessions_user_active_idx
  on icamp_private.auth_sessions (user_id, expires_at)
  where revoked_at is null;

create index password_recovery_user_active_idx
  on icamp_private.password_recovery_tokens (user_id, expires_at)
  where consumed_at is null;

create index mfa_factors_user_state_idx
  on icamp_private.mfa_factors (user_id, factor_state);

create trigger user_accounts_touch_row
before update on icamp_private.user_accounts
for each row execute function icamp_private.touch_row();

create trigger password_credentials_touch_row
before update on icamp_private.password_credentials
for each row execute function icamp_private.touch_row();

create trigger auth_sessions_touch_row
before update on icamp_private.auth_sessions
for each row execute function icamp_private.touch_row();

create trigger mfa_factors_touch_row
before update on icamp_private.mfa_factors
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.revoke_user_sessions(
  target_user_id uuid,
  reason text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  if reason is null or char_length(trim(reason)) = 0 then
    raise exception 'Session revocation reason is required';
  end if;

  update icamp_private.auth_sessions
  set
    revoked_at = statement_timestamp(),
    revoke_reason = left(reason, 120)
  where user_id = target_user_id
    and revoked_at is null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on table icamp_private.user_accounts is
  'Global authentication identities; authorization/campground roles are separate and arrive in Build 005.';

comment on table icamp_private.password_credentials is
  'Server-only password verifiers. Never expose password hashes to public clients.';

comment on table icamp_private.auth_sessions is
  'Server-side sessions storing only hashes of opaque browser session tokens.';

comment on table icamp_private.password_recovery_tokens is
  'Single-use password recovery tokens stored only as hashes.';

comment on table icamp_private.mfa_factors is
  'MFA readiness metadata; factor secrets are not introduced by Build 004.';
