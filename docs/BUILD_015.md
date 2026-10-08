# Build 015 — Telephone/SMS Workflow Parity Harness

Status: **IMPLEMENTED — protected promotion pending.**

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

The parity harness stores no bearer link, phone number, message body or keypad digits.

### Staff-assisted fallback

The provider-neutral `requestStaffTransfer` callback provides an explicit telephone fallback when automation is unsuitable or high-risk.

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
- graphical-only secure-link/staff-transfer proof;
- payment-safety proof;
- repository/source-of-truth tests;
- an explicit `parity:verify` CI gate.

## Database/provider impact

No database migration is required. No paid telephone/SMS provider is required. The harness uses the existing provider-neutral Build 010–014 boundaries and remains portable.

## Manual action

**None.**

## Promotion evidence

Pending protected feature → `dev` → `main` promotion and independent production-main verification.

## Next build

Build 016 remains queued until Build 015 is fully promoted.
