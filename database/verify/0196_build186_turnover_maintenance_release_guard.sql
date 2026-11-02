do $verify_build186$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.maintenance_work_orders'::regclass
      and tgname='maintenance_work_orders_serialize_accommodation_release'
      and not tgisinternal
  ) then
    raise exception 'Build 186 concurrent work-order release lock missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.accommodations'::regclass
      and tgname='accommodations_guard_unresolved_maintenance_release'
      and not tgisinternal
  ) then
    raise exception 'Build 186 accommodation maintenance release guard missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='maintenance_work_orders_open_accommodation_release_idx'
  ) then
    raise exception 'Build 186 unresolved maintenance index missing';
  end if;
end $verify_build186$;
