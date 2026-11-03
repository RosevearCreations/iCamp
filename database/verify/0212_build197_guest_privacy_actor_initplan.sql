do $verify197actor$ declare p record;
begin
  if not exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace
    where n.nspname='icamp_private' and f.proname='guest_privacy_actor'
      and not f.prosecdef and f.provolatile='s')
  then raise exception 'Build197 actor helper must be stable security invoker'; end if;
  if not has_function_privilege('icamp_app','icamp_private.guest_privacy_actor()','execute')
  then raise exception 'Build197 app role lacks actor helper'; end if;
  if exists(select 1 from pg_roles where rolname='anon') and
    has_function_privilege('anon','icamp_private.guest_privacy_actor()','execute')
  then raise exception 'Build197 actor helper exposed to anonymous role'; end if;
  for p in select policyname,coalesce(qual,'')||' '||coalesce(with_check,'') expression
    from pg_policies where schemaname='icamp_private'
      and tablename in ('guest_privacy_requests','guest_privacy_request_events') loop
    if p.expression not ilike '%guest_privacy_actor%' or p.expression ilike '%current_setting%'
    then raise exception 'Build197 policy % lacks stable invoker actor initplan',p.policyname; end if;
  end loop;
end $verify197actor$;
