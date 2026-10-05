# Build 003 — Database, Migration, Multi-Property, Admin Freshness & Help Foundation

## Status
**FULLY PROMOTED — `main` verification GREEN.**

## Objective

Establish the first canonical PostgreSQL data model and migration discipline while adding two cross-application usability requirements:
- robust admin data freshness/refresh tracking;
- contextual help through an accessible circular ⓘ control for every meaningful section/form.

## Database foundation

### Provider-portable PostgreSQL
Build 003 uses plain PostgreSQL-compatible migrations rather than embedding business logic into a single managed-database vendor.

The schema is designed to remain deployable to:
- Supabase PostgreSQL;
- another managed PostgreSQL service;
- self-hosted PostgreSQL.

### Canonical multi-property hierarchy
The first canonical hierarchy is:
1. organization;
2. campground/property;
3. campground section;
4. campground subsection.

Foreign keys include organization/campground scope so a child record cannot silently point across tenant/property boundaries.

### Identity/lifecycle conventions
Core records use:
- UUID primary keys;
- `created_at`;
- `updated_at`;
- optional `archived_at`;
- lifecycle state;
- monotonically increasing `row_version`.

The private trigger function updates `updated_at` and increments `row_version` on modification.

### RLS from the beginning
Every Build 003 table created in the exposed `public` schema has Row Level Security enabled immediately.

Build 003 creates **no permissive public/authenticated policies**. Authentication and tenant-aware policies arrive in Build 005.

### Migration history
The repository contains a provider-neutral migration runner.

It:
- applies migrations in version order;
- records applied versions in `icamp_meta.schema_migrations`;
- stores SHA-256 checksums;
- rejects an already-applied migration whose contents have changed;
- can be safely rerun without reapplying identical migrations.

## PostgreSQL verification

CI now creates an actual PostgreSQL 17 service and:
1. applies every migration;
2. verifies expected tables exist;
3. verifies RLS is enabled;
4. creates organization/campground/section/subsection test records;
5. proves the scoped foreign-key boundary rejects invalid cross-tenant references;
6. verifies `row_version` increments;
7. verifies admin refresh-state records;
8. reruns migrations to prove migration-history idempotency.

No remote database account is required.

## Admin freshness/refresh foundation

### Database metadata
`admin_refresh_states` stores metadata such as:
- organization/campground scope;
- UI section/source key;
- idle/refreshing/fresh/stale/failed state;
- last requested/start/success/failure timestamps;
- safe error code;
- source watermark;
- refreshed-through timestamp;
- stale-after threshold;
- row version.

The table intentionally does **not** store a duplicate copy of client/business payloads.

### User interface
A reusable `AdminRefreshControl` now:
- shows when the server view was rendered;
- shows when refresh was requested;
- visibly indicates refreshing state;
- performs a server-data refresh through Next.js rather than silently relying on browser reload.

Administrative workspace shells show this control now. Future data modules will connect it to persisted refresh-state metadata and source watermarks.

## Contextual help foundation

### Reusable ⓘ control
`HelpInfo` renders a circular information control next to section headings.

It is:
- keyboard accessible;
- screen-reader labelled;
- touch sized;
- inline;
- non-destructive to form state.

Opening it shows concise guidance plus a link to the fuller help article.

### Help centre
iCamp now includes:
- `/help`;
- `/help/[topic]`.

Current public-safe topics cover:
- application overview;
- workspaces;
- Web/phone/text channels;
- admin refresh/freshness;
- I.T./Analysis;
- customer-input guidance.

The help model already supports public, operational and privileged classifications. Privileged help is not introduced publicly before authentication/authorization exists.

### Section contract
`SectionHeading` requires a help-topic ID.

Existing home, workspace, I.T. and status sections have been converted to use the contextual-help pattern.

Future applicable UI builds must register help metadata; help is now part of the build gate.

## Security

- exposed-schema tables enable RLS immediately;
- no permissive RLS policies yet;
- private trigger helper lives outside the exposed public schema;
- refresh metadata excludes sensitive payloads;
- help content is classified;
- public help contains no internal credentials, bypass procedures or sensitive infrastructure detail;
- migration history uses checksums to prevent silent rewriting of applied migrations.

## Free-first and portability

No paid database or help platform is required.

PostgreSQL 17 runs as a free CI service container for migration verification.

A remote Supabase project is deliberately **not required yet**, avoiding unnecessary account/project provisioning before authentication and application data access are ready.

## Channel support

### Web/PWA
Full for the Build 003 help/freshness foundation.

### IVR/DTMF
Database scope/freshness is backend infrastructure. Help topics can later be voiced/guided through Builds 009–015.

### SMS/MMS
Help links and refresh/operational summaries can later be delivered through the communications subsystem.

## Manual action
**None expected.**

No database account, password, Supabase project, hosting account or secret is required for Build 003.


## Dev verification evidence

Verified on dev implementation commit `9b4ffea53a65fcddd8c3d26493d2c1b00e47548e`.

### Application job
Passed:
- canonical formatting;
- ESLint with zero warnings;
- strict TypeScript;
- repository/application invariant tests;
- Next.js production build;
- production dependency audit at high/critical threshold;
- full dependency audit artifact capture.

### Database migration job
Passed against a real PostgreSQL 17 CI service:
- migration application;
- expected-table verification;
- RLS-enabled verification;
- organization/campground/section/subsection creation;
- tenant/property foreign-key boundary test;
- row-version increment test;
- admin refresh-state insert;
- idempotent migration rerun;
- migration-history output.

### Security
- Gitleaks secret scan passed.
- CodeQL remains configured but eligibility-skipped because the private repository does not have the GitHub private-repository Code Security entitlement.

## Acceptance outcome

Build 003 now establishes:
- canonical organization/campground/section/subsection hierarchy;
- provider-portable PostgreSQL migration history;
- checksum protection against rewriting applied migrations;
- immediate RLS enablement;
- admin refresh/freshness metadata;
- visible admin refresh control;
- universal contextual-help registry;
- circular accessible ⓘ controls;
- full help-centre routes;
- section-level help requirement in the build gate.

## Next build after promotion
**Build 004 — Authentication & Secure Sessions.**


## Production/release verification

Application promotion commit: `3e2b27a5b4fddf87c7295f41636264a79a3d8e85`.

Verified on `main`:
- application CI GREEN;
- PostgreSQL 17 database-migration job GREEN;
- RLS/tenant-boundary verification GREEN;
- migration idempotency GREEN;
- production build GREEN;
- production dependency audit GREEN;
- secret scan GREEN.

No remote production database was provisioned in this build by design; the canonical schema is version-controlled and verified against real PostgreSQL in CI.
