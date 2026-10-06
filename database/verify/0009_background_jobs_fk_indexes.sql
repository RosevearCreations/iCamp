-- Build 007 background execution foreign-key index verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('icamp_private.job_schedules_scope_idx') is null then
    raise exception 'Missing job_schedules_scope_idx';
  end if;

  if to_regclass('icamp_private.job_queue_scope_idx') is null then
    raise exception 'Missing job_queue_scope_idx';
  end if;
end
$$;
