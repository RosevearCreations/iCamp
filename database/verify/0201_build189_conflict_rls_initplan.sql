do $verify_build189_rls_initplan$
begin
  if (select count(*) from pg_policies
    where schemaname='public' and tablename='maintenance_offline_sync_conflicts'
      and ((cmd='SELECT' and qual ilike '%select current_setting%')
        or (cmd='INSERT' and with_check ilike '%select current_setting%'))
  ) <> 2 then
    raise exception 'Build189 conflict RLS actor setting must use an initplan';
  end if;
end $verify_build189_rls_initplan$;
