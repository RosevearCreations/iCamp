-- Build 228: separately reviewed, opt-in campground service publication.
-- Existing map/wayfinding publication remains valid without service details.
alter table icamp_private.campground_wayfinding_publications
  add column service_is_published boolean not null default false,
  add column service_operating_status text not null default 'unknown'
    check (service_operating_status in ('unknown','reported_open','reported_closed')),
  add column service_hours_summary text not null default ''
    check (char_length(service_hours_summary) <= 450),
  add column service_accessibility_details text not null default ''
    check (char_length(service_accessibility_details) <= 500),
  add column service_reviewed_at timestamptz,
  add column service_reviewed_by_user_id uuid
    references icamp_private.user_accounts(id) on update cascade on delete set null,
  add constraint campground_wayfinding_service_review_check check (
    not service_is_published or (
      is_published and map_image_version_id is not null
      and service_reviewed_at is not null
      and service_reviewed_by_user_id is not null
      and (service_operating_status <> 'unknown'
        or char_length(trim(service_hours_summary)) > 0
        or char_length(trim(service_accessibility_details)) > 0)
    )
  );

-- If the underlying waypoint is withdrawn or repinned to a new map image,
-- the previously verified service publication automatically expires.
create function icamp_private.expire_relocated_amenity_service()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not new.is_published
     or new.map_image_version_id is distinct from old.map_image_version_id then
    new.service_is_published := false;
    new.service_reviewed_at := null;
    new.service_reviewed_by_user_id := null;
  end if;
  return new;
end $$;
revoke all on function icamp_private.expire_relocated_amenity_service() from public;
create trigger campground_wayfinding_service_expiry
  before update on icamp_private.campground_wayfinding_publications
  for each row execute function icamp_private.expire_relocated_amenity_service();

comment on column icamp_private.campground_wayfinding_publications.service_operating_status is
  'Campground-reported status at review time, never live clearance or a device signal.';
comment on column icamp_private.campground_wayfinding_publications.service_hours_summary is
  'Owner-reviewed operating-hours text, shown with review time and no promise of live availability.';
