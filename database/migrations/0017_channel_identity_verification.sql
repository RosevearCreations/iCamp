-- iCamp Build 013
-- Telephone/SMS identity verification, staff channel PINs and re-authentication evidence.

create table icamp_private.staff_channel_pin_credentials (
  user_id uuid primary key
    references icamp_private.user_accounts(id)
    on update cascade
    on delete cascade,
  pin_hash text not null
    check (char_length(pin_hash) between 40 and 1024),
  failed_attempt_count integer not null default 0
    check (failed_attempt_count between 0 and 1000),
  locked_until timestamptz,
  changed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1)
);

create table icamp_private.channel_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  remote_endpoint_id uuid not null,
  staff_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  channel text not null
    check (channel in ('voice', 'sms')),
  actor_kind text not null
    check (actor_kind in ('guest', 'staff')),
  purpose text not null
    check (purpose in ('guest_lookup', 'staff_access', 'staff_privileged')),
  subject_kind text not null
    check (subject_kind in ('site', 'reservation', 'pass', 'staff')),
  subject_reference_hash text
    check (
      subject_reference_hash is null
      or char_length(subject_reference_hash) between 40 and 1024
    ),
  code_hash text
    check (
      code_hash is null
      or char_length(code_hash) between 40 and 1024
    ),
  status text not null default 'pending'
    check (status in ('pending', 'satisfied', 'locked', 'expired', 'cancelled')),
  attempt_count integer not null default 0
    check (attempt_count between 0 and 1000),
  max_attempts integer not null default 5
    check (max_attempts between 1 and 10),
  code_verified_at timestamptz,
  pin_verified_at timestamptz,
  session_reauthenticated_at timestamptz,
  assurance_level text
    check (assurance_level is null or assurance_level in ('aal1', 'aal2')),
  locked_until timestamptz,
  expires_at timestamptz not null,
  satisfied_at timestamptz,
  fraud_signals text[] not null default '{}'::text[],
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint channel_verification_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint channel_verification_remote_endpoint_scope_fk
    foreign key (campground_id, remote_endpoint_id)
    references icamp_private.communication_endpoints(campground_id, id)
    on update cascade
    on delete restrict,
  constraint channel_verification_actor_check
    check (
      (
        actor_kind = 'guest'
        and purpose = 'guest_lookup'
        and staff_user_id is null
        and subject_kind in ('site', 'reservation', 'pass')
        and subject_reference_hash is not null
        and code_hash is not null
      )
      or (
        actor_kind = 'staff'
        and purpose in ('staff_access', 'staff_privileged')
        and staff_user_id is not null
        and subject_kind = 'staff'
        and subject_reference_hash is null
        and (purpose = 'staff_access' or code_hash is not null)
      )
    ),
  constraint channel_verification_expiry_check
    check (expires_at > created_at),
  constraint channel_verification_satisfied_check
    check (
      (status = 'satisfied' and satisfied_at is not null and assurance_level is not null)
      or status <> 'satisfied'
    ),
  constraint channel_verification_fraud_signal_count_check
    check (cardinality(fraud_signals) <= 20)
);

create table icamp_private.channel_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null
    references icamp_private.channel_verification_challenges(id)
    on update cascade
    on delete restrict,
  factor_kind text not null
    check (factor_kind in ('subject_reference', 'one_time_code', 'staff_pin', 'session_reauthentication')),
  outcome text not null
    check (outcome in ('accepted', 'rejected', 'locked', 'expired', 'context_mismatch', 'delivery_failed')),
  risk_signal text
    check (
      risk_signal is null
      or risk_signal ~ '^[a-z][a-z0-9_]{1,79}$'
    ),
  occurred_at timestamptz not null default statement_timestamp()
);

create index channel_verification_scope_state_idx
  on icamp_private.channel_verification_challenges (
    organization_id,
    campground_id,
    status,
    created_at desc
  );

create index channel_verification_endpoint_time_idx
  on icamp_private.channel_verification_challenges (
    campground_id,
    remote_endpoint_id,
    created_at desc
  );

create index channel_verification_staff_time_idx
  on icamp_private.channel_verification_challenges (
    staff_user_id,
    created_at desc
  )
  where staff_user_id is not null;

create index channel_verification_attempts_challenge_time_idx
  on icamp_private.channel_verification_attempts (
    challenge_id,
    occurred_at desc
  );

create index channel_verification_attempts_outcome_time_idx
  on icamp_private.channel_verification_attempts (
    outcome,
    occurred_at desc
  );

create trigger staff_channel_pin_credentials_touch_row
before update on icamp_private.staff_channel_pin_credentials
for each row execute function icamp_private.touch_row();

create trigger channel_verification_challenges_touch_row
before update on icamp_private.channel_verification_challenges
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.validate_staff_channel_pin_user()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_type_value text;
  account_state_value text;
begin
  select account_type, account_state
    into account_type_value, account_state_value
  from icamp_private.user_accounts
  where id = new.user_id;

  if account_type_value is distinct from 'staff'
     or account_state_value is distinct from 'active' then
    raise exception using
      errcode = '23514',
      message = 'Channel PIN credentials require an active staff identity';
  end if;

  return new;
end;
$$;

create trigger staff_channel_pin_credentials_validate_user
before insert or update of user_id on icamp_private.staff_channel_pin_credentials
for each row execute function icamp_private.validate_staff_channel_pin_user();

revoke all on icamp_private.staff_channel_pin_credentials from public;
revoke all on icamp_private.channel_verification_challenges from public;
revoke all on icamp_private.channel_verification_attempts from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.staff_channel_pin_credentials from anon';
    execute 'revoke all on icamp_private.channel_verification_challenges from anon';
    execute 'revoke all on icamp_private.channel_verification_attempts from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.staff_channel_pin_credentials from authenticated';
    execute 'revoke all on icamp_private.channel_verification_challenges from authenticated';
    execute 'revoke all on icamp_private.channel_verification_attempts from authenticated';
  end if;
end
$$;

comment on table icamp_private.staff_channel_pin_credentials is
  'Server-only salted staff channel PIN verifiers. Raw PIN digits are never stored.';
comment on table icamp_private.channel_verification_challenges is
  'Telephone/SMS verification state. Caller/sender endpoint is a routing hint only; raw verification codes and guest references are excluded.';
comment on table icamp_private.channel_verification_attempts is
  'Privacy-safe semantic verification-attempt evidence. Raw codes, PINs, caller numbers and guest identifiers are forbidden.';
