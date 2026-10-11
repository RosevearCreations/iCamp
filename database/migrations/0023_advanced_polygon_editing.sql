-- iCamp Build 021
-- Advanced Polygon Editing lifecycle state and duplicate provenance.

alter table icamp_private.campground_map_polygons
  add column is_locked boolean not null default false,
  add column is_hidden boolean not null default false,
  add column archived_at timestamptz,
  add column archived_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  add column duplicated_from_polygon_id uuid
    references icamp_private.campground_map_polygons(id)
    on update cascade
    on delete set null;

create index campground_map_polygons_active_visibility_idx
  on icamp_private.campground_map_polygons (
    campground_id,
    map_image_version_id,
    is_hidden,
    updated_at desc
  )
  where archived_at is null;

create index campground_map_polygons_archived_idx
  on icamp_private.campground_map_polygons (
    campground_id,
    map_image_version_id,
    archived_at desc
  )
  where archived_at is not null;

create index campground_map_polygons_duplicate_source_idx
  on icamp_private.campground_map_polygons (duplicated_from_polygon_id)
  where duplicated_from_polygon_id is not null;

create index campground_map_polygons_archived_by_idx
  on icamp_private.campground_map_polygons (archived_by_user_id)
  where archived_by_user_id is not null;

comment on column icamp_private.campground_map_polygons.is_locked is
  'Prevents geometry/label editing until explicitly unlocked by an authorized map manager.';
comment on column icamp_private.campground_map_polygons.is_hidden is
  'Suppresses normal map rendering without removing or archiving polygon history.';
comment on column icamp_private.campground_map_polygons.archived_at is
  'Soft-archive timestamp. Archived polygons remain recoverable for management and audit history.';
comment on column icamp_private.campground_map_polygons.duplicated_from_polygon_id is
  'Optional provenance pointer to the polygon copied by the Build 021 duplicate operation.';
