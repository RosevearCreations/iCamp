do $verify_build180$
begin
  if not exists (
    select 1 from pg_class
    where oid='icamp_private.campground_wayfinding_publications'::regclass
      and relrowsecurity and relforcerowsecurity
  ) then
    raise exception 'Build180 private wayfinding must force RLS';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='icamp_private.campground_wayfinding_publications'::regclass
      and tgname='campground_wayfinding_publication_guard' and not tgisinternal
  ) then
    raise exception 'Build180 publication source guard missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='icamp_private'
      and tablename='campground_wayfinding_publications'
      and policyname='campground_wayfinding_no_direct_app_access'
  ) then
    raise exception 'Build180 direct-access deny policy missing';
  end if;
  if exists (select 1 from pg_roles where rolname='anon')
     and has_table_privilege('anon',
       'icamp_private.campground_wayfinding_publications','SELECT') then
    raise exception 'Build180 must not expose wayfinding management rows to anonymous clients';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated')
     and has_table_privilege('authenticated',
       'icamp_private.campground_wayfinding_publications','SELECT') then
    raise exception 'Build180 must not expose wayfinding management rows to authenticated clients';
  end if;
end $verify_build180$;
