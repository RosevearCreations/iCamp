# Build 071 — Baseball, Sports, Playground & Hall Maintenance

## Status
**IMPLEMENTED — PROMOTION PENDING.**

## Delivered scope
- programs for baseball/softball fields, sports fields, playgrounds and halls;
- exact-asset binding to Build 067 recurring schedules and published Build 068 inspection templates;
- append-only surface/floor, safety and amenity/equipment condition evidence;
- canonical Build 065 work-order escalation and Build 066 foreman ownership;
- canonical Build 030 operating state for restrictions, closures and return to service;
- no duplicate scheduler, checklist, issue status or recreation operating-state authority.

## Targeting
`baseball_softball` and `sports_field` require canonical `sports_field` assets; `playground` requires `playground`; `hall` requires `hall`. Templates and schedules must target the exact same asset.

## Security
Build 071 tables enable and FORCE RLS, revoke public/anon/authenticated access, grant minimum `icamp_app` privileges, and keep evidence append-only.

## Visual/theme prerequisite
The Build 068 standard multi-theme semantic-token ruleset remains binding for future graphical/style work.

## Verification required before promotion
Formatter, lint, TypeScript, tests, build, Browser E2E, PostgreSQL full migration/idempotence, exact hosted verification, CodeQL, Gitleaks, dependency audit, Supabase Security Advisor and independent `dev`/`main` checks must all be GREEN.

## Next build
**Build 072 — Roads, Utilities, Garbage & Septic Maintenance.**
