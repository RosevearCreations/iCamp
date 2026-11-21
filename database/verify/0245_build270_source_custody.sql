-- Build 270 ephemeral schema contract, not evidence of production adoption.
do $$
declare t text;
begin
 foreach t in array array[
 'support_delivery_attempts270','provider_trace270','original_restore_evidence270'
 ] loop
  if to_regclass('icamp_private.'||t) is null then
    raise exception 'Build270 source ledger missing %',t; end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=t
     and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build270 FORCE RLS missing %',t;end if;
  if not exists(
   select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=t and not g.tgisinternal
  ) then raise exception 'Build270 immutable guard missing %',t;end if;
 end loop;
 if not exists(
   select 1 from pg_constraint where conname='support_delivery_attempts270_outbox_id_key'
 ) then raise exception 'One outbound attempt per original notice must be enforced';end if;
 if not exists(
   select 1 from pg_constraint where conrelid='icamp_private.provider_trace270'::regclass and contype='u' and pg_get_constraintdef(oid) like '%(recovery_id, payment_id, provider_response_sha256)%'
 ) then raise exception 'Original provider evidence replay uniqueness missing';end if;
end $$;
