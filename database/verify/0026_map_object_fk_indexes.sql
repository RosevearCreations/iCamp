-- Build 023 foreign-key index closure verification.
\set ON_ERROR_STOP on

do $build023_fk_indexes$
declare
  expected text[] := array[
    'campground_map_object_bindings_object_scope_idx',
    'campground_map_object_bindings_image_scope_idx',
    'campground_map_object_bindings_layer_scope_idx',
    'campground_map_object_bindings_polygon_scope_idx',
    'campground_map_polygons_layer_scope_idx'
  ];
  missing text[];
begin
  select array_agg(name)
  into missing
  from unnest(expected) as name
  where to_regclass('icamp_private.' || name) is null;

  if missing is not null then
    raise exception 'Missing Build 023 foreign-key indexes: %', missing;
  end if;
end
$build023_fk_indexes$;
