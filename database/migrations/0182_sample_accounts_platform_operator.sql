-- iCamp Build 152: case-insensitive usernames and gated platform operator grants.
-- The existing email identity remains authoritative for recovery; aliases are login-only.
alter table icamp_private.user_accounts
  add column username_normalized text
  constraint icamp_username_format_check
    check (username_normalized ~ '^[a-z][a-z0-9_-]{2,31}$');

create unique index user_accounts_username_normalized_unique
  on icamp_private.user_accounts (username_normalized)
  where username_normalized is not null;

create table icamp_private.platform_operator_grants (
  user_id uuid primary key
    references icamp_private.user_accounts(id) on delete restrict,
  grant_state text not null default 'pending'
    check (grant_state in ('pending', 'active', 'revoked')),
  reviewed_at timestamptz,
  reviewed_by uuid references icamp_private.user_accounts(id),
  approval_reference text,
  created_at timestamptz not null default statement_timestamp(),
  constraint platform_grant_activation_requires_review
    check (
      grant_state <> 'active'
      or (
        reviewed_at is not null
        and reviewed_by is not null
        and reviewed_by <> user_id
        and nullif(trim(approval_reference), '') is not null
      )
    )
);

alter table icamp_private.platform_operator_grants enable row level security;
alter table icamp_private.platform_operator_grants force row level security;
revoke all on icamp_private.platform_operator_grants from public, anon, authenticated;

comment on table icamp_private.platform_operator_grants is
  'Explicit global platform roles, separate from any campground owner_admin. Provisioned pending by default. Activation needs independently reviewed record and verified MFA; no client grants.';

-- Never seed passwords, activate privileged operators, or use real guests in migrations.
