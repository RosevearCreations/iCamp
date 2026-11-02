do $verify_build191_fk$
begin
 if not exists(select 1 from pg_indexes where schemaname='icamp_private'
  and indexname='vendor_contract_supersedes_scope_fk_idx'
  and indexdef like '%(organization_id, campground_id, supersedes_contract_id)%') then
  raise exception 'Build191 contract supersession composite FK covering index missing';end if;
 if not exists(select 1 from pg_indexes where schemaname='icamp_private'
  and indexname='vendor_recurring_supersedes_scope_fk_idx'
  and indexdef like '%(organization_id, campground_id, supersedes_plan_id)%') then
  raise exception 'Build191 recurring supersession composite FK covering index missing';end if;
end $verify_build191_fk$;
