-- Disposable database structure check, not original field certification.
do $$
declare tab text;
begin
 foreach tab in array array['recovery_incident282','provider_alert_delivery282'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=tab
    and c.relrowsecurity and c.relforcerowsecurity)
   then raise exception 'Build 282 FORCE RLS missing %',tab;end if;
  if not exists(select 1 from pg_trigger t
   where t.tgrelid=to_regclass('icamp_private.'||tab)
    and t.tgenabled='O' and not t.tgisinternal)
   then raise exception 'Build 282 immutable guard missing %',tab;end if;
 end loop;
end $$;
