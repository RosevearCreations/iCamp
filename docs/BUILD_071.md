# Build 071 — Baseball, Sports, Playground & Hall Maintenance

## Status
**FULLY PROMOTED — `main` GREEN.**

## Delivered scope
- programs for baseball/softball fields, sports fields, playgrounds and halls;
- exact-asset binding to Build 067 recurring schedules and published Build 068 inspection templates;
- append-only surface/floor, safety and amenity/equipment condition evidence;
- canonical Build 065 work-order escalation and Build 066 foreman ownership;
- canonical Build 030 operating state for restrictions, closures and return to service;
- Web/PWA recreation operations with program configuration, condition recording, inspection launch, operating-state control and corrective-work visibility;
- no duplicate scheduler, checklist, work-order, issue status or recreation operating-state authority.

## Targeting
`baseball_softball` and `sports_field` require canonical `sports_field` assets; `playground` requires `playground`; `hall` requires `hall`. Templates and schedules must target the exact same asset.

## Security
Build 071 tables enable and FORCE RLS, revoke public/anon/authenticated direct access, grant minimum `icamp_app` privileges, and keep inspection evidence, condition snapshots and issue links append-only.

## Hosted database
- hosted migration `20261022033418 / baseball_sports_playground_hall_maintenance`;
- exact Build 071 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Performance Advisor: no Build 071 unindexed-foreign-key lint;
- only expected INFO-level `unused_index` notices were present immediately after creating the new indexes.

## Promotion evidence
- feature PR #264;
- final feature head `7989abe7aad45888a2dc7814ea26bb30d9c413ea`;
- exact independently verified `dev` SHA `ee92544d139789e428d0c4528b8134078430fbb3`;
- `dev` independently passed CI #39716680447, CodeQL #39716680458 and Secret Scan #39716680370;
- direct `dev` → `main` PR #265 was closed without merge because prior squash-history divergence made the PR dirty;
- clean production PR #266 was created directly from the current `main` with exactly the 13 Build 071 files/edits;
- production PR #266 passed Verify, Browser E2E, database lifecycle/idempotence, CodeQL and Gitleaks;
- production `main` SHA `33e5b201d6cc5c656ed6aed43cbb98e167c91d71`;
- production `main` independently passed CI #39718176592, CodeQL #39718176621 and Secret Scan #39718176597;
- formatter, lint, TypeScript, unit/static tests, channel-parity verification, production build, dependency audit, Browser E2E, PostgreSQL full migration history and idempotent replay were GREEN at the final production checkpoint.

## Visual/theme prerequisite
The Build 068 standard multi-theme semantic-token ruleset remains binding for future graphical/style work.

## Cost / infrastructure
No paid service, new hosted project, Worker, D1 database, R2 bucket, Vercel project or new secret was required.

## Next build
**Build 072 — Roads, Utilities, Garbage & Septic Maintenance**, advancing the historical Build 073 roadmap scope.
