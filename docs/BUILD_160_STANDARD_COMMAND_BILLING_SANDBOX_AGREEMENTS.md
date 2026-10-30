# iCamp Build 160 — Standard Command Dashboards, Isolated Billing Replay & Agreement Review

## Deployment and release intent

- Scope: production deployment of **code/UI only**, not paid subscription activation.
- The Standard (meadow/evergreen) theme is the first canonical theme. Its status colours are semantic and theme-independent. Future theme selection has no fake saving controls.
- Management and I.T. workspaces retain existing `requireAnyCampgroundPermission` route guards. Platform-wide real counts still require the original independently reviewed grant and MFA path. Public `/status` exposes only safe release and runtime information.

## Management, I.T., platform statistics and status

- Management receives quick links to actual campground configuration, assistance triage, map and theme management, with clearly labelled readiness signals.
- I.T. receives runtime configuration/release snapshot, six-app connection HOLD, billing OFF, and a deterministic six-event sandbox status.
- Platform operator counts are `getPlatformOverview` values from the database (no invented chart values). The public status view separates a responsive route from proof of any external dependency.
- Theme Management is permission-checked, shows Standard tokens and honest future-theme availability.

## Sandbox subscription fixture

`lib/tenant-subscription/sandbox-lifecycle.mjs` models **local in-memory** state transitions for checkout completion, creation, renewal invoice, failure, recovery, cancellation, refund and dispute. A replay event has an isolated tenant identifier and bounded id. Duplicate ids are idempotent; out-of-order and cross-tenant events fail closed. Fixture results are not provider receipts, actual charges, or production webhook responses.

Required future work before charging any campground: explicit owner-approved provider and sandbox credentials; Checkout/Customer Portal server route, signature-verified webhook endpoint (raw body), idempotent persistence, webhook retry/out-of-order reconciliation, real provider test-mode evidence, taxes and currency validation, failed payment and cancellation policy, legal approvals and independent security review.

## Versioned subscriber agreement review

- Browser demo previews an author → different reviewer → different approver sequence on explicit version and SHA-256 digest. Synthetic actors/digest are clearly labelled. No app request is sent and no publication occurs.
- `0185_build160_subscriber_agreement_review_ledger.sql` adds a *private*, unseeded, append-only review-event table. Enforced ordering, digest binding, roles separation and immutable document identity help future server-side implementation. Forced RLS and no app policies leave the real approval interface **inaccessible**.
- Never claim legal approval, persist a consent receipt, or flip subscription controls without authenticated authorization, actual legal review and independent witness evidence.

## Integration and commerce gates

- Tenant subscription provider: **UNCONFIGURED / OFF**.
- Consent/legal approval: **HELD**; versioned preview does not accept anything.
- Six-app Comms Hub: **DISCONNECTED / HOLD**; QL-268/QL-270 original signed proof-B custody and independent authorization remain unresolved.
- No authenticated gateway GETs, calls, SMS or gates. No live charging or tenant subscription writes.

## Verification

- `npm run verify`, including format, ESLint, TypeScript, unit tests and Next production build.
- Browser end-to-end CI; database migration CI; secret scan; CodeQL.
- Exact immutable `main` merge SHA, Vercel production READY and HTTP read-only smoke tests required before reporting Production GREEN.
