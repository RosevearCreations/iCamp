-- Build 193: schema, privilege and source-integrity contract.
do $verify193$
declare t text;
begin
 foreach t in array array['seasonal_renewal_intents','seasonal_owner_tasks','seasonal_owner_task_events'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='icamp_private' and c.relname=t and c.relrowsecurity and c.relforcerowsecurity)
  then raise exception 'Build193 % must FORCE RLS',t; end if;
  if has_table_privilege('icamp_app',format('icamp_private.%I',t),'UPDATE')
    or has_table_privilege('icamp_app',format('icamp_private.%I',t),'DELETE')
  then raise exception 'Build193 % evidence must be immutable',t; end if;
  if (exists(select 1 from pg_roles where rolname='anon') and has_table_privilege('anon',format('icamp_private.%I',t),'SELECT'))
  or (exists(select 1 from pg_roles where rolname='authenticated') and has_table_privilege('authenticated',format('icamp_private.%I',t),'SELECT'))
  then raise exception 'Build193 % must not expose private evidence to guests',t; end if;
  if not exists(select 1 from pg_trigger where tgrelid=format('icamp_private.%I',t)::regclass and not tgisinternal and tgname=t||'_immutable')
  then raise exception 'Build193 % immutable guard missing',t; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='icamp_private.seasonal_renewal_intents'::regclass and tgname='seasonal_renewal_guard') then
  raise exception 'Build193 renewal stale-version guard missing'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='icamp_private.seasonal_owner_task_events'::regclass and tgname='seasonal_owner_task_event_guard') then
  raise exception 'Build193 independent owner review guard missing'; end if;
 if not exists(select 1 from icamp_private.permission_catalog where permission_key='seasonal.owner.review') then
  raise exception 'Build193 owner reviewer permission missing'; end if;
 if exists(select 1 from information_schema.columns where table_schema='icamp_private'
  and table_name='seasonal_renewal_intents' and column_name in ('payment_id','paid_at','renewal_authorized_at','notice_sent_at'))
  then raise exception 'Build193 must not add billing or outbound action fields'; end if;
end $verify193$;
