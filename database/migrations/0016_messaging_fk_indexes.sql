-- iCamp Build 012
-- Advisor-driven foreign-key indexes for SMS/MMS campground scope.

create index messaging_lines_endpoint_scope_idx
  on icamp_private.messaging_lines (
    campground_id,
    endpoint_id
  );

create index messaging_conversations_line_scope_idx
  on icamp_private.messaging_conversations (
    campground_id,
    line_id
  );

create index messaging_conversations_remote_endpoint_scope_idx
  on icamp_private.messaging_conversations (
    campground_id,
    remote_endpoint_id
  );

create index messaging_messages_conversation_scope_idx
  on icamp_private.messaging_messages (
    campground_id,
    conversation_id
  );
