-- Build 006 audit and privileged-action schema verification.
\set ON_ERROR_STOP on

do $$
declare
  trigger_count integer;
begin
  if to_regclass('icamp_private.audit_events') is null then
    raise exception 'Missing icamp_private.audit_events';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'icamp_private'
      and table_name = 'auth_sessions'
      and column_name = 'reauthenticated_at'
      and is_nullable = 'NO'
  ) then
    raise exception 'auth_sessions.reauthenticated_at must exist and be NOT NULL';
  end if;

  select count(*)
    into trigger_count
  from pg_trigger
  where tgrelid = 'icamp_private.audit_events'::regclass
    and tgname = 'audit_events_append_only'
    and not tgisinternal;

  if trigger_count <> 1 then
    raise exception 'Audit append-only trigger is missing';
  end if;

  if to_regclass('icamp_private.audit_events_scope_time_idx') is null then
    raise exception 'Missing audit scope/time index';
  end if;

  if to_regclass('icamp_private.auth_sessions_recent_reauth_idx') is null then
    raise exception 'Missing recent re-authentication index';
  end if;
end
$$;
