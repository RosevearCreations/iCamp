do $verify$ begin
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='winterization_step_events' and indexname='winterization_step_run_fk_idx') then
  raise exception 'Scoped winterization step run FK index missing'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and tablename='winterization_reviews' and indexname='winterization_review_run_fk_idx') then
  raise exception 'Scoped winterization review run FK index missing'; end if;
end $verify$;
