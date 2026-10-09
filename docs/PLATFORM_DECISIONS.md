# iCamp Platform Decisions

## Decision principle
iCamp remains provider-portable. Business rules live in the application and canonical PostgreSQL schema, while external services sit behind adapters.

## Locked now

### Application hosting
**Decision: Next.js on Vercel for the current hosted application.**

Reason: the repository is already Next.js, Vercel provides the lowest-friction preview/production path, and no iCamp domain logic depends on Vercel-only storage or data primitives.

Scale path: move Node hosting to another compatible platform or containers without redesigning campground data.

### Database
**Decision: PostgreSQL is canonical; Supabase is the current hosted PostgreSQL development/early-production provider.**

iCamp owns migrations in GitHub. Supabase is a hosting target, not the schema source of truth. Authentication remains the existing iCamp server-managed model rather than switching domain identity to Supabase Auth.

### Object/media storage
**Decision: keep the provider adapter; use Supabase Storage for the current free-first implementation.**

Map images and other media are referenced through iCamp metadata and authorization. Storage can later move to S3, R2 or another object store.

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

## Build 020 impact
Polygon plotting and persistence use only iCamp code, PostgreSQL and the existing private map-image/media contracts. No mapping subscription, GIS API, paid provider or new secret is required.
