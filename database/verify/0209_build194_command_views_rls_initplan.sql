-- Build 194: verify the four actor RLS policies use initplan-compatible expressions.
do $verify194rls$
declare n integer;
begin
 select count(*) into n
 from pg_policies
 where schemaname='icamp_private' and tablename='management_command_views'
   and policyname in ('command_views_read','command_views_insert','command_views_update','command_views_delete')
   and (
     (qual is not null and (qual ilike '%select%current_setting%' or qual ilike '%management_command_actor%'))
     or (with_check is not null and (with_check ilike '%select%current_setting%' or with_check ilike '%management_command_actor%'))
   );
 if n<>4 then raise exception 'Build194 RLS initplan optimization missing for %/4 policies',n; end if;
end $verify194rls$;
