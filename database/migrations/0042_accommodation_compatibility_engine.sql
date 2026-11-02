-- iCamp Build 034
-- Accommodation Compatibility Engine.

alter table public.campsites
  add column accessible_site boolean not null default false,
  add column pets_allowed boolean not null default true,
  add column max_pets smallint not null default 2
    check (max_pets between 0 and 20),
  add constraint campsites_pet_policy_check
    check (
      (pets_allowed and max_pets >= 1)
      or (not pets_allowed and max_pets = 0)
    );

alter table public.rental_cottages
  add column pets_allowed boolean not null default false,
  add column max_pets smallint not null default 0
    check (max_pets between 0 and 20),
  add constraint rental_cottages_pet_policy_check
    check (
      (pets_allowed and max_pets >= 1)
      or (not pets_allowed and max_pets = 0)
    );

create trigger campsites_bump_compatibility_revision
after update of accessible_site, pets_allowed, max_pets
on public.campsites
for each row execute function icamp_private.bump_campsite_availability_revision();

create trigger rental_cottages_bump_compatibility_revision
after update of pets_allowed, max_pets
on public.rental_cottages
for each row execute function icamp_private.bump_cottage_availability_revision();

comment on column public.campsites.accessible_site is
  'Whether the campsite is advertised as an accessibility-compatible site for Build 034 booking compatibility.';
comment on column public.campsites.pets_allowed is
  'Whether guest pets are compatible with this campsite.';
comment on column public.campsites.max_pets is
  'Maximum guest pets permitted at this campsite; zero when pets are not allowed.';
comment on column public.rental_cottages.pets_allowed is
  'Whether guest pets are compatible with this rental cottage.';
comment on column public.rental_cottages.max_pets is
  'Maximum guest pets permitted in this rental cottage; zero when pets are not allowed.';
