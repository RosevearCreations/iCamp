-- Build 010 voice foreign-key index verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass(
    'icamp_private.voice_calls_dispatch_scope_idx'
  ) is null then
    raise exception 'Missing voice_calls_dispatch_scope_idx';
  end if;

  if to_regclass(
    'icamp_private.voice_calls_line_scope_idx'
  ) is null then
    raise exception 'Missing voice_calls_line_scope_idx';
  end if;
end
$$;
