-- Disposable CI structural checks, not actual original production evidence.
do $$
declare tab text;
begin
 foreach tab in array array[
  'peer_field_review278','owner_mfa_readback278','restore_service_readback278'
 ] loop
  if to_regclass('icamp_private.'||tab) is null then
   raise exception 'Missing Build 278 table %',tab;end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relname=tab and n.nspname='icamp_private'
    and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'Build 278 FORCE RLS missing %',tab;end if;
  if not exists(
   select 1 from pg_trigger t where
    t.tgrelid=to_regclass('icamp_private.'||tab)
    and t.tgenabled='O' and not t.tgisinternal
  ) then raise exception 'Build 278 immutable trigger missing %',tab;end if;
 end loop;
 foreach tab in array array[
  'peer_field_review278','owner_mfa_readback278','restore_service_readback278'
 ] loop
  if not exists(
   select 1 from pg_constraint c
   where c.conrelid=to_regclass('icamp_private.'||tab)
    and c.contype='u'
  ) then raise exception 'Build 278 duplicate source guard missing %',tab;end if;
 end loop;
end $$;
