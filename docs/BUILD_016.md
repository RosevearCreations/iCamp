# Build 016 — Demo Campground, Test Data & End-to-End Harness

Status: **FULLY PROMOTED — `main` GREEN.**

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

**None.**

## Promotion evidence

- implementation PR: #56;
- exact tested feature head: `b9244eeadb1416b7617328bcf212ce3c5e45af92`;
- feature-head CI `37779307817`: GREEN;
- feature-head CodeQL `37779307972`: GREEN;
- feature-head Secret Scan `37779307861`: GREEN;
- dev merge: `723420eb16d5af4f17c09988c348fd14089216f7`, with zero file differences from the tested feature tree;
- independent dev CI `37779578107`: GREEN;
- independent dev CodeQL `37779577964`: GREEN;
- independent dev Secret Scan `37779577920`: GREEN;
- production promotion PR: #57;
- production PR CI `37779830099`: GREEN;
- production PR CodeQL `37779830187`: GREEN;
- production PR Secret Scan `37779830129`: GREEN;
- runtime production merge: `a5f54d23cd994fe18a53e07ecbe8868bf8d9c4eb`, with zero file differences from the final GREEN dev tree;
- independent runtime-main CI `37780078238`: GREEN;
- independent runtime-main CodeQL `37780078160`: GREEN;
- independent runtime-main Secret Scan `37780078145`: GREEN.

The final source-of-truth closeout is promoted through the same protected
`dev` → `main` path before Build 016 is reported complete.

## Next build

**Build 017 — Campground, Section & Subsection Administration**
