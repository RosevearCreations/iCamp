-- Verify Build 079 advisor corrections remain installed.
do $verify$
declare
 function_name text;
begin
 foreach function_name in array array[
  'guard_garbage_pickup_update','reject_garbage_event_mutation'
 ] loop
  if not exists(
   select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='icamp_private' and p.proname=function_name
   and 'search_path=""'=any(p.proconfig)
  ) then
   raise exception 'Build 079 function % must pin an empty search_path',function_name;
  end if;
 end loop;
end $verify$;
