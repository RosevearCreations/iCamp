# iCamp Database

## Strategy

iCamp uses provider-portable PostgreSQL migrations.

The initial schema is tested in CI against PostgreSQL 17 and is designed to remain deployable to managed PostgreSQL services such as Supabase as well as self-hosted PostgreSQL.

## Migration rules

- Migration files live in `database/migrations`.
- File names use a monotonic four-digit version prefix.
- Applied migrations are recorded in `icamp_meta.schema_migrations`.
- The migration runner stores a SHA-256 checksum.
- Editing an already-applied migration causes the runner to fail.
- New schema changes must use a new migration.
- CI applies all migrations to a clean PostgreSQL instance and runs verification SQL.

## Security

Tables introduced in the exposed `public` schema enable RLS immediately.

Build 003 intentionally creates no permissive RLS policies. Authentication and tenant-aware policies arrive in Build 005.

Authentication, authorization, audit, background-job, scheduler, worker-heartbeat and secure media metadata/lifecycle records live in the private schema and are not exposed to browser-facing database roles.

## Supabase compatibility

iCamp does not require Supabase to develop or test Build 003. The SQL remains PostgreSQL-compatible so a future Supabase project can use the same canonical schema rather than becoming the source of truth.

When a remote provider is connected, schema changes must continue to originate from version-controlled migrations rather than ad-hoc dashboard edits.

## Current hosted development target

The current remote development database is the **RosevearCreations Supabase iCamp** project (`cxgszmpbeswdikzofvjv`, Canada Central).

GitHub migration files remain canonical.

Supabase's migration interface is used to apply those canonical migrations remotely; vanilla PostgreSQL CI remains the portability/compatibility proof.

## Secure media storage

Build 008 stores only provider-neutral media metadata and lifecycle evidence in PostgreSQL. Binary objects remain in an object-storage adapter.

Provider-specific storage setup is versioned separately from the portable migration runner under `providers/`. The current Supabase bucket definition is `providers/supabase/storage/0001_media_buckets.sql`.
