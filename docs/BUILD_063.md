# Build 063 — Security & Access Operations Dashboard

## Status
**IMPLEMENTED — PROMOTION PENDING.**

## Queue authority
Build 061 consumed the historical roadmap's pass/wristband/QR scope and Build 062 consumed its credential-lifecycle scope. The active delivery queue therefore assigns the historical Build 064 dashboard capability to **active Build 063**.

## Scope
Build 063 provides one protected campground-scoped security operations view over the existing canonical access domains:
- gate/device status and latest observed gate state;
- active access credentials;
- recent denied access with explicit denial reason;
- recent manual gate overrides and provider outcomes;
- QR/printed/wristband passes expiring within 48 hours;
- recent security signals derived from device faults, denied access and failed/rejected/timeout/unsupported overrides.

## Read-only aggregation
This build does **not** create a second access-control database or duplicate the existing ledgers.

The dashboard reads Build 057 access devices, Build 058 device/access events, Build 059 override request/outcome evidence, Build 056/062 credential evidence, and Build 061 pass evidence.

No new database migration, provider, paid service or secret is required.

## Authorization
The visual dashboard requires the current staff member to have:
- gate.state.read;
- access.events.read;
- and either access.credential.issue or access.credential.revoke.

Database reads execute as icamp_app with the current user identity so existing campground RLS remains authoritative. A workspace link does not grant data access.

## Privacy and security
The dashboard deliberately excludes raw keypad PINs, raw QR/pass bearer tokens, credential/pass fingerprints, provider credentials and controller secrets.

Manual gate open/close remains the separate Build 059 high-risk server path with command-specific permission, explicit reason, recent re-authentication, rate limiting and privileged audit evidence.

## Incident boundary
The historical roadmap included a separate incident case-management build, but the active queue reassigned Build 061 to passes and did not deliver a canonical incident table/workflow.

Build 063 therefore shows **incident signals**, not invented incident cases: device fault evidence, denied access evidence, and failed/rejected/timeout/unsupported override outcomes.

Assignment, notes, escalation and resolution for canonical security incidents remain deferred until explicitly queued.

## Channel parity
- **Web/PWA:** full authorized dashboard.
- **IVR/DTMF:** verified staff may receive concise canonical status summaries; visual review uses staff/secure handoff.
- **SMS/MMS:** concise verified summaries or secure-link handoff only; sensitive access detail is not copied into ordinary messages.
- **Manual device control:** remains Build 059 and cannot be triggered merely by viewing the dashboard.

## Cost / portability
No paid provider, new hosted service or new database object is required. The implementation uses the existing PostgreSQL access domains and the current Next.js application.

## Promotion evidence
Pending feature, dev, production PR and final main GREEN evidence.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 064 — Maintenance Taxonomy & Priority Model**, advancing to the next non-duplicative historical roadmap capability.
