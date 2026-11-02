-- Build 012 SMS/MMS foreign-key index verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass(
    'icamp_private.messaging_lines_endpoint_scope_idx'
  ) is null then
    raise exception 'Missing messaging_lines_endpoint_scope_idx';
  end if;

  if to_regclass(
    'icamp_private.messaging_conversations_line_scope_idx'
  ) is null then
    raise exception 'Missing messaging_conversations_line_scope_idx';
  end if;

  if to_regclass(
    'icamp_private.messaging_conversations_remote_endpoint_scope_idx'
  ) is null then
    raise exception 'Missing messaging_conversations_remote_endpoint_scope_idx';
  end if;

  if to_regclass(
    'icamp_private.messaging_messages_conversation_scope_idx'
  ) is null then
    raise exception 'Missing messaging_messages_conversation_scope_idx';
  end if;
end
$$;
