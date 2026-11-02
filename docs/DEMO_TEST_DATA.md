# iCamp Demo Campground & Test Data Standard

## Purpose

Build 016 introduces a deterministic synthetic campground used by development,
CI and end-to-end browser tests.

The canonical fixture is `lib/demo/catalogue.mjs`.

## Safety rules

- The fixture is explicitly marked `synthetic: true`.
- It contains no production personal data, email addresses, telephone numbers,
  payment information, access credentials or provider secrets.
- Database seeding is forbidden when `ICAMP_APP_ENV=production`.
- Seeding also requires the explicit opt-in
  `ICAMP_ALLOW_DEMO_SEED=true`.
- The production web surface does not expose `/demo`.

## Current canonical seed boundary

The seeder persists only models that already belong to the current application
schema:

- organization;
- campground;
- sections;
- subsections.

The demo site, cottage and asset records remain prototype-only fixture objects.
They are intentionally **not** inserted into guessed production tables.

Builds 024–030 own the canonical accommodation, campsite, cottage, operational
asset and status models. When those builds arrive, the same fixture catalogue
can be adapted to their real schemas rather than creating incompatible early
tables.

## Deterministic catalogue

The Build 016 fixture includes:

- 1 synthetic organization;
- 1 synthetic campground;
- 5 sections;
- 7 subsections;
- 6 site prototypes;
- 3 cottage prototypes;
- 6 operational-asset prototypes.

Stable identifiers keep database and browser tests repeatable.

## Browser test framework

Playwright Test is the browser harness. CI installs Chromium and exercises:

- the public shell;
- the non-production demo campground;
- the public system-status page;
- the authentication surface;
- the public workspace route.

The framework supports future reservation, map, maintenance, POS, visitor,
vehicle, security and management browser flows without coupling those features
to Build 016.

## Hosted development data

The seed command is safe to run only against a development/test/staging
PostgreSQL target. It is idempotent for the deterministic fixture IDs.

The seed must never be run against production.
