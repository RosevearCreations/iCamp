do $verify$ declare n integer;
begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public' and c.relname in (
    'icamp_waitlist_interest258','icamp_waitlist_review258'
  ) and c.relrowsecurity and c.relforcerowsecurity;
  if n<>2 then raise exception 'Build258 two FORCE RLS ledgers required'; end if;
  select count(*) into n from pg_policies where schemaname='public'
   and tablename in ('icamp_waitlist_interest258','icamp_waitlist_review258');
  if n<>4 then raise exception 'Build258 four scoped staff policies required'; end if;
  select count(*) into n from information_schema.table_privileges
  where table_schema='public' and table_name in
    ('icamp_waitlist_interest258','icamp_waitlist_review258')
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build258 waitlist and decisions are immutable'; end if;
  select count(*) into n from pg_trigger where not tgisinternal
   and tgname in ('icamp_waitlist258_intake_guard','icamp_waitlist258_review_guard');
  if n<>2 then raise exception 'Build258 source and reviewer guards required'; end if;
  select count(*) into n from pg_constraint
   where conrelid='public.icamp_waitlist_interest258'::regclass
   and contype='u' and conname='waitlist258_request_key_unique';
  if n<>1 then raise exception 'Build258 idempotency guard missing'; end if;
  select count(*) into n from information_schema.columns
  where table_schema='public' and table_name='icamp_waitlist_interest258'
  and column_name in ('guest_name','guest_email','guest_phone','contact_phone',
    'message_body','payment_token','offered','confirmed_reservation');
  if n<>0 then raise exception 'Build258 raw customer data or offer not permitted'; end if;
  select count(*) into n from pg_policies where schemaname='public'
    and tablename in ('icamp_waitlist_interest258','icamp_waitlist_review258')
    and roles::text like any(array['%anon%','%authenticated%','%public%']);
  if n<>0 then raise exception 'Build258 direct browser access denied'; end if;
  if to_regprocedure('icamp_private.create_reservation_hold(uuid,uuid,date,date,text)') is null
  then raise exception 'Build258 must reuse canonical atomic hold service'; end if;
end $verify$;
