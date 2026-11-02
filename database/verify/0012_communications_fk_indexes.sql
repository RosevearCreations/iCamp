-- Build 009 communications foreign-key index verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass(
    'icamp_private.communication_preferences_updated_by_idx'
  ) is null then
    raise exception 'Missing communication_preferences_updated_by_idx';
  end if;
end
$$;
