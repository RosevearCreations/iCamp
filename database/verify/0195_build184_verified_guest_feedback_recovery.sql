do $verify_build184$
declare tablename text;
begin
  foreach tablename in array array['verified_guest_feedback','guest_feedback_moderation_events','guest_feedback_recovery_events'] loop
    if not exists (select 1 from pg_class where oid=('icamp_private.'||tablename)::regclass
      and relrowsecurity and relforcerowsecurity) then
      raise exception 'Build184 % requires forced RLS',tablename;
    end if;
    if exists(select 1 from pg_roles where rolname='anon') and
      has_table_privilege('anon','icamp_private.'||tablename,'SELECT') then
      raise exception 'Build184 anonymous access to %',tablename;
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') and
      has_table_privilege('authenticated','icamp_private.'||tablename,'INSERT') then
      raise exception 'Build184 direct client write to %',tablename;
    end if;
  end loop;
  if not exists(select 1 from pg_trigger where tgrelid='icamp_private.verified_guest_feedback'::regclass
    and tgname='verified_feedback_guard' and not tgisinternal) then
    raise exception 'Build184 completed-stay guest guard absent';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='icamp_private'
    and indexname='verified_feedback_public_idx') then
    raise exception 'Build184 explicit-consent publication index absent';
  end if;
end $verify_build184$;
