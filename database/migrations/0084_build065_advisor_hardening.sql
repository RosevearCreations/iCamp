-- iCamp Build 065 hosted-advisor hardening.
-- Cover the campground-scoped foreign keys reported by Supabase after the
-- Work Order Engine migration.

create index maintenance_work_orders_category_scope_fk_idx
  on public.maintenance_work_orders(
    organization_id,
    campground_id,
    category_id
  );

create index maintenance_work_orders_priority_scope_fk_idx
  on public.maintenance_work_orders(
    organization_id,
    campground_id,
    priority_policy_id
  );

create index maintenance_work_orders_section_scope_fk_idx
  on public.maintenance_work_orders(
    organization_id,
    campground_id,
    section_id
  );

create index maintenance_work_orders_asset_scope_fk_idx
  on public.maintenance_work_orders(
    organization_id,
    campground_id,
    asset_id
  );

create index maintenance_work_orders_accommodation_scope_fk_idx
  on public.maintenance_work_orders(
    organization_id,
    campground_id,
    accommodation_id
  );

create index maintenance_work_order_status_events_scope_work_order_fk_idx
  on public.maintenance_work_order_status_events(
    organization_id,
    campground_id,
    work_order_id
  );

create index maintenance_work_order_notes_scope_work_order_fk_idx
  on public.maintenance_work_order_notes(
    organization_id,
    campground_id,
    work_order_id
  );

create index maintenance_work_order_media_scope_work_order_fk_idx
  on public.maintenance_work_order_media(
    organization_id,
    campground_id,
    work_order_id
  );

create index maintenance_work_order_media_scope_asset_fk_idx
  on public.maintenance_work_order_media(
    organization_id,
    campground_id,
    media_asset_id
  );

create index maintenance_work_order_materials_scope_work_order_fk_idx
  on public.maintenance_work_order_materials(
    organization_id,
    campground_id,
    work_order_id
  );

create index maintenance_work_order_labor_scope_work_order_fk_idx
  on public.maintenance_work_order_labor(
    organization_id,
    campground_id,
    work_order_id
  );
