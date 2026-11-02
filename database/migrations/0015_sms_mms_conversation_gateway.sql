-- iCamp Build 012
-- SMS/MMS conversation and command gateway persistence.

create table icamp_private.messaging_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  endpoint_id uuid not null,
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_number_reference text not null
    check (char_length(provider_number_reference) between 1 and 240),
  sandbox_mode boolean not null default true,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint messaging_lines_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_lines_endpoint_scope_fk
    foreign key (campground_id, endpoint_id)
    references icamp_private.communication_endpoints(campground_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_lines_provider_number_unique
    unique (provider_key, provider_number_reference),
  constraint messaging_lines_campground_id_unique
    unique (campground_id, id)
);

create table icamp_private.messaging_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  line_id uuid not null,
  remote_endpoint_id uuid not null,
  preferred_channel text not null default 'sms'
    check (preferred_channel in ('sms', 'mms')),
  conversation_state text not null default 'active'
    check (conversation_state in ('active', 'closed')),
  last_message_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint messaging_conversations_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_conversations_line_scope_fk
    foreign key (campground_id, line_id)
    references icamp_private.messaging_lines(campground_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_conversations_remote_endpoint_scope_fk
    foreign key (campground_id, remote_endpoint_id)
    references icamp_private.communication_endpoints(campground_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_conversations_campground_id_unique
    unique (campground_id, id)
);

create unique index messaging_conversations_active_unique
  on icamp_private.messaging_conversations (line_id, remote_endpoint_id)
  where conversation_state = 'active';

create table icamp_private.messaging_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  conversation_id uuid not null,
  dispatch_id uuid not null
    references icamp_private.communication_dispatches(id)
    on update cascade
    on delete restrict,
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_message_reference text
    check (
      provider_message_reference is null
      or char_length(provider_message_reference) between 1 and 240
    ),
  direction text not null
    check (direction in ('inbound', 'outbound')),
  channel text not null
    check (channel in ('sms', 'mms')),
  purpose text not null
    check (purpose in ('transactional', 'operational', 'marketing')),
  delivery_state text not null
    check (
      delivery_state in (
        'received',
        'queued',
        'submitted',
        'delivered',
        'read',
        'failed'
      )
    ),
  body_length integer not null default 0
    check (body_length between 0 and 1600),
  command_kind text
    check (
      command_kind is null
      or char_length(command_kind) between 1 and 120
    ),
  command_source text not null default 'none'
    check (
      command_source in (
        'numbered',
        'keyword',
        'structured',
        'natural_language',
        'none'
      )
    ),
  command_state text not null default 'not_applicable'
    check (
      command_state in (
        'not_applicable',
        'navigation',
        'verification_required',
        'validation_required',
        'rejected'
      )
    ),
  occurred_at timestamptz not null default statement_timestamp(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint messaging_messages_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_messages_conversation_scope_fk
    foreign key (campground_id, conversation_id)
    references icamp_private.messaging_conversations(campground_id, id)
    on update cascade
    on delete restrict,
  constraint messaging_messages_dispatch_unique unique (dispatch_id)
);

create unique index messaging_messages_provider_reference_unique
  on icamp_private.messaging_messages (
    provider_key,
    provider_message_reference
  )
  where provider_message_reference is not null;

create table icamp_private.messaging_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null
    references icamp_private.messaging_messages(id)
    on update cascade
    on delete restrict,
  provider_media_reference text
    check (
      provider_media_reference is null
      or char_length(provider_media_reference) between 1 and 240
    ),
  media_asset_id uuid
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  content_type text not null
    check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  byte_size bigint not null
    check (byte_size between 1 and 10485760),
  intake_state text not null default 'pending_scan'
    check (intake_state in ('pending_scan', 'accepted', 'rejected')),
  created_at timestamptz not null default statement_timestamp(),
  constraint messaging_attachments_reference_check
    check (
      provider_media_reference is not null
      or media_asset_id is not null
    )
);

create index messaging_lines_scope_state_idx
  on icamp_private.messaging_lines (
    organization_id,
    campground_id,
    lifecycle_state
  );

create index messaging_lines_endpoint_idx
  on icamp_private.messaging_lines (endpoint_id);

create index messaging_conversations_scope_state_idx
  on icamp_private.messaging_conversations (
    organization_id,
    campground_id,
    conversation_state,
    last_message_at desc
  );

create index messaging_conversations_remote_endpoint_idx
  on icamp_private.messaging_conversations (
    remote_endpoint_id,
    conversation_state
  );

create index messaging_messages_conversation_time_idx
  on icamp_private.messaging_messages (
    conversation_id,
    occurred_at desc
  );

create index messaging_messages_scope_delivery_idx
  on icamp_private.messaging_messages (
    organization_id,
    campground_id,
    delivery_state,
    occurred_at desc
  );

create index messaging_attachments_message_idx
  on icamp_private.messaging_attachments (message_id);

create index messaging_attachments_media_asset_idx
  on icamp_private.messaging_attachments (media_asset_id)
  where media_asset_id is not null;

create trigger messaging_lines_touch_row
before update on icamp_private.messaging_lines
for each row execute function icamp_private.touch_row();

create trigger messaging_conversations_touch_row
before update on icamp_private.messaging_conversations
for each row execute function icamp_private.touch_row();

create trigger messaging_messages_touch_row
before update on icamp_private.messaging_messages
for each row execute function icamp_private.touch_row();

revoke all on icamp_private.messaging_lines from public;
revoke all on icamp_private.messaging_conversations from public;
revoke all on icamp_private.messaging_messages from public;
revoke all on icamp_private.messaging_attachments from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.messaging_lines from anon';
    execute 'revoke all on icamp_private.messaging_conversations from anon';
    execute 'revoke all on icamp_private.messaging_messages from anon';
    execute 'revoke all on icamp_private.messaging_attachments from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.messaging_lines from authenticated';
    execute 'revoke all on icamp_private.messaging_conversations from authenticated';
    execute 'revoke all on icamp_private.messaging_messages from authenticated';
    execute 'revoke all on icamp_private.messaging_attachments from authenticated';
  end if;
end
$$;

comment on table icamp_private.messaging_lines is
  'Private campground SMS/MMS provider-number bindings. Provider number references are server-only.';
comment on table icamp_private.messaging_conversations is
  'Private campground-scoped text-message threads. Message bodies are not stored here.';
comment on table icamp_private.messaging_messages is
  'Privacy-safe SMS/MMS message evidence: states, lengths and semantic command metadata only; no raw message body.';
comment on table icamp_private.messaging_attachments is
  'MMS attachment metadata and secure-media references only. Provider URLs and binary payloads are not stored.';
