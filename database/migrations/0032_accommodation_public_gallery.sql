-- iCamp Build 028
-- Site/Cottage Public Gallery: Up to 10 Images.

create table public.accommodation_public_gallery_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  accommodation_id uuid not null,
  source_media_asset_id uuid not null
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  thumbnail_media_asset_id uuid not null
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  optimized_media_asset_id uuid not null
    references icamp_private.media_assets(id)
    on update cascade
    on delete restrict,
  caption text
    check (caption is null or char_length(trim(caption)) between 1 and 300),
  alt_text text not null
    check (char_length(trim(alt_text)) between 1 and 240),
  sort_order smallint not null
    check (sort_order between 1 and 10),
  is_hero boolean not null default false,
  is_active boolean not null default true,
  source_width integer not null
    check (source_width between 1 and 20000),
  source_height integer not null
    check (source_height between 1 and 20000),
  thumbnail_width integer not null
    check (thumbnail_width between 1 and 480),
  thumbnail_height integer not null
    check (thumbnail_height between 1 and 480),
  optimized_width integer not null
    check (optimized_width between 1 and 1800),
  optimized_height integer not null
    check (optimized_height between 1 and 1800),
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1
    check (row_version >= 1),
  constraint accommodation_public_gallery_parent_fk
    foreign key (organization_id, campground_id, accommodation_id)
    references public.accommodations(organization_id, campground_id, id)
    on update cascade
    on delete restrict,
  constraint accommodation_public_gallery_media_distinct
    check (
      source_media_asset_id <> thumbnail_media_asset_id
      and source_media_asset_id <> optimized_media_asset_id
      and thumbnail_media_asset_id <> optimized_media_asset_id
    )
);

create unique index accommodation_public_gallery_source_media_idx
  on public.accommodation_public_gallery_images (source_media_asset_id);

create unique index accommodation_public_gallery_thumbnail_media_idx
  on public.accommodation_public_gallery_images (thumbnail_media_asset_id);

create unique index accommodation_public_gallery_optimized_media_idx
  on public.accommodation_public_gallery_images (optimized_media_asset_id);

create unique index accommodation_public_gallery_one_hero_idx
  on public.accommodation_public_gallery_images (
    organization_id,
    campground_id,
    accommodation_id
  )
  where is_active and is_hero;

create index accommodation_public_gallery_scope_order_idx
  on public.accommodation_public_gallery_images (
    organization_id,
    campground_id,
    accommodation_id,
    is_active,
    sort_order,
    created_at
  );

create index accommodation_public_gallery_created_by_idx
  on public.accommodation_public_gallery_images (created_by_user_id)
  where created_by_user_id is not null;

create index accommodation_public_gallery_updated_by_idx
  on public.accommodation_public_gallery_images (updated_by_user_id)
  where updated_by_user_id is not null;

create or replace function icamp_private.validate_accommodation_public_gallery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  accommodation_kind text;
  valid_media_count integer;
  active_count integer;
begin
  select a.accommodation_kind
  into accommodation_kind
  from public.accommodations a
  where a.id = new.accommodation_id
    and a.organization_id = new.organization_id
    and a.campground_id = new.campground_id;

  if accommodation_kind is null then
    raise exception 'Gallery accommodation is unavailable or outside the campground';
  end if;

  if accommodation_kind not in ('campsite', 'rental_cottage') then
    raise exception 'Public gallery is limited to campsites and rental cottages';
  end if;

  select count(*)
  into valid_media_count
  from icamp_private.media_assets m
  where m.id = any(array[
      new.source_media_asset_id,
      new.thumbnail_media_asset_id,
      new.optimized_media_asset_id
    ])
    and m.organization_id = new.organization_id
    and m.campground_id = new.campground_id
    and m.classification = 'public'
    and m.media_kind = 'image'
    and m.validation_state = 'validated'
    and m.lifecycle_state = 'active';

  if valid_media_count <> 3 then
    raise exception 'Gallery media must be active validated public images in the same campground';
  end if;

  if new.is_active then
    select count(*)
    into active_count
    from public.accommodation_public_gallery_images g
    where g.organization_id = new.organization_id
      and g.campground_id = new.campground_id
      and g.accommodation_id = new.accommodation_id
      and g.is_active
      and g.id <> new.id;

    if active_count >= 10 then
      raise exception 'An accommodation may have at most 10 active public gallery images';
    end if;
  end if;

  return new;
end;
$$;

create trigger accommodation_public_gallery_validate
before insert or update of
  organization_id,
  campground_id,
  accommodation_id,
  source_media_asset_id,
  thumbnail_media_asset_id,
  optimized_media_asset_id,
  is_active
on public.accommodation_public_gallery_images
for each row execute function icamp_private.validate_accommodation_public_gallery();

create trigger accommodation_public_gallery_touch_row
before update on public.accommodation_public_gallery_images
for each row execute function icamp_private.touch_row();

alter table public.accommodation_public_gallery_images enable row level security;
alter table public.accommodation_public_gallery_images force row level security;

revoke all on public.accommodation_public_gallery_images from public;

do $build028_permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.accommodation_public_gallery_images from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.accommodation_public_gallery_images from authenticated';
  end if;
end
$build028_permissions$;

grant select, insert, update on public.accommodation_public_gallery_images to icamp_app;

create policy accommodation_public_gallery_read
on public.accommodation_public_gallery_images
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.read')
  or icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy accommodation_public_gallery_manage_insert
on public.accommodation_public_gallery_images
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

create policy accommodation_public_gallery_manage_update
on public.accommodation_public_gallery_images
for update
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
)
with check (
  icamp_private.has_campground_permission(campground_id, 'accommodation.manage')
);

comment on table public.accommodation_public_gallery_images is
  'Build 028 public campsite/rental-cottage gallery metadata. Source, thumbnail and optimized objects reuse Build 008 secure media storage; internal maintenance media remains separate.';

comment on column public.accommodation_public_gallery_images.alt_text is
  'Required public-facing alternative text for accessible gallery rendering.';

comment on column public.accommodation_public_gallery_images.is_hero is
  'Marks the single active hero image for an accommodation. Ordering remains controlled by sort_order.';
