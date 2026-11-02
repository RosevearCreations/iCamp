-- Build 004 authentication schema verification.
\set ON_ERROR_STOP on

do $$
declare
  expected_tables text[] := array[
    'user_accounts',
    'password_credentials',
    'auth_sessions',
    'password_recovery_tokens',
    'mfa_factors'
  ];
  table_name text;
begin
  foreach table_name in array expected_tables loop
    if to_regclass('icamp_private.' || table_name) is null then
      raise exception 'Missing expected auth table: icamp_private.%', table_name;
    end if;

    if to_regclass('public.' || table_name) is not null then
      raise exception 'Auth table must not exist in public schema: public.%', table_name;
    end if;
  end loop;
end
$$;

insert into icamp_private.user_accounts (
  email_normalized,
  account_type
)
values (
  'guest@example.test',
  'guest'
)
returning id as guest_user_id
\gset

insert into icamp_private.password_credentials (
  user_id,
  password_hash
)
values (
  :'guest_user_id',
  'scrypt$32768$8$1$ZmFrZS1zYWx0$ZmFrZS1oYXNoLWZvci1zcWwtdmVyaWZpY2F0aW9u'
);

insert into icamp_private.auth_sessions (
  user_id,
  token_hash,
  assurance_level,
  expires_at
)
values (
  :'guest_user_id',
  decode(repeat('11', 32), 'hex'),
  'aal1',
  statement_timestamp() + interval '12 hours'
);

insert into icamp_private.password_recovery_tokens (
  user_id,
  token_hash,
  expires_at
)
values (
  :'guest_user_id',
  decode(repeat('22', 32), 'hex'),
  statement_timestamp() + interval '30 minutes'
);

insert into icamp_private.mfa_factors (
  user_id,
  factor_type
)
values (
  :'guest_user_id',
  'totp'
);

select icamp_private.revoke_user_sessions(
  :'guest_user_id',
  'verification'
);

do $$
declare
  active_count integer;
  raw_token_columns integer;
begin
  select count(*)
    into active_count
  from icamp_private.auth_sessions
  where revoked_at is null;

  if active_count <> 0 then
    raise exception 'Expected verification session to be revoked';
  end if;

  select count(*)
    into raw_token_columns
  from information_schema.columns
  where table_schema = 'icamp_private'
    and table_name in ('auth_sessions', 'password_recovery_tokens')
    and column_name in ('token', 'session_token', 'recovery_token');

  if raw_token_columns <> 0 then
    raise exception 'Raw auth token column detected';
  end if;
end
$$;
