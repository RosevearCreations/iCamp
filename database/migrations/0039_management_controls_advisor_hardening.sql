-- iCamp Build 031 advisor hardening.
-- Close Supabase performance advisor findings introduced by migration 0038.

create index management_restrictions_accommodation_scope_fk_idx
  on public.management_restrictions (
    organization_id,
    campground_id,
    accommodation_id
  );

create index management_restrictions_asset_scope_fk_idx
  on public.management_restrictions (
    organization_id,
    campground_id,
    asset_id
  );

create index management_restrictions_section_scope_fk_idx
  on public.management_restrictions (
    organization_id,
    campground_id,
    section_id
  );

create index management_restrictions_supersedes_idx
  on public.management_restrictions (supersedes_restriction_id);

create index campground_map_publication_events_from_fk_idx
  on icamp_private.campground_map_publication_events (
    organization_id,
    campground_id,
    from_map_version_id
  );

create index campground_map_publication_events_to_fk_idx
  on icamp_private.campground_map_publication_events (
    organization_id,
    campground_id,
    to_map_version_id
  );

alter policy accommodations_read
on public.accommodations
using (
  icamp_private.has_campground_permission(
    campground_id,
    'accommodation.read'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'accommodation.manage'
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

drop policy accommodations_management_operations_read
on public.accommodations;

alter policy operational_assets_read
on public.operational_assets
using (
  (
    asset_class = 'facility'
    and (
      icamp_private.has_campground_permission(
        campground_id,
        'asset.read'
      )
      or icamp_private.has_campground_permission(
        campground_id,
        'asset.manage'
      )
    )
  )
  or
  (
    asset_class = 'equipment'
    and (
      icamp_private.has_campground_permission(
        campground_id,
        'equipment.read'
      )
      or icamp_private.has_campground_permission(
        campground_id,
        'equipment.manage'
      )
    )
  )
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

drop policy operational_assets_management_operations_read
on public.operational_assets;

alter policy campground_sections_assigned_select
on public.campground_sections
using (
  icamp_private.has_campground_assignment(campground_id)
  or icamp_private.has_campground_permission(
    campground_id,
    'campground.operations.manage'
  )
);

drop policy campground_sections_management_operations_read
on public.campground_sections;
