-- iCamp Build 044 verification
-- Reservation Management Console.

do $verify_build044$
declare
  state_rls boolean;
  state_force boolean;
  history_rls boolean;
  history_force boolean;
begin
  select relrowsecurity, relforcerowsecurity
    into state_rls, state_force
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reservation_management_state';

  select relrowsecurity, relforcerowsecurity
    into history_rls, history_force
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reservation_change_history';

  if not coalesce(state_rls, false) or not coalesce(state_force, false) then
    raise exception 'Build 044 reservation management state must FORCE RLS';
  end if;

  if not coalesce(history_rls, false) or not coalesce(history_force, false) then
    raise exception 'Build 044 reservation change history must FORCE RLS';
  end if;

  if has_table_privilege('icamp_app', 'public.reservation_change_history', 'UPDATE')
     or has_table_privilege('icamp_app', 'public.reservation_change_history', 'DELETE') then
    raise exception 'Build 044 reservation change history must remain append-only';
  end if;

  if not has_table_privilege('icamp_app', 'public.reservation_change_history', 'SELECT')
     or not has_table_privilege('icamp_app', 'public.reservation_change_history', 'INSERT') then
    raise exception 'Build 044 reservation change history requires authorized read/append access';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reservation_management_state_reservation_unique'
  ) then
    raise exception 'Build 044 must keep one current management state per reservation';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reservation_change_history_sequence_unique'
  ) then
    raise exception 'Build 044 must sequence each reservation change exactly once';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'reservation_management_state_scope_fk_idx'
  ) then
    raise exception 'Build 044 management-state reservation FK index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'reservation_change_history_scope_fk_idx'
  ) then
    raise exception 'Build 044 change-history reservation FK index is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'reservation_change_history_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 044 append-only history trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'reservations_move_bump_availability_revision'
      and not tgisinternal
  ) then
    raise exception 'Build 044 reservation move availability revision trigger is missing';
  end if;

end
$verify_build044$;
