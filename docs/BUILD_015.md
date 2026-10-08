# Build 015 — Telephone/SMS Workflow Parity Harness

Status: **FULLY PROMOTED — `main` GREEN.**

## Roadmap scope

Build 015 delivers:

- an executable channel-support matrix for product workflow families;
- reusable IVR and SMS adapters over canonical domain commands;
- secure-link handoff for protected or unavoidable visual steps;
- staff-assisted transfer fallback;
- automated parity proof for key guest and staff workflows;
- explicit documentation for graphical-only tasks such as polygon drawing.

## Delivered design

### Executable workflow matrix

`lib/parity/core.mjs` provides a validated workflow registry spanning guest, staff, management and visual-only workflow families.

Each entry declares Web/PWA, IVR/DTMF and SMS/MMS support using the established iCamp support vocabulary.

The validator fails on duplicate IDs, invalid support states and accidental Web-only operational workflows.

### Canonical domain-command adapters

`createIvrWorkflowAdapter` and `createSmsWorkflowAdapter` route supported requests to the supplied `executeCanonicalCommand` function.

The adapters carry channel/support context but do not duplicate domain validation. Later reservation, maintenance, gate, store, visitor, vehicle and other product services remain authoritative.

### Secure-link handoff

The provider-neutral `createSecureLink` callback is used when SMS must move into a protected visual step. Guided canonical commands can also request a visual handoff dynamically.

A dynamic visual step receives a generic protected-handoff purpose when the workflow does not already declare a more specific handoff purpose.

The parity harness stores no bearer link, phone number, message body or keypad digits.

### Staff-assisted fallback

The provider-neutral `requestStaffTransfer` callback provides an explicit telephone fallback when automation is unsuitable or high-risk.

An IVR workflow explicitly classified as staff-transfer cannot silently switch to a secure-link path just because a link factory is available.

### Graphical-only honesty

Polygon drawing, map-label positioning, photo viewing and chart inspection are declared visual-only rather than being represented as fake keypad equivalents.

Telephone uses staff transfer; SMS uses protected handoff where meaningful.

### Payment safety

Raw card collection remains outside the custom iCamp IVR/SMS flow. SMS hands off to a hosted payment surface and telephone uses staff/provider-hosted fallback.

## I.T. health

I.T. & Analysis exposes only aggregate parity information:

- registered workflow count;
- canonical-command count;
- graphical-only count;
- IVR guided/transfer counts;
- SMS guided/secure-link counts.

No identities, message bodies, keypad digits, secure-link tokens or provider secrets are displayed.

## Automated proof

Build 015 adds:

- unit tests for registry validity and channel routing;
- key guest reservation parity proof;
- key staff work-order parity proof;
- dynamic visual secure-link proof;
- graphical-only secure-link/staff-transfer proof;
- payment-safety proof;
- repository/source-of-truth tests;
- an explicit `parity:verify` CI gate.

The final tested feature head is `10b161b30a1783d16dcba6f1db2e81be0f6f817b`.

## Database/provider impact

No database migration is required. No paid telephone/SMS provider is required. The harness uses the existing provider-neutral Build 010–014 boundaries and remains portable.

No hosted Supabase schema change was made in this build.

## Security/privacy

- caller ID and SMS sender remain routing hints, not authentication;
- canonical authorization and verification remain server-authoritative;
- channel adapters do not duplicate or bypass privileged-action controls;
- raw payment-card collection is excluded from custom IVR/SMS;
- secure-link tokens are not displayed in I.T. health;
- message bodies, endpoint values and keypad digits are not added to parity health or registry evidence.

## Manual action

**None.**

## Promotion evidence

- implementation PR: #52;
- exact feature head: `10b161b30a1783d16dcba6f1db2e81be0f6f817b`;
- feature-head CI `37719659754`: GREEN;
- feature-head CodeQL `37719659769`: GREEN;
- feature-head Secret Scan `37719659789`: GREEN;
- dev merge: `d4572b62262d1a6392cf267e4a004a8d22925d8e`, with zero file differences from the tested feature tree;
- independent dev CI `37719825010`: GREEN;
- independent dev CodeQL `37719825044`: GREEN;
- independent dev Secret Scan `37719825020`: GREEN;
- production promotion PR: #53;
- production PR CI `37719994630`: GREEN;
- production PR CodeQL `37719994583`: GREEN;
- production PR Secret Scan `37719994562`: GREEN;
- runtime production merge: `ef46ada0ec9f8e86b19f13e1a100ea2dbd67c5b8`, with zero file differences from the final GREEN dev tree;
- independent runtime-main CI `37720186468`: GREEN;
- independent runtime-main CodeQL `37720186454`: GREEN;
- independent runtime-main Secret Scan `37720186440`: GREEN.

The final source-of-truth closeout is promoted through the same protected `dev` → `main` path before Build 015 is reported complete.

## Next build

**Build 016 — Demo Campground, Test Data & End-to-End Harness**
