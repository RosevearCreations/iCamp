-- Build 264 migration schema contract and restricted source-scoped ownership.
do $verify$
declare
  table_name text;
  target oid;
  expected_guard text;
begin
  foreach table_name in array array['rental_allocations264','rental_pilot_reviews264'] loop
    target := to_regclass('icamp_private.' || table_name);
    if target is null then raise exception '% does not exist', table_name; end if;
    if not exists(select 1 from pg_class where oid=target
       and relrowsecurity and relforcerowsecurity) then
      raise exception 'Build264 % lacks FORCE RLS',table_name;
    end if;
    if has_table_privilege('icamp_app','icamp_private.' || table_name,'SELECT')
       or has_table_privilege('icamp_app','icamp_private.' || table_name,'INSERT')
       or has_table_privilege('icamp_app','icamp_private.' || table_name,'UPDATE')
       or has_table_privilege('icamp_app','icamp_private.' || table_name,'DELETE')
    then raise exception 'Build264 % direct app grants detected',table_name; end if;
    expected_guard := case when table_name='rental_allocations264'
      then 'rental_allocation264_guard' else 'rental_pilot264_guard' end;
    if not exists(select 1 from pg_trigger where tgrelid=target
      and tgname=expected_guard and not tgisinternal)
    then raise exception 'Build264 original % trigger missing',table_name; end if;
    if not exists(select 1 from pg_policies where schemaname='icamp_private'
      and tablename=table_name and policyname=table_name || '_no_direct_client')
    then raise exception 'Build264 deny-direct policy missing: %',table_name; end if;
  end loop;
end $verify$;
