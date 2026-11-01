-- Build 180: explicitly reviewed, version-pinned public amenity wayfinding.
-- A private canonical map object is never public by default.
create table icamp_private.campground_wayfinding_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  map_object_id uuid not null,
  map_image_version_id uuid,
  is_published boolean not null default false,
  public_description text not null default ''
    check (char_length(public_description) <= 600),
  accessibility_note text not null default ''
    check (char_length(accessibility_note) <= 400),
  landmark_hint text not null default ''
    check (char_length(landmark_hint) <= 500),
  reviewed_by_user_id uuid references icamp_private.user_accounts(id)
    on update cascade on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint campground_wayfinding_object_fk
    foreign key (organization_id,campground_id,map_object_id)
    references icamp_private.campground_map_objects(organization_id,campground_id,id)
    on update cascade on delete restrict,
  constraint campground_wayfinding_map_fk
    foreign key (organization_id,campground_id,map_image_version_id)
    references icamp_private.campground_map_image_versions(organization_id,campground_id,id)
    on update cascade on delete restrict,
  constraint campground_wayfinding_object_unique unique (map_object_id),
  constraint campground_wayfinding_review_check check (
    not is_published or (
      map_image_version_id is not null
      and reviewed_at is not null
      and char_length(trim(public_description)) > 0
    )
  )
);

create index campground_wayfinding_public_idx
  on icamp_private.campground_wayfinding_publications
  (campground_id,map_image_version_id,map_object_id)
  where is_published;

create trigger campground_wayfinding_touch_row before update
  on icamp_private.campground_wayfinding_publications
  for each row execute function icamp_private.touch_row();

create function icamp_private.guard_wayfinding_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.is_published and not exists (
    select 1
    from icamp_private.campground_map_objects o
    join icamp_private.campground_map_object_bindings b
      on b.map_object_id=o.id
     and b.organization_id=o.organization_id
     and b.campground_id=o.campground_id
    join icamp_private.campground_map_layers l
      on l.id=b.layer_id and l.campground_id=o.campground_id
    join icamp_private.campground_map_image_versions v
      on v.id=b.map_image_version_id
     and v.campground_id=o.campground_id
    where o.id=new.map_object_id
      and o.organization_id=new.organization_id
      and o.campground_id=new.campground_id
      and o.lifecycle_state='active'
      and o.object_kind in ('pool','washroom','dock','building')
      and b.geometry_kind='point'
      and b.point_geometry is not null
      and b.map_image_version_id=new.map_image_version_id
      and l.layer_key='amenities' and l.is_enabled
      and v.is_published
  ) then
    raise exception 'Wayfinding requires an active amenity point on the published map';
  end if;
  return new;
end $$;

revoke all on function icamp_private.guard_wayfinding_publication() from public;
create trigger campground_wayfinding_publication_guard
  before insert or update on icamp_private.campground_wayfinding_publications
  for each row execute function icamp_private.guard_wayfinding_publication();

alter table icamp_private.campground_wayfinding_publications enable row level security;
alter table icamp_private.campground_wayfinding_publications force row level security;
create policy campground_wayfinding_no_direct_app_access
  on icamp_private.campground_wayfinding_publications
  for all to icamp_app using (false) with check (false);
revoke all on icamp_private.campground_wayfinding_publications from public;
do $build180_privileges$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on icamp_private.campground_wayfinding_publications from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on icamp_private.campground_wayfinding_publications from authenticated';
  end if;
end $build180_privileges$;

comment on table icamp_private.campground_wayfinding_publications is
  'Explicit staff-reviewed, map-version-pinned public amenity narrative. Unpublished by default; no turn-by-turn routing or access authorization.';
