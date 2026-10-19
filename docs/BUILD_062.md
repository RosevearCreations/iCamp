# Build 062 — Credential Lifecycle at Check-In/Check-Out

## Status
**IMPLEMENTED — promotion verification in progress.**

## Queue authority
Build 061 consumed the older roadmap's wristband/QR/pass scope. The user then requested the next queued build, so the active delivery queue advances to the next non-duplicative roadmap capability as **Build 062 — Credential Lifecycle at Check-In/Check-Out**.

## Scope
Build 062 provides the canonical reservation credential lifecycle:
- provision credentials after front-desk check-in;
- bind credentials to the canonical reservation and check-in;
- synchronize bounded credential expiry with the reservation departure date;
- extend credentials when a checked-in stay extends;
- shorten credentials when a checked-in stay is shortened;
- revoke all active managed reservation credentials at checkout;
- revoke active managed credentials when a pending/confirmed reservation is cancelled;
- lost/replacement workflow with old credential revocation and replacement linkage;
- configurable campground-local checkout expiry time plus bounded grace period.

## Canonical model
Build 056 remains the credential authority and Build 061 remains the bearer presentation/validation authority.

Build 062 adds:
- `public.campground_credential_lifecycle_policies`;
- `public.reservation_access_credential_assignments`;
- lifecycle event kinds on `public.access_credential_events`.

Every managed reservation credential retains the Build 056 canonical credential record. Build 062 adds the reservation/check-in lifecycle relationship rather than inventing a second credential table.

## Provisioning
Provisioning is allowed only after canonical Build 049 front-desk check-in and while the reservation is `checked_in`.

Digital QR/PIN credentials use cryptographically random material and store only the Build 056 SHA-256 fingerprint plus masked hint. The raw generated secret is returned only in the first successful provisioning response. Idempotent retries never re-disclose it.

Physical key cards, fobs, printed passes and wristbands do not fabricate a digital secret. Provider references require an explicit provider code/reference pair.

## Stay synchronization
Campgrounds may configure:
- local checkout time, default 11:00;
- optional grace minutes, default 0 and capped at 180.

Managed credentials marked `sync_with_stay` receive a bounded `valid_until` derived from the canonical reservation departure date in the campground timezone.

When a checked-in reservation changes departure date:
- later expiry records `validity_extended`;
- earlier expiry records `validity_shortened`;
- unchanged expiry creates no duplicate lifecycle event.

## Checkout and cancellation
Build 062 hooks into the existing canonical workflows:
- Build 050 front-desk checkout revokes active managed reservation credentials inside the checkout transaction;
- Build 044 cancellation revokes any active managed reservation credentials inside the cancellation transaction.

The standard front-desk/campground-management role templates already carry the Build 056 issue/revoke permissions, so lifecycle enforcement does not create a parallel authorization model.

## Lost/replacement
Lost/replacement:
1. revokes the old active credential;
2. marks its assignment `replaced`;
3. records append-only lost evidence;
4. provisions a new credential with a new identity/secret;
5. links the new assignment to the old assignment;
6. records replacement evidence.

If replacement issuance fails after the lost credential has been safely revoked, the workflow is retry-safe: the old assignment remains `replaced` and the same replacement idempotency key can finish issuance without reactivating the lost credential.

Ended assignments cannot be reopened.

## Security
- public lifecycle tables enable and FORCE RLS;
- direct `anon` and `authenticated` Data API access is revoked;
- assignment identity fields are immutable;
- ended lifecycle assignments are immutable;
- no credential or lifecycle record is directly deletable by `icamp_app`;
- raw PIN/QR material is never stored or audited;
- replacement never reuses a lost credential secret.

## Channel parity
- **Web/PWA:** full reservation lifecycle and staff credential provisioning/replacement.
- **IVR/DTMF:** verified staff can initiate lifecycle actions using reservation/credential identifiers; bearer secrets and graphical QR display require secure visual/staff handoff.
- **SMS/MMS:** lifecycle status may be summarized after verification; raw bearer secrets are not casually echoed in SMS and use secure-link/staff handoff.
- **Automation:** checkout/cancellation/date-change hooks use the same canonical backend and do not create a second channel-specific lifecycle.

## Boundaries
- Build 049 owns immutable check-in evidence.
- Build 050 owns immutable checkout evidence and turnover handoff.
- Build 052 owns checked-in stay date/accommodation changes.
- Build 056 owns access credential records.
- Build 060 owns access policy.
- Build 061 owns QR/printed/wristband bearer presentation/validation.
- **Build 062 owns reservation credential lifecycle orchestration.**

## Cost / portability
No paid access provider, new hosted service or new secret is required.

## Manual action
**None required for source implementation.**
