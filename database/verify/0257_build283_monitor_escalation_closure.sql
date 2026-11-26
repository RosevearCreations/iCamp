-- Disposable schema verification, never original production acceptance.
do $$
declare tab text;
begin
 foreach tab in array array['monitor_run283','escalation_attempt283','escalation_outcome283','recovery_closure283'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=tab and c.relrowsecurity and c.relforcerowsecurity)
   then raise exception 'Build 283 private schema missing %',tab;end if;
  if not exists(select 1 from pg_trigger t where t.tgrelid=to_regclass('icamp_private.'||tab)
   and t.tgname=tab||'_immutable' and t.tgenabled='O')
   then raise exception 'Build 283 immutable guard missing %',tab;end if;
 end loop;
end $$;
