# Build 016 — Demo Campground, Test Data & End-to-End Harness

Status: **IMPLEMENTED — promotion verification pending.**

## Roadmap scope

Build 016 delivers:

- a deterministic synthetic campground seed;
- demo site, cottage and operational-asset fixture coverage;
- a browser end-to-end test framework;
- an explicit ban on production personal data in test fixtures.

## Delivered design

### Synthetic campground seed

`scripts/seed-demo-campground.mjs` seeds the current canonical PostgreSQL
hierarchy using deterministic IDs:

- synthetic organization;
- synthetic campground;
- sections;
- subsections.

The command refuses production and requires
`ICAMP_ALLOW_DEMO_SEED=true`.

`scripts/verify-demo-campground.mjs` independently verifies the seeded
hierarchy and fixture counts.

### Prototype site, cottage and asset catalogue

`lib/demo/catalogue.mjs` provides stable synthetic site, cottage and asset
examples for current/future tests.

These records are marked `prototypeOnly: true` and are **not** inserted into
guessed production tables. Builds 024–030 retain ownership of the canonical
accommodation, campsite, cottage, operational-asset and status schemas.

### Non-production demo surface

`/demo` shows the fixture catalogue in development/test/staging and returns a
404 boundary in production.

The home page links to the demo only outside production.

### Browser end-to-end harness

Playwright Test 1.64.0 provides the browser harness with Chromium in CI.

The initial smoke suite covers:

- public application shell;
- non-production demo campground;
- public status surface;
- authentication route;
- public workspace route.

### CI gates

CI now includes:

- deterministic demo seed and database verification in the PostgreSQL job;
- a dedicated Chromium browser end-to-end job;
- failure artifacts for browser traces/screenshots;
- repository tests proving privacy, production guards and roadmap boundaries.

## Security/privacy

- no production personal data is present in test fixtures;
- no real email, telephone, payment, credential or provider-secret data is
  introduced;
- production demo seeding fails closed;
- production does not expose the demo page;
- prototype accommodation/asset data cannot masquerade as canonical production
  inventory.

## Database/provider impact

No schema migration is introduced.

The seeder uses the existing provider-portable PostgreSQL hierarchy and the
already installed `pg` client.

Playwright is open source and requires no paid provider.

## Manual action

**None expected.**

## Promotion evidence

Pending feature/dev/main GREEN verification.

## Next build

**Build 017 — Campground, Section & Subsection Administration**
