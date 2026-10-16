-- iCamp Build 050 verification.
do $$
begin
  if to_regclass('public.reservation_check_outs') is null then
    raise exception 'Build 050 reservation_check_outs missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='reservation_check_outs_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 050 checkout evidence must remain append-only';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='reservation_check_outs'
      and policyname='reservation_check_outs_insert'
      and coalesce(with_check,'') like '%reservation.modify%'
  ) then
    raise exception 'Build 050 reservation.modify insert boundary missing';
  end if;

  if exists(select 1 from pg_roles where rolname='anon')
    and has_table_privilege(
      'anon',
      'public.reservation_check_outs',
      'select'
    ) then
    raise exception 'anon direct checkout access must remain denied';
  end if;

  if exists(select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege(
      'authenticated',
      'public.reservation_check_outs',
      'select'
    ) then
    raise exception 'authenticated direct checkout access must remain denied';
  end if;

  if has_table_privilege(
    'icamp_app',
    'public.reservation_check_outs',
    'update'
  ) or has_table_privilege(
    'icamp_app',
    'public.reservation_check_outs',
    'delete'
  ) then
    raise exception 'Build 050 evidence must not grant update/delete';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='reservation_check_outs_scope_reservation_fk_idx'
  ) or not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='reservation_check_outs_scope_check_in_fk_idx'
  ) or not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='reservation_check_outs_scope_accommodation_fk_idx'
  ) then
    raise exception 'Build 050 composite foreign-key indexes incomplete';
  end if;
end
$$;
