-- Build 004 auth-session timestamp verification.
\set ON_ERROR_STOP on

do $$
declare
  column_count integer;
begin
  select count(*)
    into column_count
  from information_schema.columns
  where table_schema = 'icamp_private'
    and table_name = 'auth_sessions'
    and column_name = 'updated_at';

  if column_count <> 1 then
    raise exception 'auth_sessions.updated_at is required by touch_row trigger';
  end if;
end
$$;
