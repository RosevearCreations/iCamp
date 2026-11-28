# Build 287 — Original account readiness and safe reconciliation

## Scope of this candidate

Authenticated self-only diagnostic at /auth/platform-readiness. It checks
the current database-backed AAL2 session, host-pin equality, existence of the
migration ledger and owner-binding table, the signed-in user's MFA policy,
active grant and independently verified binding. It does not grant access.

## Original field hold

The identified iCamp project was observed with an active Rosevear login and
verified MFA but a pending platform grant. The two sample identities and
synthetic campground were inactive; no active campground assignment was
observed. The migration ledger and owner-binding table were absent on the
inspected project. These are observations, not proof of runtime equivalence.

Before any original write: verify runtime identity and independent custody,
capture and validate a recoverable backup, compare the actual schema with
canonical migrations, rehearse in an isolated restore, and record reviewed
approval and rollback. Do not rerun a whole migration chain blindly or
fabricate ledger checksums. Never self-approve an owner binding. The legacy
isolated-test activation script must continue refusing production.

Account creation, suspension, role edits and secure tenant provisioning require
audited authorized mutation controls and actual tenant access certification.
This first candidate adds diagnosis only. Do not mark those tasks complete or
tell the owner to enter real campground data yet.

Acceptance: unauthenticated and AAL1 access denied; current AAL2 staff can see
only their own boolean prerequisites; no secrets, other users, host names or
mutation. Existing platform guard remains unchanged.
