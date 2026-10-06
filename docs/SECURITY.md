# iCamp Security Standard — iCamp2027

## 1. Security posture

iCamp manages reservations, payments, guest/staff data, physical access, safety records, financial records and potentially financing applications. Security is therefore a product requirement, not a later hardening exercise.

Mandatory principles:
- deny by default;
- least privilege;
- server-side authorization for every protected mutation;
- database row/data boundary enforcement;
- no trust in client-supplied price, role, availability, inventory, access status, payment status or financial totals;
- secrets never committed;
- sensitive media private by default;
- audit privileged and high-risk actions;
- strict validation at API boundaries;
- rate limiting/abuse controls;
- verified/idempotent webhooks;
- strong environment separation;
- production changes traceable to commit and migration versions.

## 2. Data classifications

### Public
Published campground information, public amenities, approved site/cottage images, published rates, public local-attraction/event content.

### Internal
Operational notes, maintenance assignments, non-sensitive schedules, inventory operations.

### Confidential
Guest contact information, vehicle registrations, visitor records, staff personal information, vendor contracts, detailed finance.

### Highly restricted
Authentication/recovery secrets, provider API secrets, sensitive incidents, privileged access-control details, financing applications/documents, security device credentials.

Access, retention and export rules must match classification.

## 3. Permission domains

At minimum:
- campground.configuration
- campground.map
- campground.map.publish
- accommodation.read
- accommodation.manage
- accommodation.media.manage
- reservation.read
- reservation.create
- reservation.modify
- reservation.cancel
- reservation.override
- pricing.manage
- payment.read
- payment.capture
- refund.issue
- discount.apply
- guest.read
- guest.manage
- vehicle.read
- vehicle.register
- vehicle.pass.issue
- visitor.read
- visitor.register
- access.credential.issue
- access.credential.revoke
- access.events.read
- gate.state.read
- gate.override.open
- gate.override.close
- security.incident.manage
- maintenance.read
- maintenance.create
- maintenance.assign
- maintenance.complete
- inspection.perform
- inspection.signoff
- seasonal.manage
- winterization.signoff
- permanent_unit.manage
- permanent_unit.transfer
- financing.read
- financing.manage
- event.manage
- event.access.manage
- local_interest.manage
- promotion.manage
- waterfront.manage
- boat.manage
- dock.manage
- safety.warning.issue
- safety.suspension.issue
- safety.suspension.review
- rental.manage
- pos.sell
- pos.refund
- inventory.read
- inventory.manage
- garbage.pickup.manage
- staff.read
- staff.manage
- role.manage
- schedule.manage
- timekeeping.manage
- vendor.read
- vendor.manage
- finance.read
- finance.manage
- reports.read
- audit.read
- announcement.send
- communications.read
- communications.send
- communications.manage
- voice.call
- ivr.admin
- sms.send
- sms.preference.manage
- emergency.broadcast
- system.admin

## 4. High-risk operations

Require explicit permission, reason capture and audit. Some may additionally require recent re-authentication or second approval:
- role/permission changes;
- privileged staff creation;
- refunds above threshold;
- manual payment-state changes;
- financial adjustments;
- financing application access/decision recording;
- sensitive exports/deletion;
- campground-wide closures;
- emergency broadcasts;
- map publication;
- manual gate open/close;
- access credential provisioning/revocation;
- mass visitor/pass operations;
- permanent-unit ownership transfer;
- bulk reservation mutations.

## 5. Authentication/session requirements

- secure hosted authentication;
- verified email/identity where appropriate;
- MFA readiness for management/security/finance;
- secure password reset;
- session expiration/revocation;
- recent re-authentication support for sensitive actions;
- secure, HTTP-only, same-site cookies where applicable;
- device/session audit events.

## 6. Authorization

- roles are permission collections, not the source of truth for access by themselves;
- permissions are checked server-side;
- property/campground scope is enforced;
- database policies prevent cross-property data access;
- client UI hiding is never considered authorization;
- management overrides remain permission-controlled and audited.

## 7. Reservation/payment security

- atomic booking holds;
- anti-double-booking constraints;
- server-generated price quotes;
- payment provider tokenization;
- no raw card storage;
- verified webhook signatures;
- idempotency on reservation/payment/refund writes;
- refund references original payment;
- append-oriented financial history.

## 8. Physical access/gate security

Gate/security integration is treated as a privileged operational system.

Requirements:
- no direct browser-to-controller commands;
- server-side provider adapter;
- authenticated/authorized command path;
- command rate limiting;
- audit actor, gate/device, reason, timestamp, request, provider response and result;
- credentials scoped by person/vehicle/site/time/zone;
- revocation/expiry;
- access-event logging;
- device health monitoring where supported;
- encrypted secret storage;
- provider credentials never exposed to clients.

Manual override must never bypass required physical life-safety mechanisms. iCamp cannot be the only means of emergency egress or hardware safety control.

## 9. Vehicle/visitor privacy

Collect only operationally required data. Plate, vehicle description, visitor identity and validity should be retained according to campground policy and applicable privacy obligations, not indefinitely by default.

Visitor/pass lookups must be permission-filtered.

## 10. Financing security

Financing is isolated from ordinary reservation workflows.

Requirements:
- separate permissions;
- confidential/highly restricted data classification;
- minimal collection;
- encrypted transport/storage through approved provider services;
- document access audit;
- retention policy;
- no hidden automated lending decision unless specifically implemented through a compliant provider/process;
- no payment card/bank credential storage unless an approved provider tokenizes it.

## 11. Media/upload security

- validate size/type/signature;
- strip unsafe metadata where appropriate;
- process customer-facing images into controlled variants;
- private media uses signed/authorized delivery;
- avoid executable file types unless explicitly required;
- protect against path traversal/content-type spoofing;
- maintain attachment audit.

Public site/cottage gallery has a business limit of 10 active images; internal evidence media is separate.

## 12. Local-content security and integrity

Local attractions/events can contain external links/content.

Requirements:
- management approval before public promotion;
- source reference;
- freshness/expiry date;
- sanitization of displayed content;
- safe external links;
- no unreviewed remote HTML/script;
- marketing consent/opt-out respected;
- expired events suppressed automatically.

## 13. Garbage sticker/pass integrity

Serialized garbage stickers, QR passes and access credentials must use non-guessable identifiers where digital validation matters.

Redemption/voiding is server-authoritative and idempotent.

## 14. Safety/incident data

Warnings, suspensions and incident records are access-controlled.

Changes should be append/history-oriented. Do not silently rewrite who was warned, suspended or reinstated.

iCamp does not replace emergency services or qualified safety staff.

## 15. Application security controls

- CSP;
- strict CORS;
- CSRF strategy where applicable;
- output encoding/XSS prevention;
- parameterized queries;
- schema validation;
- secure headers;
- abuse/rate limits;
- upload controls;
- dependency auditing;
- secret scanning;
- code scanning where account eligibility permits;
- secure error handling that does not expose secrets/internal traces.

## 16. Audit events

Build 006 makes audit evidence append-only in the private database schema.

Audit events include where practical:
- actor;
- target;
- action;
- campground/organization scope;
- timestamp;
- request/session reference;
- permission and risk classification;
- reason;
- previous/new state or event details;
- re-authentication/assurance evidence for high-risk actions;
- success/failure.

A database trigger rejects UPDATE and DELETE against canonical audit rows. Audit JSON must never contain passwords, raw tokens, PINs, MFA secrets, payment credentials or similarly sensitive values.

## 17. Security testing

Every relevant build should add tests for:
- unauthorized/forbidden access;
- wrong campground/tenant;
- forged IDs/roles/prices;
- concurrent writes;
- expired credentials/holds/passes;
- idempotency;
- unsafe input;
- sensitive data exposure.

Physical-access adapter tests use mocks/sandboxes, not real gate commands in ordinary CI.

## 18. Development/production separation

- dev uses synthetic/demo personal data;
- payment/access integrations use sandbox/mock modes;
- production secrets exist only in production secret stores;
- real financing/security data is never copied casually to dev;
- production logs must avoid secret leakage.

## 19. Security gate

A build cannot be GREEN if it introduces an unresolved critical/high security defect in the code or production dependency set, or if a high-risk operation lacks authorization/audit controls.


## 20. Telephone, IVR, DTMF and SMS Security

Telephone/SMS channels are untrusted external interfaces.

### Identity
- Caller ID must never be treated as sufficient authentication.
- Reservation/stay lookups should use limited verification appropriate to the action.
- Staff and high-risk actions require stronger authentication than guest information lookups.
- Authentication secrets/PINs must not be spoken back or returned in plaintext SMS.
- Failed verification attempts are rate limited and monitored.

### DTMF
- Never log full sensitive DTMF sequences if they represent PINs or authentication secrets.
- Mask/redact sensitive digit input in application logs and provider event storage.
- Set session expiry and retry limits.
- Prevent replay of completed commands.
- Do not collect raw payment-card data using custom iCamp DTMF flows.

### SMS
- Treat incoming message bodies as untrusted input.
- Validate and normalize every SMS command before executing a domain action.
- Natural-language SMS interpretation cannot bypass normal authorization/business rules.
- Sensitive information should not be sent by plain SMS when a secure link or authenticated portal is appropriate.
- STOP/START/HELP and provider opt-out events must update internal preference state where applicable.
- Marketing and transactional/operational messaging purposes remain separately classified.

### Provider webhooks
- Verify webhook signatures.
- Enforce HTTPS.
- Apply replay/idempotency controls.
- Rate limit abusive sources.
- Validate provider event schema.
- Avoid storing unnecessary provider payload fields.

### Staff telephone actions
A staff call may not perform gate overrides, refunds, financing actions, role changes or similar high-risk commands based on caller ID alone.

High-risk staff telephone actions should require:
- authenticated staff identity;
- additional factor/re-authentication;
- explicit target confirmation;
- reason capture where appropriate;
- complete audit event.

### Voice recordings and transcription
If call recording/transcription is ever enabled:
- it is disabled by default;
- jurisdiction-appropriate notice/consent is required;
- retention is limited;
- recordings/transcripts are confidential;
- access is audited;
- payment/authentication secrets are excluded/redacted where possible.

### Emergency boundary
The IVR must provide clear routing/escalation for emergencies and must not imply that a voicemail/SMS/automated workflow replaces calling emergency services where immediate assistance is required.

## 21. Messaging Compliance Boundary

iCamp must support configurable compliance requirements rather than hard-code one jurisdiction.

For Canadian commercial SMS, the communications module must support evidence of consent where required, sender identification and a functioning unsubscribe mechanism. Transactional/operational notices and marketing messages must be purpose-tagged and reviewed separately.

Provider-level opt-out handling is synchronized into iCamp's consent/preference records instead of being treated as an external black box.


## 22. I.T. Diagnostics and Observability Security

Diagnostics are potentially sensitive because logs and traces can accidentally reveal personal data, tokens, payment references, infrastructure details or access-control information.

Mandatory controls:
- public health/status endpoints return a strict allow-list of safe fields;
- detailed diagnostics require authenticated, explicitly authorized I.T./system permissions once authentication exists;
- stack traces are never returned to ordinary clients in production;
- client error pages use safe correlation/support references;
- secrets/tokens/passwords/PINs/payment-card data are redacted or excluded before logging;
- request/response bodies are not logged by default;
- diagnostic exports are permission-controlled and audited;
- health endpoints are rate-limited/abuse-reviewed before public production launch;
- external monitoring credentials are stored only in approved secret stores;
- diagnostic retention is configurable and minimized.

Add permission domains when authorization is implemented:
- it.health.read
- it.diagnostics.read
- it.incident.manage
- it.integration.read
- it.release.read
- it.diagnostics.export
- system.status.publish

Until Builds 004–006 implement identity/permissions/audit, the I.T. workspace and public status page must expose **sanitized non-sensitive information only**.


## 23. Database Foundation, Refresh Tracking and Help Security

### Database
- new exposed-schema tables enable RLS immediately;
- no permissive anon/authenticated policies are introduced before Build 005;
- foreign keys enforce organization/campground hierarchy;
- UUIDs are generated server-side/database-side;
- migration SQL is reviewed/tested in CI against PostgreSQL;
- destructive schema changes require explicit migration/recovery planning.

### Refresh/freshness tracking
Refresh tracking stores operational metadata, not copies of sensitive payloads.

Safe fields include timestamps, status, source watermark/version and sanitized error codes/fingerprints.

Do not persist:
- raw exception dumps;
- guest/staff form payloads;
- payment data;
- access credentials;
- authentication tokens;
merely to record that a refresh succeeded or failed.

Manual refresh actions that later trigger privileged data access must use normal authorization and audit controls.

### Contextual help
Help content is classified.

Public help may describe public/guest workflows.

Privileged internal help may contain operational guidance but must not expose:
- credentials;
- secret configuration;
- security bypass procedures;
- private infrastructure details;
- sensitive financial or client information.

Help controls themselves do not bypass authorization; a user who cannot access a feature must not gain its privileged data through help content.


## 24. Authentication and Session Security Controls

### Passwords
- passwords are hashed server-side with scrypt and random salts;
- plaintext passwords are never persisted or logged;
- password hashes remain in the private database schema;
- public APIs never expose password verifiers.

### Account enumeration
- login uses generic invalid-credential messages;
- unknown-account login performs password-verification work against a dummy verifier to reduce timing differences;
- registration does not reveal whether an email already exists;
- recovery responses do not reveal account existence.

### Failed sign-in handling
- active accounts track failed attempts;
- five failed password attempts trigger an initial 15-minute lock;
- lockout behavior is server/database controlled;
- future I.T./Analysis can surface abuse patterns without publishing account existence.

### Sessions
- session tokens contain at least 256 bits of cryptographic randomness;
- only SHA-256 token hashes are persisted;
- sessions expire and can be revoked server-side;
- production cookie uses `__Host-`, Secure, HttpOnly and SameSite=Lax;
- logout revokes the database session before clearing the cookie.

### Recovery
- recovery tokens are random, expiring and single-use;
- only token hashes are stored;
- password reset revokes all existing sessions;
- raw recovery tokens are not logged by the no-op delivery adapter.

### Browser mutations
- authentication POST requests require same-origin Origin validation;
- redirect targets are constrained to local application paths;
- mutation endpoints do not use GET.

### Staff and privilege boundary
Build 004 staff identity is not itself permission to perform every staff operation.

Build 005 must enforce campground/property scope and permission checks before staff business data becomes available.

### Repository release protection
The production/release `main` branch should be protected:
- pull request required;
- required GREEN status checks;
- no force pushes;
- no branch deletion;
- no routine direct-push bypass;
- no mandatory human approval count while autonomous single-maintainer development is in use, unless the owner later chooses otherwise.


## 25. Authorization, Roles and Row-Level Security Controls

### Authentication is not authorization
A valid staff session does not grant universal staff access.

Every protected operation must resolve the staff identity against an active campground assignment and the required granular permission.

### Default deny
If an assignment, active role, permission, campground scope or trusted request-user context is missing, access is denied.

Malformed RLS request-user context resolves to no identity rather than an elevated/default user.

### Never trust client authority claims
Do not authorize from:
- client-submitted role names;
- hidden form fields;
- browser UI state;
- caller ID;
- SMS sender identity;
- arbitrary headers;
- unverified external claims.

Authorization is resolved server-side from canonical database assignments/roles/permissions.

### Private authorization records
Permission catalogues, roles, assignments and assignment-role links live in `icamp_private`.

Supabase `anon` and `authenticated` roles have no private-schema USAGE and are not members of `icamp_app`.

### Application database role
`icamp_app` is NOLOGIN and NOINHERIT.

Only a trusted server/migration principal may assume it. Its table privileges are intentionally narrower than the migration owner's privileges and remain constrained by forced RLS.

### Tenant and custom-role boundaries
A campground assignment carries organization and campground scope.

Custom roles belong to one organization and are rejected if attached to another organization's assignment.

Only staff authentication identities may receive staff assignments.

### Forced RLS
Current scoped public tables FORCE RLS, and broad public grants are revoked.

Server guards and RLS are defense-in-depth; neither is considered a substitute for the other.

### Permission-specific UI/server guards
Opening an operational workspace requires an explicit minimum permission.

Each sensitive action inside the workspace must check its own capability rather than inheriting every capability from workspace entry.

### High-risk permissions
Capabilities such as refunds, gate overrides, role management, financing, emergency broadcasting, diagnostic exports and system administration are marked high-risk/elevated where appropriate.

Build 006 adds audit/reason/re-authentication controls; possession of the permission alone will not be the final safeguard for those actions.

### Cross-channel enforcement
Telephone, DTMF, SMS, secure-link and staff-assisted workflows must use the same canonical authorization services as Web/PWA.

No channel adapter may create an authorization bypass.

### Verification requirements
CI and production-readiness checks must prove at minimum:
- unassigned users see no scoped campground rows;
- a limited role cannot perform an owner/admin update;
- an authorized role can perform its permitted update;
- one campground assignment cannot modify another campground;
- organization-scoped custom roles cannot cross organizations;
- missing/malformed request identity fails closed;
- migration history remains reproducible.

### Hosted database verification
Build 005 remote tests run in rollback-only transactions against the iCamp Supabase development project and retain no synthetic authorization records.

Supabase security-advisor findings must be reviewed after authorization migrations; security findings are not waived merely because CI is GREEN.
