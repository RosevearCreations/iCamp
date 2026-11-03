-- Build 194: stable invoker helper is used in all staff preference policies.
do $verify194helper$
declare
 p record;
begin
 if not exists(
  select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace
  where n.nspname='icamp_private' and f.proname='management_command_actor'
   and not f.prosecdef and f.provolatile='s'
 ) then raise exception 'Build194 actor helper must be STABLE and SECURITY INVOKER'; end if;
 if not has_function_privilege('icamp_app','icamp_private.management_command_actor()','EXECUTE') then
  raise exception 'Build194 app role cannot resolve its own actor'; end if;
 for p in select policyname,coalesce(qual,'')||' '||coalesce(with_check,'') expression
  from pg_policies where schemaname='icamp_private' and tablename='management_command_views' loop
  if p.expression not ilike '%management_command_actor%' or p.expression ilike '%current_setting%' then
   raise exception 'Build194 policy % missing invoker actor initplan',p.policyname; end if;
 end loop;
end $verify194helper$;
