-- Build 194: command views must be private, actor-scoped and preferences-only.
do $verify194$
declare
  t text:='management_command_views';
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='icamp_private' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity)
  then raise exception 'Build194 command views must FORCE RLS'; end if;
  if (exists(select 1 from pg_roles where rolname='anon') and
     has_table_privilege('anon','icamp_private.management_command_views','SELECT'))
     or (exists(select 1 from pg_roles where rolname='authenticated') and
     has_table_privilege('authenticated','icamp_private.management_command_views','SELECT'))
  then raise exception 'Build194 private command views exposed to guest/API roles'; end if;
  if not exists(select 1 from pg_trigger
    where tgrelid='icamp_private.management_command_views'::regclass
      and tgname='management_command_views_guard_insert_update' and not tgisinternal)
  then raise exception 'Build194 saved view actor/campground guard missing'; end if;
  if not exists(select 1 from pg_indexes
    where schemaname='icamp_private' and indexname='management_command_views_one_default')
  then raise exception 'Build194 one-default-view protection missing'; end if;
  if (select count(*) from pg_policies where schemaname='icamp_private'
    and tablename='management_command_views' and 'icamp_app'=any(roles))<>4
  then raise exception 'Build194 RLS read/insert/update/delete policies missing'; end if;
  if exists(select 1 from information_schema.columns where table_schema='icamp_private'
    and table_name='management_command_views'
    and column_name in ('guest_name','guest_email','payment_amount','booking_total','financial_source_data'))
  then raise exception 'Build194 must store preferences, never source metrics or PII'; end if;
end $verify194$;
