# Build 001 — Responsive PWA & Omnichannel Application Shell

## Status
**Queued — not started.**

## Objective
Create the active iCamp application shell without prematurely implementing campground business modules.

The shell establishes the surfaces and contracts that every later build will use:
- Web/PWA;
- mobile/tablet/desktop layouts;
- IVR/DTMF;
- SMS/MMS;
- email/push notification surfaces;
- role-specific application workspaces.

## Required workspaces
- Public/visitor.
- Guest/My Stay.
- Front Desk/Reservations.
- Maintenance/Housekeeping.
- Security/Access.
- Store/POS.
- Staff.
- Foreman/Supervisor.
- Management/Admin.
- Finance/Accounting.

## Omnichannel contract
Build 001 must define a reusable per-feature support declaration:
- Web/PWA full/partial/not applicable.
- IVR/DTMF full/guided/staff-transfer/not applicable.
- SMS full/guided/secure-link/not applicable.
- reason when a channel is not applicable.

Inherently graphical operations such as drawing campground polygons are allowed to remain graphical, but their operational data/actions must later have phone/SMS equivalents where meaningful.

## Security
- No feature-specific privileged operations yet.
- No secrets in client bundles.
- No assumption that caller ID authenticates a user.
- All future channel actions must route through the same authorization/business service layer.

## Accessibility
- Keyboard navigation baseline.
- semantic landmarks.
- mobile/touch targets.
- text scaling.
- foundation for telephone/low-bandwidth accessibility.

## Acceptance
- responsive shell works at representative phone/tablet/desktop widths;
- PWA metadata baseline validates;
- workspaces/routes render;
- channel-capability declaration exists;
- tests/format/lint/typecheck/build/security gates GREEN;
- source-of-truth docs remain consistent.

## Manual action
None expected.
