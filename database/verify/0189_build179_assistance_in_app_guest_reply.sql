do $verify_build179$
begin
  if not exists (select 1 from pg_class
    where oid='public.camper_assistance_case_events'::regclass
      and relrowsecurity and relforcerowsecurity) then
    raise exception 'Build 179 case events must retain FORCE RLS';
  end if;
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='camper_assistance_case_events'
      and policyname='camper_assistance_case_guest_reply_insert'
      and cmd='INSERT' and 'icamp_app'=any(roles)) then
    raise exception 'Build 179 guest reply insert policy missing';
  end if;
  if not exists (select 1 from pg_trigger where
    tgrelid='public.camper_assistance_case_events'::regclass
    and tgname='build179_guard_guest_reply' and not tgisinternal) then
    raise exception 'Build 179 guest reply ownership guard missing';
  end if;
  if not exists (select 1 from pg_indexes where
    schemaname='public' and indexname='camper_assistance_guest_reply_idempotency_idx') then
    raise exception 'Build 179 guest reply replay guard missing';
  end if;
  if exists (select 1 from pg_roles where rolname='anon') and
      has_table_privilege('anon','public.camper_assistance_case_events','INSERT') then
    raise exception 'Build 179 must not grant direct anonymous inserts';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') and
      has_table_privilege('authenticated','public.camper_assistance_case_events','INSERT') then
    raise exception 'Build 179 must not grant direct authenticated client inserts';
  end if;
end $verify_build179$;
