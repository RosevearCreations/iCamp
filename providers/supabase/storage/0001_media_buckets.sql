-- iCamp Build 008
-- Supabase Storage provider configuration.
-- This file is provider-specific by design and is not part of the portable PostgreSQL migration runner.
-- Application authorization remains in iCamp; uploads use trusted server credentials.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'icamp-public-media',
    'icamp-public-media',
    true,
    26214400,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf'
    ]::text[]
  ),
  (
    'icamp-internal-media',
    'icamp-internal-media',
    false,
    26214400,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf'
    ]::text[]
  ),
  (
    'icamp-confidential-media',
    'icamp-confidential-media',
    false,
    26214400,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf'
    ]::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No INSERT/UPDATE/DELETE policies are granted to browser-facing roles.
-- The iCamp server validates and authorizes uploads before invoking Storage.
-- Internal/confidential reads are served only through short-lived signed URLs
-- after the canonical iCamp campground permission check succeeds.
