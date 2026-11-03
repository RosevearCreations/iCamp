do $verify197$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname='guest_privacy_requests' and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'Build197 privacy requests must FORCE RLS'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname='guest_privacy_request_events' and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'Build197 privacy events must FORCE RLS'; end if;
 if exists(select 1 from pg_roles where rolname='anon') and
   has_table_privilege('anon','icamp_private.guest_privacy_requests','select')
 then raise exception 'Anonymous role can read privacy requests'; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') and
   has_table_privilege('authenticated','icamp_private.guest_privacy_request_events','select')
 then raise exception 'Auth API role can read privacy events'; end if;
 if (select count(*) from pg_policies where schemaname='icamp_private'
   and tablename in ('guest_privacy_requests','guest_privacy_request_events'))<>4
 then raise exception 'Build197 private guest/staff RLS policies incomplete'; end if;
 if (select count(*) from pg_trigger where tgname in ('guest_privacy_requests_immutable',
   'guest_privacy_events_immutable','guest_privacy_event_insert_guard') and not tgisinternal)<>3
 then raise exception 'Build197 append-only and transition guards missing'; end if;
end $verify197$;
