-- iCamp Build 035 verification.
do $verify$
begin
  if to_regclass('public.reservations') is null then raise exception 'reservations missing'; end if;
  if to_regclass('public.reservation_holds') is null then raise exception 'reservation_holds missing'; end if;
  if to_regclass('public.seasonal_assignments') is null then raise exception 'seasonal_assignments missing'; end if;
  if to_regprocedure('icamp_private.live_accommodation_availability(uuid,date,date)') is null then
    raise exception 'live availability function missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname='reservations_no_live_conflict' and not tgisinternal) then
    raise exception 'reservation concurrency trigger missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname='reservation_holds_no_live_conflict' and not tgisinternal) then
    raise exception 'hold concurrency trigger missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname='seasonal_assignments_no_live_conflict' and not tgisinternal) then
    raise exception 'seasonal concurrency trigger missing';
  end if;
  if has_table_privilege('anon','public.reservations','select') then raise exception 'anon must not directly read reservations'; end if;
  if has_table_privilege('authenticated','public.reservation_holds','select') then raise exception 'authenticated must not directly read holds'; end if;
end
$verify$;
