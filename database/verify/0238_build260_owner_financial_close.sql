do $verify$ declare n integer;
begin
  select count(*) into n from pg_class c
    join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relname='icamp_finance_close260'
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>1 then raise exception 'Build260 FORCE RLS required'; end if;
  select count(*) into n from pg_policies
    where schemaname='public' and tablename='icamp_finance_close260';
  if n<>2 then raise exception 'Build260 owner-only read/insert policies required'; end if;
  select count(*) into n from information_schema.table_privileges
    where table_schema='public' and table_name='icamp_finance_close260'
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build260 approval records must be immutable'; end if;
  select count(*) into n from pg_trigger where not tgisinternal
    and tgname='icamp_finance_close260_guard';
  if n<>1 then raise exception 'Build260 owner authority trigger required'; end if;
  select count(*) into n from pg_constraint
    where conrelid='public.icamp_finance_close260'::regclass
    and contype='u';
  if n<>1 then raise exception 'Build260 duplicate-day guard required'; end if;
end $verify$;
