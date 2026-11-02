# Build 188 — Visitor/Vehicle/Access Credential Lifecycle & Safe Reconciliation

**Scope:** Campground-private review of canonical Build 056/061/062 credentials and their visitor, vehicle-pass or stay sources. No new physical controller integrations, raw bearer secrets or automatic gate instructions. Billing, Omnichannel and physical gate execution remain **HELD / DISCONNECTED**.

## Delivered behavior

- `/workspaces/security/credentials` displays a bounded, staff-authorized review board for one assigned campground. The current credential status/time window, source enrollment status/time window and stay lifecycle are evaluated together. The board identifies multiple overlapping active credentials for the same visitor or vehicle pass.
- The in-app evaluation denies revoked, not-yet-valid, expired, source-inactive, source-outside-window, ended-assignment and duplicate visitor/vehicle credentials. A review note or staff override acknowledgement **never** changes those verdicts or authorizes hardware.
- An elevated `access.reconciliation.review` permission is granted to the `security`, `campground_manager` and `owner_admin` role templates. Each saved acknowledgement or override *review* requires a 20–1000-character human explanation and current credential row version; review evidence records the observed status/verdict, is scoped with forced RLS and cannot be modified or deleted. Existing credential read permissions remain necessary.
- A private, explicitly permission-checked database function reads visitor/vehicle/stay enrollment status without exposing visitor contacts, driver names, plate numbers or bearer tokens to the board. Canonical records and their existing staff workflows remain authoritative. No external calls are made.

## Verification

1. Node tests: expired/revoked/duplicated/outside-source credential denial, override non-bypass, input validation, private/security source boundary.
2. PostgreSQL 17 migrations and `database/verify/0198_build188_access_credential_reconciliation.sql`: forced RLS, client role denial, append-only permissioned ledger, source-function restricted grants.
3. Rollback-only synthetic lifecycle proves review insertion by an assigned security actor, cross-campground isolation, write rejection by unauthorized staff and immutable evidence, then rolls all test data back.
4. CI format, lint, typecheck, Node, browser E2E, build, production dependency audit, CodeQL and Secret Scan; hosted schema verifier and production deployment/health readback before GREEN.

## Channels and safety

- **Web/PWA:** full authorized review interface; staff-assisted incident follow-up.
- **IVR/DTMF and SMS/MMS:** no credential validation/override/review writes or physical gate execution. Staff transfer or protected web handoff only; provider activation remains HELD.
- **Physical access:** disconnected. In-app verdicts are advisory to authorized staff and do not operate controllers. Real gate/device enforcement requires separate independent authorization, integration test and security acceptance.

## Next queued

**Build 189 — Offline Field Work Queue, Conflict Resolution & Sync Audit.**
