-- iCamp Build 035 advisor hardening verification.
do $verify$
declare
  expected text[] := array[
    'reservations_accommodation_scope_fk_idx',
    'reservations_created_by_fk_idx',
    'reservations_updated_by_fk_idx',
    'reservation_holds_accommodation_scope_fk_idx',
    'reservation_holds_created_by_fk_idx',
    'reservation_holds_updated_by_fk_idx',
    'seasonal_assignments_accommodation_scope_fk_idx',
    'seasonal_assignments_created_by_fk_idx',
    'seasonal_assignments_updated_by_fk_idx'
  ];
  index_name text;
begin
  foreach index_name in array expected loop
    if to_regclass('public.' || index_name) is null then
      raise exception 'Build 035 advisor index missing: %', index_name;
    end if;
  end loop;
end
$verify$;
