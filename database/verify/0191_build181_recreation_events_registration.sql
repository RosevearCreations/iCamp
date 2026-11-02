do $verify_build181$
declare table_name text;
begin
  foreach table_name in array array['campground_recreation_events','recreation_registration_requests'] loop
    if not exists(select 1 from pg_class
      where oid=('icamp_private.'||table_name)::regclass
        and relrowsecurity and relforcerowsecurity) then
      raise exception 'Build181 % must force RLS',table_name;
    end if;
    if exists(select 1 from pg_roles where rolname='anon') and
       has_table_privilege('anon','icamp_private.'||table_name,'SELECT') then
      raise exception 'Build181 % unexpectedly grants anonymous read',table_name;
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') and
       has_table_privilege('authenticated','icamp_private.'||table_name,'INSERT') then
      raise exception 'Build181 % unexpectedly grants direct authenticated write',table_name;
    end if;
  end loop;
  if not exists(select 1 from pg_trigger
    where tgrelid='icamp_private.recreation_registration_requests'::regclass
      and tgname='recreation_requests_capacity_and_ownership' and not tgisinternal) then
    raise exception 'Build181 reservation ownership/capacity trigger missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='icamp_private'
    and indexname='recreation_requests_capacity_idx') then
    raise exception 'Build181 capacity lookup index missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='icamp_private'
    and tablename='recreation_registration_requests'
    and policyname='recreation_requests_no_direct_access') then
    raise exception 'Build181 private request policy missing';
  end if;
end $verify_build181$;
