-- Build 014 messaging consent/preference schema verification.
\set ON_ERROR_STOP on

do $$
declare
  expected_tables text[] := array[
    'communication_compliance_rules',
    'messaging_preference_state',
    'messaging_preference_events'
  ];
  expected_table text;
  forbidden_columns integer;
begin
  foreach expected_table in array expected_tables loop
    if to_regclass('icamp_private.' || expected_table) is null then
      raise exception 'Missing Build 014 private table: icamp_private.%', expected_table;
    end if;

    if to_regclass('public.' || expected_table) is not null then
      raise exception 'Build 014 table must not exist in public schema: public.%', expected_table;
    end if;
  end loop;

  select count(*)
    into forbidden_columns
  from information_schema.columns
  where table_schema = 'icamp_private'
    and table_name in (
      'communication_compliance_rules',
      'messaging_preference_state',
      'messaging_preference_events'
    )
    and column_name in (
      'phone_number',
      'endpoint_value',
      'message_body',
      'raw_body',
      'raw_message',
      'message_text'
    );

  if forbidden_columns <> 0 then
    raise exception 'Build 014 contains a forbidden raw endpoint/message column';
  end if;

  if to_regclass('icamp_private.communication_compliance_rules_default_idx') is null then
    raise exception 'Missing Build 014 default compliance-rule index';
  end if;

  if to_regclass('icamp_private.messaging_preference_events_endpoint_time_idx') is null then
    raise exception 'Missing Build 014 endpoint/time preference-event index';
  end if;

  if to_regclass('icamp_private.messaging_preference_events_provider_unique') is null then
    raise exception 'Missing Build 014 provider idempotency index';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
     and has_table_privilege('anon', 'icamp_private.messaging_preference_events', 'select') then
    raise exception 'anon must not read Build 014 preference evidence';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_table_privilege('authenticated', 'icamp_private.messaging_preference_events', 'select') then
    raise exception 'authenticated must not read Build 014 preference evidence directly';
  end if;
end
$$;
