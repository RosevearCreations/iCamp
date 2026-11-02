do $verify_build183$
declare name text;
begin
  foreach name in array array['store_catalog_products','guest_store_cart_drafts','guest_store_cart_lines'] loop
    if not exists (select 1 from pg_class where oid=('icamp_private.'||name)::regclass
      and relrowsecurity and relforcerowsecurity) then
      raise exception 'Build183 % must force RLS',name;
    end if;
    if exists(select 1 from pg_roles where rolname='anon') and
      has_table_privilege('anon','icamp_private.'||name,'SELECT') then
      raise exception 'Build183 % unexpectedly grants anonymous read',name;
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') and
      has_table_privilege('authenticated','icamp_private.'||name,'INSERT') then
      raise exception 'Build183 % unexpectedly grants client write',name;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid='icamp_private.guest_store_cart_drafts'::regclass
    and tgname='guest_store_cart_guard' and not tgisinternal) then
    raise exception 'Build183 owned-stay delivery validation trigger absent';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='icamp_private'
    and indexname='guest_store_cart_review_idx') then
    raise exception 'Build183 staff review index absent';
  end if;
end $verify_build183$;
