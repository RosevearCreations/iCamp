-- iCamp Build 049 verification
do $$
begin
  if to_regclass('public.reservation_check_ins') is null then
    raise exception 'Build 049 reservation_check_ins missing';
  end if;

  if to_regclass('public.reservation_check_in_requests') is null then
    raise exception 'Build 049 reservation_check_in_requests missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='reservation_check_ins_append_only'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgname='reservation_check_in_requests_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 049 check-in evidence must remain append-only';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='reservation_check_ins'
      and policyname='reservation_check_ins_insert'
      and coalesce(with_check,'') like '%reservation.modify%'
  ) then
    raise exception 'Build 049 reservation.modify insert boundary missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='reservation_check_ins_guest_profile_fk_idx'
  ) or not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='reservation_check_in_requests_reservation_fk_idx'
  ) then
    raise exception 'Build 049 foreign-key covering indexes missing';
  end if;

  if exists(select 1 from pg_roles where rolname='anon')
    and has_table_privilege('anon','public.reservation_check_ins','select') then
    raise exception 'anon direct check-in access must remain denied';
  end if;

  if exists(select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege('authenticated','public.reservation_check_ins','select') then
    raise exception 'authenticated direct check-in access must remain denied';
  end if;

  if has_table_privilege('icamp_app','public.reservation_check_ins','update')
    or has_table_privilege('icamp_app','public.reservation_check_ins','delete')
    or has_table_privilege('icamp_app','public.reservation_check_in_requests','update')
    or has_table_privilege('icamp_app','public.reservation_check_in_requests','delete') then
    raise exception 'Build 049 evidence must not grant update/delete to icamp_app';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='reservation_check_ins'
      and column_name='credential_handoff_state'
  ) then
    raise exception 'Build 049 access-credential handoff boundary missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='reservation_check_ins'
      and column_name='balance_override_used'
  ) then
    raise exception 'Build 049 balance verification evidence missing';
  end if;
end
$$;
