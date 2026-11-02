-- Build 013 channel identity verification schema verification.
\set ON_ERROR_STOP on

do $$
declare
  expected_tables text[] := array[
    'staff_channel_pin_credentials',
    'channel_verification_challenges',
    'channel_verification_attempts'
  ];
  expected_table text;
  forbidden_columns integer;
begin
  foreach expected_table in array expected_tables loop
    if to_regclass('icamp_private.' || expected_table) is null then
      raise exception 'Missing Build 013 private table: icamp_private.%', expected_table;
    end if;

    if to_regclass('public.' || expected_table) is not null then
      raise exception 'Build 013 table must not exist in public schema: public.%', expected_table;
    end if;
  end loop;

  select count(*)
    into forbidden_columns
  from information_schema.columns
  where table_schema = 'icamp_private'
    and table_name in (
      'staff_channel_pin_credentials',
      'channel_verification_challenges',
      'channel_verification_attempts'
    )
    and column_name in (
      'pin',
      'raw_pin',
      'verification_code',
      'raw_code',
      'subject_reference',
      'phone_number',
      'caller_id',
      'message_body'
    );

  if forbidden_columns <> 0 then
    raise exception 'Build 013 contains a forbidden raw-secret/identifier column';
  end if;

  if to_regclass('icamp_private.channel_verification_scope_state_idx') is null then
    raise exception 'Missing Build 013 scope/state index';
  end if;

  if to_regclass('icamp_private.channel_verification_endpoint_time_idx') is null then
    raise exception 'Missing Build 013 endpoint/time index';
  end if;

  if to_regclass('icamp_private.channel_verification_staff_time_idx') is null then
    raise exception 'Missing Build 013 staff/time index';
  end if;

  if to_regclass('icamp_private.channel_verification_attempts_challenge_time_idx') is null then
    raise exception 'Missing Build 013 attempt/challenge index';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
     and has_table_privilege('anon', 'icamp_private.channel_verification_challenges', 'select') then
    raise exception 'anon must not read Build 013 verification challenges';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_table_privilege('authenticated', 'icamp_private.channel_verification_challenges', 'select') then
    raise exception 'authenticated must not read Build 013 verification challenges directly';
  end if;
end
$$;
