# iCamp Platform Decisions

## Decision principle
iCamp remains provider-portable. Business rules live in the application and canonical PostgreSQL schema, while external services sit behind adapters.

## Locked now

### Release source and web runtime
**Decision: GitHub `main` remains the production/release source during rough-sketch development. Do not create another Vercel or Cloudflare application project for iCamp yet.**

The current free accounts have enough *project-count* capacity, but project count is not the limiting factor:

- Vercel Hobby currently permits up to 200 projects, but Hobby deployment storage is shared across the team and the Hobby plan is restricted to non-commercial personal use. iCamp is intended to become a commercial campground SaaS, so Hobby is not a suitable long-term production commitment.
- Cloudflare Free currently permits up to 100 Pages projects and 100 Workers. The concern is shared request/CPU/build/storage quotas, not the fact that other Pages/Worker projects already exist.
- Build 021 therefore creates no Vercel or Cloudflare project and consumes no additional deployment storage on either provider.

**Runtime decision remains intentionally deferred until an external pilot needs a continuously hosted iCamp interface.** At that checkpoint we will compare a commercial-capable managed runtime against self-hosting/container deployment using measured iCamp workload rather than rewriting the application around a free-tier constraint.

Next.js on Vercel remains technically compatible with the current application, but it is a deployment option rather than an architectural dependency.

Current provider references reviewed 2026-10-10:
- https://vercel.com/docs/limits
- https://vercel.com/docs/plans/hobby
- https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/workers/platform/limits/

### Database
**Decision: PostgreSQL is canonical; the user's iCamp Supabase project `cxgszmpbeswdikzofvjv` is the current hosted PostgreSQL development/early-production backend.**

Project URL: `https://cxgszmpbeswdikzofvjv.supabase.co`

iCamp owns migrations in GitHub. Supabase is a hosting target, not the schema source of truth. Authentication remains the existing iCamp server-managed model rather than switching domain identity to Supabase Auth.

### Object/media storage
**Decision: keep the provider adapter; use Supabase Storage for the current free-first implementation.**

Map images and other media are referenced through iCamp metadata and authorization. Storage can later move to S3, R2 or another object store. Build 021 does not create or consume a new Cloudflare R2 bucket.

### Campground map rendering
**Decision: use iCamp-owned overhead imagery with SVG/DOM overlays and the canonical coordinate engine.**

Builds 018–023 require no paid mapping API; Google Maps, Mapbox or similar services are unnecessary for the current overhead-image editor. If true geographic/GIS mapping becomes necessary later, prefer an open MapLibre-compatible adapter.

### Background work
**Decision: PostgreSQL-backed durable jobs/schedules remain the default.**

Do not add a paid queue provider while campground workload fits the current database-backed scheduler. Introduce a managed queue only when measured throughput or isolation requires it.

### SaaS tenancy
**Decision: one hosted multi-tenant iCamp application, with organizations/campgrounds as tenant boundaries.**

Campgrounds subscribe to the service rather than receiving a separate code deployment. Subscription/entitlement and billing enforcement arrives in later roadmap builds.

## Deferred until a real paid/live need exists

### Telephone and SMS provider
Keep the mock/provider-neutral gateway during development. Select the live Canadian-capable provider only when we are ready to activate a real number, compliance registration and recurring charges.

### Transactional email
Keep email behind the communications adapter until live delivery volume and domain configuration justify selecting a provider.

### Payments
Use a provider adapter and keep raw card data outside iCamp. Select/activate the live payment processor when reservation and SaaS billing builds require real transactions.

### Dedicated observability
GitHub Actions, application health endpoints and hosting logs are sufficient during rough-sketch development. Add paid error/trace tooling only when operating volume demonstrates the need.

## Build 021 impact
Advanced polygon editing uses only iCamp application code, PostgreSQL and the existing Supabase-backed media/database contracts. The only hosted backend change is PostgreSQL migration `0023_advanced_polygon_editing.sql`; no new paid provider, map API, Vercel project, Cloudflare Pages project, Worker, D1 database or R2 bucket is required.
