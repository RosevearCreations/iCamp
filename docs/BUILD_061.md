# Build 061 — Passes, Wristbands & QR Codes

## Status
**IMPLEMENTED — promotion verification in progress.**

## Queue authority
The active delivery queue intentionally assigns **Passes, Wristbands & QR Codes** to Build 061. The older roadmap labels the same functional scope as Build 062. This build follows the active queue requested for production delivery.

## Scope
Build 061 turns the Build 056 credential abstraction into secure bearer presentations for:
- QR-code passes;
- printable passes;
- wristbands;
- visitor linkage;
- active vehicle-pass linkage;
- event references;
- day-use references;
- issuance, validation, revocation and time-based expiration.

## Security model
A pass validation token is a bearer secret.

The raw token:
- is generated with cryptographically secure randomness;
- is returned only at first issuance;
- may be encoded as `icamp-pass:v1:<token>` for QR rendering;
- is never stored in PostgreSQL;
- is never included in audit metadata or validation evidence.

PostgreSQL stores only:
- a SHA-256 validation fingerprint;
- a masked display hint;
- the immutable pass/credential relationship.

An idempotent retry after successful issuance does **not** reveal the bearer secret again. Staff must revoke/reissue if the one-time issuance response was lost.

## Canonical credential relationship
Build 056 remains authoritative for credentials.

Build 061 maps:
- `qr_code` -> Build 056 `qr_pass`;
- `printed_pass` -> Build 056 `printed_pass`;
- `wristband` -> Build 056 `wristband`.

QR passes reuse the same one-way fingerprint in the Build 056 digital-credential field. Printed passes and wristbands keep their bearer fingerprint only in the Build 061 presentation record because Build 056 deliberately limits its digital-secret field to keypad PIN and QR credentials.

## Linkage
Strong database linkage is provided for:
- active Build 055 visitor registrations;
- active Build 054 vehicle passes.

The access credential validity window must remain inside the linked visitor/vehicle-pass validity window.

Event and day-use domains do not yet have a single canonical authority in the current roadmap, so Build 061 stores bounded provider-neutral references for those links rather than inventing duplicate event/day-use master tables.

## Validation behavior
Validation is fail-closed and returns one of:
- `valid`;
- `not_yet_valid`;
- `expired`;
- `revoked`;
- `source_inactive`;
- `invalid` for an unknown bearer token.

Known-pass validation evidence is append-only. Unknown tokens are not persisted, reducing unnecessary secret-derived evidence and enumeration surface.

A valid pass presentation does **not** open a gate by itself. It yields sanitized subject context for the Build 060 rule evaluator; physical access still requires the applicable zone/schedule/rule decision and device-control workflow.

## Database
Migration `0080_access_passes_wristbands_qr.sql` adds:
- `public.access_passes`;
- `public.access_pass_events`;
- immutable pass-presentation rows;
- append-only validation evidence;
- visitor/vehicle source validation;
- active duplicate prevention under an advisory transaction lock;
- FORCE RLS and direct Data API denial.

## Channel parity
- **Web/PWA:** full staff issuance/revocation plus QR/print/wristband handoff.
- **IVR/DTMF:** verified staff may initiate issuance/revocation, but bearer secrets and graphical QR presentation use staff/visual handoff.
- **SMS/MMS:** a bearer credential is not casually echoed into ordinary SMS. Secure-link/staff-assisted delivery is the safe fallback.
- **Validation scanners:** use the same server validation contract and never receive database credentials or raw stored secrets.

## Boundaries
- Build 054 owns vehicle pass fees/payment and vehicle-pass validity.
- Build 055 owns visitor registration and visitor validity.
- Build 056 owns canonical access credentials.
- Build 060 owns enforceable zones/schedules/rules.
- **Build 061 owns QR/printed/wristband presentation and validation.**
- Arrival/departure provisioning, automatic extension, checkout/cancellation revocation and lost/replacement lifecycle remain deferred to the later credential-lifecycle build.

## Cost / portability
No paid provider, new secret, hosted service or QR SaaS is required. The model uses PostgreSQL plus Node cryptography and can be rendered by any later local/client QR library.

## Manual action
**None required for source implementation.**
