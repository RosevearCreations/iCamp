-- iCamp Build 036 verification.
do $verify$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campgrounds'
      and column_name = 'temporary_hold_minutes'
  ) then
    raise exception 'temporary hold duration setting missing';
  end if;

  if to_regprocedure('icamp_private.create_reservation_hold(uuid,uuid,date,date,text)') is null then
    raise exception 'atomic hold creation function missing';
  end if;
  if to_regprocedure('icamp_private.release_reservation_hold(uuid,uuid,text)') is null then
    raise exception 'hold release function missing';
  end if;
  if to_regprocedure('icamp_private.expire_reservation_holds(uuid)') is null then
    raise exception 'hold expiry function missing';
  end if;

  if not has_table_privilege('icamp_app','public.reservation_holds','insert') then
    raise exception 'icamp_app cannot create reservation holds';
  end if;
  if not has_table_privilege('icamp_app','public.reservation_holds','update') then
    raise exception 'icamp_app cannot release/expire reservation holds';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reservation_holds'
      and policyname = 'reservation_holds_write'
  ) then
    raise exception 'reservation_holds_write policy missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reservation_holds'
      and policyname = 'reservation_holds_update'
  ) then
    raise exception 'reservation_holds_update policy missing';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
    and has_table_privilege('anon','public.reservation_holds','insert') then
    raise exception 'anon must not directly create reservation holds';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
    and has_table_privilege('authenticated','public.reservation_holds','update') then
    raise exception 'authenticated must not directly mutate reservation holds';
  end if;
end
$verify$;
