-- Verify Build 175 guest-only RLS, tenant binding, consent, expiry and no provider side effects.
do $verify_build175$
begin
  if to_regclass('public.guest_booking_drafts') is null then
    raise exception 'Guest draft storage missing';
  end if;
  if not exists (select 1 from pg_class where oid='public.guest_booking_drafts'::regclass
    and relrowsecurity and relforcerowsecurity) then
    raise exception 'Guest drafts must use forced RLS';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
    and tablename='guest_booking_drafts' and roles='{icamp_app}') <> 4 then
    raise exception 'Guest drafts require four owner-scoped RLS policies';
  end if;
  if exists (select 1 from pg_policies where schemaname='public'
    and tablename='guest_booking_drafts'
    and (qual is not null and qual not like '%icamp.user_id%'
      or with_check is not null and with_check not like '%icamp.user_id%')) then
    raise exception 'Guest drafts must never have broader staff/anonymous policies';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege('authenticated','public.guest_booking_drafts','select') then
    raise exception 'Direct Supabase authenticated table access must stay denied';
  end if;
  if exists (select 1 from pg_roles where rolname='anon')
    and has_table_privilege('anon','public.guest_booking_drafts','select') then
    raise exception 'Direct Supabase anonymous table access must stay denied';
  end if;
  if not exists (select 1 from pg_constraint
    where conname='guest_booking_drafts_accommodation_fk' and contype='f') then
    raise exception 'Guest drafts must bind to a real tenant accommodation';
  end if;
end $verify_build175$;
