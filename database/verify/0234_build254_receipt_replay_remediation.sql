do $verify$ declare n integer; begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='public' and c.relname in
    ('service_fulfillment_source_receipt_claims','service_fulfillment_remediation_decisions')
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>2 then raise exception 'Build254 both private ledgers require RLS and FORCE'; end if;
  select count(*) into n from pg_policies
  where schemaname='public' and tablename in
    ('service_fulfillment_source_receipt_claims','service_fulfillment_remediation_decisions');
  if n<>4 then raise exception 'Build254 four RLS policies required'; end if;
  select count(*) into n from information_schema.table_privileges
  where table_schema='public'
    and table_name in ('service_fulfillment_source_receipt_claims',
      'service_fulfillment_remediation_decisions')
    and grantee='icamp_app' and privilege_type in ('UPDATE','DELETE');
  if n<>0 then raise exception 'Build254 claims and reviews must be append only'; end if;
  select count(*) into n from pg_trigger
  where tgname in ('service_fulfillment_signed_source_claim_guard',
    'service_fulfillment_remediation_decision_guard') and not tgisinternal;
  if n<>2 then raise exception 'Build254 two independent source guards missing'; end if;
  select count(*) into n from pg_constraint
  where conrelid='public.service_fulfillment_source_receipt_claims'::regclass
    and contype='u';
  if n<2 then raise exception 'Build254 nonce and receipt replay indexes missing'; end if;
  select count(*) into n from pg_constraint
  where conrelid='public.service_fulfillment_remediation_decisions'::regclass
    and contype='u';
  if n<1 then raise exception 'Build254 once-only disposition missing'; end if;
  select count(*) into n from pg_policies
  where schemaname='public' and tablename in
    ('service_fulfillment_source_receipt_claims','service_fulfillment_remediation_decisions')
    and (roles::text like '%public%' or roles::text like '%anon%'
      or roles::text like '%authenticated%');
  if n<>0 then raise exception 'Build254 no public/anon policy allowed'; end if;
end $verify$;
