do $verify$ declare p text; begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='garbage_paid_tags' and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'Paid tag ledger must have forced RLS'; end if;
 foreach p in array array['garbage.tags.sell','garbage.tags.redeem'] loop
  if not exists(select 1 from icamp_private.permission_catalog where permission_key=p)
   then raise exception 'Missing permission %',p; end if;
 end loop;
 if not exists(select 1 from pg_indexes where schemaname='public'
   and indexname='garbage_paid_tags_pickup_once_idx') then
  raise exception 'One pickup redemption must be unique'; end if;
 if exists(select 1 from pg_roles where rolname='anon') and
  has_table_privilege('anon','public.garbage_paid_tags','SELECT') then
  raise exception 'Public direct read forbidden'; end if;
end $verify$;
