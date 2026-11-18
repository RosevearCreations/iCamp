-- Build 263: test protected staff-only planned sessions and immutable boundaries.
do $verify$
declare
  table_oid oid;
begin
  table_oid := to_regclass('icamp_private.rental_sessions263');
  if table_oid is null then raise exception 'Build263 sessions table missing'; end if;
  if not exists(select 1 from pg_class where oid=table_oid
    and relrowsecurity and relforcerowsecurity) then
    raise exception 'Build263 sessions table missing FORCE RLS';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid=table_oid
    and tgname='rental_session263_guard' and not tgisinternal) then
    raise exception 'Build263 staff guard missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='icamp_private'
    and tablename='rental_sessions263' and policyname='rental_sessions263_no_direct_client')
  then raise exception 'Build263 deny-direct-client policy missing'; end if;
  if has_table_privilege('icamp_app','icamp_private.rental_sessions263','SELECT')
    or has_table_privilege('icamp_app','icamp_private.rental_sessions263','INSERT')
    or has_table_privilege('icamp_app','icamp_private.rental_sessions263','UPDATE')
    or has_table_privilege('icamp_app','icamp_private.rental_sessions263','DELETE')
  then raise exception 'Build263 table must deny app role direct grants'; end if;
end $verify$;
