-- iCamp Build 065 hosted-advisor hardening verification.
do $verify$
declare
  index_name text;
begin
  foreach index_name in array array[
    'maintenance_work_orders_category_scope_fk_idx',
    'maintenance_work_orders_priority_scope_fk_idx',
    'maintenance_work_orders_section_scope_fk_idx',
    'maintenance_work_orders_asset_scope_fk_idx',
    'maintenance_work_orders_accommodation_scope_fk_idx',
    'maintenance_work_order_status_events_scope_work_order_fk_idx',
    'maintenance_work_order_notes_scope_work_order_fk_idx',
    'maintenance_work_order_media_scope_work_order_fk_idx',
    'maintenance_work_order_media_scope_asset_fk_idx',
    'maintenance_work_order_materials_scope_work_order_fk_idx',
    'maintenance_work_order_labor_scope_work_order_fk_idx'
  ]
  loop
    if to_regclass('public.' || index_name) is null then
      raise exception 'Build 065 advisor-hardening index % is missing', index_name;
    end if;
  end loop;
end
$verify$;
