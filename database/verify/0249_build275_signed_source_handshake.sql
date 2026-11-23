-- This validates schema structure, not genuine seven-source field acceptance.
do $$
begin
 if to_regclass('icamp_private.signed_source_handshake275') is null
 then raise exception 'Build 275 ledger missing'; end if;
 if not exists(
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relname='signed_source_handshake275' and n.nspname='icamp_private'
    and c.relrowsecurity and c.relforcerowsecurity
 ) then raise exception 'Build 275 FORCE RLS missing';end if;
 if not exists(
  select 1 from pg_trigger t
  where t.tgrelid='icamp_private.signed_source_handshake275'::regclass
    and t.tgenabled='O' and not t.tgisinternal
 ) then raise exception 'Build 275 immutable trigger missing';end if;
 if not exists(
  select 1 from pg_constraint c
  where c.conrelid='icamp_private.signed_source_handshake275'::regclass
    and c.contype='u' and
    pg_get_constraintdef(c.oid) like '%(source_id, nonce)%'
 ) then raise exception 'Build 275 nonce replay guard missing';end if;
end $$;
