do $verify_build176$
begin
  if to_regclass('public.guest_reservation_review_requests') is null then
    raise exception 'Build 176 review request ledger is missing';
  end if;
  if not exists (select 1 from pg_class
    where oid='public.guest_reservation_review_requests'::regclass
      and relrowsecurity and relforcerowsecurity) then
    raise exception 'Build 176 guest requests require forced RLS';
  end if;
  if (select count(*) from pg_policies where schemaname='public'
    and tablename='guest_reservation_review_requests'
    and 'icamp_app'=any(roles)) <> 3 then
    raise exception 'Build 176 requires owner/staff read, owner insert, owner withdrawal policies';
  end if;
  if exists (select 1 from pg_roles where rolname='anon')
    and has_table_privilege('anon','public.guest_reservation_review_requests','select') then
    raise exception 'Anonymous direct review-request read must be denied';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege('authenticated','public.guest_reservation_review_requests','select') then
    raise exception 'Direct Supabase authenticated review-request read must be denied';
  end if;
  if not exists (select 1 from pg_trigger
    where tgname='build176_guard_guest_review_request' and not tgisinternal) then
    raise exception 'Build 176 immutable-withdrawal guard is missing';
  end if;
  if not exists (select 1 from pg_indexes
    where schemaname='public' and indexname='guest_review_requests_one_active_kind_idx') then
    raise exception 'Build 176 duplicate active request guard is missing';
  end if;
end $verify_build176$;
