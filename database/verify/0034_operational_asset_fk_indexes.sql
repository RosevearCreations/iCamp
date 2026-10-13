-- iCamp Build 029 FK index hardening verification.
do $verify$
begin
  if to_regclass('public.operational_assets_map_object_scope_fk_idx') is null then
    raise exception 'operational_assets map-object FK covering index is missing';
  end if;
  if to_regclass('public.operational_facilities_asset_scope_fk_idx') is null then
    raise exception 'operational_facilities asset FK covering index is missing';
  end if;
  if to_regclass('public.operational_equipment_asset_scope_fk_idx') is null then
    raise exception 'operational_equipment asset FK covering index is missing';
  end if;
end
$verify$;
