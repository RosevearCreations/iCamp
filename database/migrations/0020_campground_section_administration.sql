-- iCamp Build 017
-- Campground, section and subsection administration.

alter table public.campground_sections
  add column settings jsonb not null
  default '{"operatingMode":"standard","quietHoursStart":null,"quietHoursEnd":null,"staffNote":""}'::jsonb;

alter table public.campground_sections
  add constraint campground_sections_settings_object_check
  check (
    jsonb_typeof(settings) = 'object'
    and pg_column_size(settings) <= 8192
  );

grant insert on public.campground_sections to icamp_app;
grant insert on public.campground_subsections to icamp_app;

create policy campground_sections_configuration_insert
on public.campground_sections
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
);

create policy campground_subsections_configuration_insert
on public.campground_subsections
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(
    campground_id,
    'campground.configuration'
  )
);

comment on column public.campground_sections.settings is
  'Bounded section-specific administrative settings. Build 017 settings are non-authoritative for later booking, pricing, access-control and map rule engines.';
