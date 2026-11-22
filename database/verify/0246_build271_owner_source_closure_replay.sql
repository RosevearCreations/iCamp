-- Build 271 ephemeral contract checks. This is not an original-host restore.
do $$
declare tab text;
begin
 foreach tab in array array[
  'owner_ceremony271','source_pair_proofs271',
  'certified_booking_closure271','restore_replay271'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
   raise exception 'Missing original Build 271 private table %',tab;end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=tab
     and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Missing FORCE RLS on Build 271 %',tab;end if;
  if not exists(
    select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid
     join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='icamp_private' and c.relname=tab and not g.tgisinternal
  ) then raise exception 'Missing immutable guard on Build 271 %',tab;end if;
 end loop;
 if not exists(
   select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname='booking_recovery268'
    and g.tgname='certified_booking_close271_guard' and g.tgenabled='O'
 ) then raise exception 'Paid-guest case closure must be independently certified';end if;
 if not exists(
   select 1 from pg_constraint c
   where c.conrelid='icamp_private.certified_booking_closure271'::regclass
    and c.contype='u'
    and pg_get_constraintdef(c.oid) like '%(recovery_id)%'
 ) then raise exception 'Exactly one independent closure per recovery';end if;
 if not exists(
  select 1 from pg_constraint c
  where c.conrelid='icamp_private.source_pair_proofs271'::regclass
   and c.contype='u'
   and pg_get_constraintdef(c.oid) like '%(campground_id, source_kind, source_id, nonce)%'
 ) then raise exception 'Pairing nonce anti-replay uniqueness missing';end if;
end $$;
