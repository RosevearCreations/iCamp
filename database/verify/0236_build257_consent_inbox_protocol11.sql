do $verify$ declare n integer;
begin
  select count(*) into n from pg_class c
  join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public'
    and c.relname in ('icamp_contact_inbox257',
      'icamp_contact_task_actions257','icamp_contact_master_handoff257')
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>3 then raise exception 'Build257 three tenant ledgers require FORCE RLS'; end if;
  select count(*) into n from pg_policies
    where schemaname='public' and tablename in
      ('icamp_contact_inbox257','icamp_contact_task_actions257',
      'icamp_contact_master_handoff257');
  if n<>9 then raise exception 'Build257 six scoped and three restrictive role-isolation policies required'; end if;
  select count(*) into n from information_schema.table_privileges
    where table_schema='public' and table_name in
      ('icamp_contact_inbox257','icamp_contact_task_actions257',
      'icamp_contact_master_handoff257')
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build257 contact and handoff are append-only'; end if;
  select count(*) into n from pg_trigger
    where tgname in ('icamp_contact_intake257_guard',
      'icamp_contact_action257_guard','icamp_contact_handoff257_guard')
    and not tgisinternal;
  if n<>3 then raise exception 'Build257 source, role and handoff guards missing'; end if;
  select count(*) into n from pg_constraint
    where conrelid='public.icamp_contact_inbox257'::regclass
    and contype='u';
  if n<3 then raise exception 'Build257 idempotent original-event identity missing'; end if;
  select count(*) into n from pg_constraint
    where conrelid='public.icamp_contact_master_handoff257'::regclass
    and contype='u';
  if n<1 then raise exception 'Build257 no duplicate cross-Master hold queued'; end if;
  select count(*) into n from pg_policies
    where schemaname='public' and tablename in
      ('icamp_contact_inbox257','icamp_contact_task_actions257',
      'icamp_contact_master_handoff257')
      and (roles::text like '%public%' or roles::text like '%anon%'
        or roles::text like '%authenticated%');
  if n<>0 then raise exception 'Build257 no public/anon/authenticated RLS'; end if;
  select count(*) into n from information_schema.columns
    where table_schema='public' and table_name='icamp_contact_inbox257'
    and column_name in ('message_body','phone_number','email_address',
      'customer_name','raw_ivr_digits','media_url','provider_secret');
  if n<>0 then raise exception 'Build257 private contact inbox must not hold PII'; end if;
end $verify$;
