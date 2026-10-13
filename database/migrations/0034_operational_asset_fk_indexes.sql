-- iCamp Build 029 hosted advisor hardening.
-- Cover the three composite foreign keys reported by Supabase Performance Advisor.

create index operational_assets_map_object_scope_fk_idx
  on public.operational_assets (
    organization_id,
    campground_id,
    map_object_id
  );

create index operational_facilities_asset_scope_fk_idx
  on public.operational_facilities (
    organization_id,
    campground_id,
    asset_id
  );

create index operational_equipment_asset_scope_fk_idx
  on public.operational_equipment (
    organization_id,
    campground_id,
    asset_id
  );
