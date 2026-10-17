-- iCamp Build 053 verification
do $$
begin
  if to_regclass('public.road_vehicle_registrations') is null then
    raise exception 'Build 053 road_vehicle_registrations missing';
  end if;

  if to_regclass('public.road_vehicle_registration_events') is null then
    raise exception 'Build 053 road_vehicle_registration_events missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='road_vehicle_registrations_validate'
      and not tgisinternal
  ) then
    raise exception 'Build 053 registration scope/identity guard missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='road_vehicle_registration_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'Build 053 registration events must remain append-only';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='road_vehicle_registrations'
      and policyname='road_vehicle_registrations_read'
      and coalesce(qual,'') like '%vehicle.read%'
  ) then
    raise exception 'Build 053 vehicle.read RLS boundary missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='road_vehicle_registrations'
      and policyname='road_vehicle_registrations_insert'
      and coalesce(with_check,'') like '%vehicle.register%'
  ) then
    raise exception 'Build 053 vehicle.register insert boundary missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='road_vehicle_registrations'
      and policyname='road_vehicle_registrations_update'
      and coalesce(with_check,'') like '%vehicle.register%'
  ) then
    raise exception 'Build 053 vehicle.register update boundary missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='road_vehicle_registrations_reservation_fk_idx'
  ) or not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='road_vehicle_registrations_host_accommodation_fk_idx'
  ) or not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and indexname='road_vehicle_registration_events_registration_fk_idx'
  ) then
    raise exception 'Build 053 foreign-key covering indexes missing';
  end if;

  if exists(select 1 from pg_roles where rolname='anon')
    and has_table_privilege('anon','public.road_vehicle_registrations','select') then
    raise exception 'anon direct road-vehicle access must remain denied';
  end if;

  if exists(select 1 from pg_roles where rolname='authenticated')
    and has_table_privilege('authenticated','public.road_vehicle_registrations','select') then
    raise exception 'authenticated direct road-vehicle access must remain denied';
  end if;

  if has_table_privilege('icamp_app','public.road_vehicle_registrations','delete')
    or has_table_privilege('icamp_app','public.road_vehicle_registration_events','update')
    or has_table_privilege('icamp_app','public.road_vehicle_registration_events','delete') then
    raise exception 'Build 053 evidence lifecycle grants are too broad';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='road_vehicle_registrations'
      and column_name='plate_jurisdiction'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='road_vehicle_registrations'
      and column_name='host_accommodation_id'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='road_vehicle_registrations'
      and column_name='valid_until'
  ) then
    raise exception 'Build 053 plate, host accommodation or validity fields missing';
  end if;
end
$$;
