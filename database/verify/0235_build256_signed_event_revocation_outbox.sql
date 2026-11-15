do $verify$
declare n integer;
begin
  select count(*) into n from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname in ('icamp_signed_event_receipts',
      'icamp_signed_event_revocations','icamp_signed_event_outbox')
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>3 then raise exception 'Build256 all three ledgers require FORCE RLS'; end if;

  select count(*) into n from pg_policies
  where schemaname='public' and tablename in
    ('icamp_signed_event_receipts','icamp_signed_event_revocations',
      'icamp_signed_event_outbox');
  if n<>6 then raise exception 'Build256 six owner RLS policies required'; end if;

  select count(*) into n from information_schema.table_privileges
  where table_schema='public'
    and table_name in ('icamp_signed_event_receipts',
      'icamp_signed_event_revocations','icamp_signed_event_outbox')
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build256 ledgers must be append only'; end if;

  select count(*) into n from pg_trigger
  where tgname in ('icamp_build256_original_event_guard',
    'icamp_build256_original_revocation_guard',
    'icamp_build256_delivery_hold_guard') and not tgisinternal;
  if n<>3 then raise exception 'Build256 signed source and queue guards missing'; end if;

  select count(*) into n from pg_constraint
  where contype='u' and conrelid='public.icamp_signed_event_receipts'::regclass;
  if n<2 then raise exception 'Build256 global signed nonce/replay uniqueness missing'; end if;

  select count(*) into n from pg_constraint
  where contype='u' and conrelid='public.icamp_signed_event_revocations'::regclass;
  if n<2 then raise exception 'Build256 one-revocation-per-source missing'; end if;

  select count(*) into n from pg_constraint
  where contype='u' and conrelid='public.icamp_signed_event_outbox'::regclass;
  if n<1 then raise exception 'Build256 one queued hold per recipient missing'; end if;

  select count(*) into n from pg_policies
  where schemaname='public' and tablename in
    ('icamp_signed_event_receipts','icamp_signed_event_revocations',
      'icamp_signed_event_outbox')
    and (roles::text like '%public%' or roles::text like '%anon%'
      or roles::text like '%authenticated%');
  if n<>0 then raise exception 'Build256 public/anon RLS forbidden'; end if;
end $verify$;
