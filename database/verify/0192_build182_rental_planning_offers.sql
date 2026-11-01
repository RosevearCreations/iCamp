do $verify_build182$
declare name text;
begin
  foreach name in array array['rental_planning_offers','rental_planning_requests'] loop
    if not exists (select 1 from pg_class where oid=('icamp_private.'||name)::regclass
      and relrowsecurity and relforcerowsecurity) then
      raise exception 'Build182 % requires FORCE RLS',name;
    end if;
    if exists(select 1 from pg_roles where rolname='anon') and
      has_table_privilege('anon','icamp_private.'||name,'SELECT') then
      raise exception 'Build182 % has anonymous read',name;
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') and
      has_table_privilege('authenticated','icamp_private.'||name,'INSERT') then
      raise exception 'Build182 % has authenticated direct write',name;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgname='rental_request_window_ownership_guard'
    and tgrelid='icamp_private.rental_planning_requests'::regclass and not tgisinternal) then
    raise exception 'Build182 atomic rental slot guard missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='icamp_private'
    and indexname='rental_requests_overlap_idx') then
    raise exception 'Build182 overlap index missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='icamp_private'
    and tablename='rental_planning_requests' and policyname='rental_requests_no_direct_access') then
    raise exception 'Build182 private request policy missing';
  end if;
end $verify_build182$;
