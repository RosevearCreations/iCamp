-- Build 012 SMS/MMS gateway schema verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('icamp_private.messaging_lines') is null then
    raise exception 'Missing messaging_lines';
  end if;
  if to_regclass('icamp_private.messaging_conversations') is null then
    raise exception 'Missing messaging_conversations';
  end if;
  if to_regclass('icamp_private.messaging_messages') is null then
    raise exception 'Missing messaging_messages';
  end if;
  if to_regclass('icamp_private.messaging_attachments') is null then
    raise exception 'Missing messaging_attachments';
  end if;
  if to_regclass('icamp_private.messaging_conversations_active_unique') is null then
    raise exception 'Missing active conversation uniqueness index';
  end if;
  if to_regclass('icamp_private.messaging_messages_provider_reference_unique') is null then
    raise exception 'Missing provider-message uniqueness index';
  end if;
  if has_schema_privilege('public', 'icamp_private', 'USAGE') then
    raise exception 'PUBLIC must not have USAGE on icamp_private';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege('anon', 'icamp_private.messaging_messages', 'SELECT') then
      raise exception 'anon must not read private messaging messages';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    if has_table_privilege(
      'authenticated',
      'icamp_private.messaging_conversations',
      'SELECT'
    ) then
      raise exception 'authenticated must not read private messaging conversations';
    end if;
  end if;
end
$$;

begin;

insert into public.organizations (name, slug)
values ('Build 012 Verify Org', 'build-012-verify-org')
returning id as msg_verify_org
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'msg_verify_org',
  'Build 012 Verify Camp',
  'build-012-verify-camp',
  'America/Toronto'
)
returning id as msg_verify_camp
\gset

insert into icamp_private.communication_endpoints (
  organization_id,
  campground_id,
  endpoint_kind,
  endpoint_value,
  display_hint,
  verified_at
)
values
  (
    :'msg_verify_org',
    :'msg_verify_camp',
    'phone',
    '+15555551201',
    'campground messaging line ending 1201',
    statement_timestamp()
  ),
  (
    :'msg_verify_org',
    :'msg_verify_camp',
    'phone',
    '+15555551202',
    'guest line ending 1202',
    null
  );

select id as msg_verify_line_endpoint
from icamp_private.communication_endpoints
where campground_id = :'msg_verify_camp'
  and endpoint_value = '+15555551201'
\gset

select id as msg_verify_remote_endpoint
from icamp_private.communication_endpoints
where campground_id = :'msg_verify_camp'
  and endpoint_value = '+15555551202'
\gset

insert into icamp_private.messaging_lines (
  organization_id,
  campground_id,
  endpoint_id,
  provider_key,
  provider_number_reference,
  sandbox_mode
)
values (
  :'msg_verify_org',
  :'msg_verify_camp',
  :'msg_verify_line_endpoint',
  'mock',
  'mock-number-1201',
  true
)
returning id as msg_verify_line
\gset

insert into icamp_private.messaging_conversations (
  organization_id,
  campground_id,
  line_id,
  remote_endpoint_id,
  preferred_channel
)
values (
  :'msg_verify_org',
  :'msg_verify_camp',
  :'msg_verify_line',
  :'msg_verify_remote_endpoint',
  'mms'
)
returning id as msg_verify_conversation
\gset

insert into icamp_private.communication_dispatches (
  organization_id,
  campground_id,
  endpoint_id,
  direction,
  channel,
  purpose,
  idempotency_key,
  delivery_state
)
values (
  :'msg_verify_org',
  :'msg_verify_camp',
  :'msg_verify_remote_endpoint',
  'inbound',
  'mms',
  'operational',
  'build012-schema-inbound',
  'submitted'
)
returning id as msg_verify_dispatch
\gset

insert into icamp_private.messaging_messages (
  organization_id,
  campground_id,
  conversation_id,
  dispatch_id,
  provider_key,
  provider_message_reference,
  direction,
  channel,
  purpose,
  delivery_state,
  body_length,
  command_kind,
  command_source,
  command_state
)
values (
  :'msg_verify_org',
  :'msg_verify_camp',
  :'msg_verify_conversation',
  :'msg_verify_dispatch',
  'mock',
  'mock-message-build012',
  'inbound',
  'mms',
  'operational',
  'received',
  18,
  'lookup.site',
  'structured',
  'verification_required'
)
returning id as msg_verify_message
\gset

insert into icamp_private.messaging_attachments (
  message_id,
  provider_media_reference,
  content_type,
  byte_size
)
values (
  :'msg_verify_message',
  'mock-media-build012',
  'image/jpeg',
  2048
);

insert into icamp_private.communication_provider_events (
  provider_key,
  provider_event_id,
  dispatch_id,
  channel,
  event_type,
  event_status,
  metadata,
  occurred_at
)
values (
  'mock',
  'build012-provider-event',
  :'msg_verify_dispatch',
  'mms',
  'message.received',
  'received',
  '{"rawBodyExcluded":true,"messageBodyExcluded":true}'::jsonb,
  statement_timestamp()
);

do $$
declare
  body_column_count integer;
begin
  select count(*)
  into body_column_count
  from information_schema.columns
  where table_schema = 'icamp_private'
    and table_name = 'messaging_messages'
    and column_name in ('body', 'message_body', 'raw_body', 'text');

  if body_column_count <> 0 then
    raise exception 'Raw message body column must not exist';
  end if;
end
$$;

rollback;
