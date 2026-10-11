-- iCamp Build 023 performance closure.
-- Cover composite foreign keys introduced by canonical map object binding and
-- the Build 022 polygon-to-layer scope foreign key.

create index campground_map_object_bindings_object_scope_idx
  on icamp_private.campground_map_object_bindings (
    organization_id,
    campground_id,
    map_object_id
  );

create index campground_map_object_bindings_image_scope_idx
  on icamp_private.campground_map_object_bindings (
    organization_id,
    campground_id,
    map_image_version_id
  );

create index campground_map_object_bindings_layer_scope_idx
  on icamp_private.campground_map_object_bindings (
    organization_id,
    campground_id,
    layer_id
  );

create index campground_map_object_bindings_polygon_scope_idx
  on icamp_private.campground_map_object_bindings (
    organization_id,
    campground_id,
    polygon_id
  )
  where polygon_id is not null;

create index campground_map_polygons_layer_scope_idx
  on icamp_private.campground_map_polygons (
    organization_id,
    campground_id,
    layer_id
  );
