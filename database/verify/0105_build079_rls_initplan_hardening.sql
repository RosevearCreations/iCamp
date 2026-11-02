-- Verify optimized app-actor RLS predicates use an initplan SELECT.
do $verify$
declare
 policy_name text;
begin
 foreach policy_name in array array[
  'garbage_policies_insert','garbage_policies_update',
  'garbage_pickups_insert','garbage_pickups_update','garbage_events_insert'
 ] loop
  if not exists (
   select 1 from pg_policies p where p.schemaname='public'
   and p.policyname=policy_name
   and p.with_check like '%SELECT current_setting(%'
  ) then
   raise exception 'Build 079 policy % must cache current_setting',policy_name;
  end if;
 end loop;
end $verify$;
