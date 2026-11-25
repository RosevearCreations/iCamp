-- Verify disposable migration shape. Not evidence of original production provider acceptance.
do $$
declare tab text;
begin
 foreach tab in array array[
  'provider_custody_review281','owner_mfa_continuity281',
  'external_restore_final_ack281','original_restore_monitor_sample281'
 ] loop
  if to_regclass('icamp_private.'||tab) is null
   then raise exception 'Build 281 private table missing %',tab;end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=tab
    and c.relrowsecurity and c.relforcerowsecurity)
   then raise exception 'Build 281 FORCE RLS missing %',tab;end if;
  if not exists(select 1 from pg_trigger t
   where t.tgrelid=to_regclass('icamp_private.'||tab)
    and t.tgenabled='O' and not t.tgisinternal)
   then raise exception 'Build 281 immutable guard missing %',tab;end if;
 end loop;
 if not exists(select 1 from pg_constraint c
  where c.conrelid=to_regclass('icamp_private.external_restore_final_ack281')
   and c.contype='u')
 then raise exception 'Build 281 provider replay unique gate missing';end if;
 if not exists(select 1 from pg_constraint c
  where c.conrelid=to_regclass('icamp_private.owner_mfa_continuity281')
   and c.contype='u')
 then raise exception 'Build 281 owner witness replay unique gate missing';end if;
end $$;
