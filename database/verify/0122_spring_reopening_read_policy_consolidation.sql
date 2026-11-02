do $verify$ declare table_name text; policies_count integer; begin
 foreach table_name in array array['accommodations','seasonal_assignments',
  'seasonal_assignment_events','maintenance_work_orders'] loop
  select count(*) into policies_count from pg_policies
   where schemaname='public' and tablename=table_name and cmd='SELECT'
    and roles @> array['icamp_app']::name[];
  if policies_count <> 1 then
   raise exception 'Expected exactly one scoped read policy on %, found %',table_name,policies_count;
  end if;
 end loop;
end $verify$;
