-- Build 007 background jobs, scheduler and queue schema verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('icamp_private.job_schedules') is null then
    raise exception 'Missing icamp_private.job_schedules';
  end if;

  if to_regclass('icamp_private.job_queue') is null then
    raise exception 'Missing icamp_private.job_queue';
  end if;

  if to_regclass('icamp_private.queue_workers') is null then
    raise exception 'Missing icamp_private.queue_workers';
  end if;

  if to_regclass('icamp_private.scheduler_heartbeats') is null then
    raise exception 'Missing icamp_private.scheduler_heartbeats';
  end if;

  if to_regclass('icamp_private.job_queue_idempotency_idx') is null then
    raise exception 'Missing job idempotency index';
  end if;

  if to_regclass('icamp_private.job_queue_claim_idx') is null then
    raise exception 'Missing job claim index';
  end if;

  if to_regclass('icamp_private.job_schedules_due_idx') is null then
    raise exception 'Missing due-schedule index';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
     and has_schema_privilege('anon', 'icamp_private', 'USAGE') then
    raise exception 'anon must not have private schema usage';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_schema_privilege('authenticated', 'icamp_private', 'USAGE') then
    raise exception 'authenticated must not have private schema usage';
  end if;
end
$$;
