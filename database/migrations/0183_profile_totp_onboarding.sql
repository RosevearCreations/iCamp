-- Build 153: private self-service account profiles and replay-resistant TOTP state.
-- No users, passwords, activation receipts, or signer credentials are seeded here.
create table icamp_private.account_profiles (
  user_id uuid primary key references icamp_private.user_accounts(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  preferred_contact text not null default 'none'
    check (preferred_contact in ('none', 'email', 'phone')),
  updated_at timestamptz not null default statement_timestamp()
);

alter table icamp_private.account_profiles enable row level security;
alter table icamp_private.account_profiles force row level security;
revoke all on icamp_private.account_profiles from public;

alter table icamp_private.mfa_factors
  add column totp_last_accepted_step bigint not null default -1,
  add column totp_failed_attempts integer not null default 0
    check (totp_failed_attempts between 0 and 100),
  add column totp_locked_until timestamptz;

create unique index mfa_one_live_totp_per_user
  on icamp_private.mfa_factors (user_id)
  where factor_type = 'totp' and factor_state in ('pending', 'verified');

comment on table icamp_private.account_profiles is
  'Private self-managed global profile, distinct from reservation-linked guest records and campground staff authorization.';
comment on column icamp_private.mfa_factors.provider_reference is
  'TOTP factors store only encrypted seed envelopes; the encryption key belongs in a server-only secret store.';
