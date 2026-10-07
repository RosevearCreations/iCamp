# iCamp Active Build Queue

Current program: **iCamp2027**

## Pre-Implementation Engineering Baseline
The repository, CI and security engineering foundation is complete and already promoted. It is intentionally **unnumbered** so it does not conflict with the restarted product roadmap.

See `docs/PRE_IMPLEMENTATION_BASELINE.md`.

## Active roadmap
The active roadmap contains **156 builds** and incorporates the complete iCamp vision, including Web/PWA, IVR/DTMF and SMS/MMS channel-parity requirements.

## Completed active builds

### Build 001 — Responsive PWA & Omnichannel Application Shell
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- responsive phone/tablet/desktop shell;
- PWA baseline;
- ten role-specific workspace shells;
- data-driven workspace registry;
- Web/IVR/SMS channel-capability contract;
- free-first/scale-ready architecture;
- autonomous build operating model;
- portable standalone application output.

### Build 002 — Environment, Configuration, Health & I.T. Analysis Foundation
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- typed environment/runtime configuration;
- development/test/staging/production separation;
- non-production safety banner;
- health, liveness, readiness and version endpoints;
- request/correlation IDs;
- public-safe system status;
- I.T. & Analysis workspace foundation;
- provider-neutral external watchdog contract;
- safe error/support references and diagnostic redaction foundation.

### Build 003 — Database, Migration, Multi-Property, Admin Freshness & Help Foundation
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- provider-portable PostgreSQL migration system;
- organization/campground/section/subsection tenant hierarchy;
- UUID/timestamp/lifecycle/row-version conventions;
- RLS enabled on all new public tables;
- PostgreSQL 17 migration verification in CI;
- checksum-protected migration history;
- admin refresh/freshness database metadata and UI control;
- universal contextual-help registry and circular ⓘ controls;
- public-safe help centre and customer-input guidance foundation.

### Build 004 — Authentication & Secure Sessions
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- guest/staff global identity model;
- private-schema password/session/recovery storage;
- scrypt password hashing and enumeration-resistant public auth flows;
- opaque hash-only server sessions and secure cookie contract;
- password recovery with token supersession and all-session revocation;
- authentication lifecycle verification against PostgreSQL;
- hosted iCamp Supabase authentication schema verification.

### Build 005 — Roles, Permissions & Row-Level Security
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- granular permission catalogue and risk classification;
- role templates and organization-scoped custom roles;
- staff-to-campground assignments;
- staff-only and cross-organization database guards;
- permission-specific workspace/server authorization;
- trusted `icamp_app` RLS database role;
- forced RLS and scoped policies on current property tables;
- PostgreSQL authorization lifecycle and cross-property isolation tests;
- remote Supabase rollback verification with zero retained synthetic records;
- clean Supabase security advisor;
- authorization foreign-key/query indexes.

### Build 006 — Audit Trail & Privileged Action Controls
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- private append-only audit-event schema;
- privileged reason capture with database enforcement;
- before/after state evidence where safe;
- session recent re-authentication timestamp and server refresh hook;
- assurance-aware high-risk action control;
- transactional audit-event writer;
- custom-role creation protected and audited;
- campground staff-role assignment protected and audited;
- PostgreSQL audit/privileged-action lifecycle verification.

### Build 007 — Background Jobs, Scheduler & Operational Queues
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- provider-portable durable PostgreSQL job and schedule foundation;
- per-queue idempotency and at-least-once worker delivery;
- finite worker leases, heartbeats and expired-lease recovery;
- bounded retries and dead-letter visibility;
- scheduler ticks and heartbeat evidence;
- protected aggregate queue/scheduler health in I.T. & Analysis;
- PostgreSQL 17 lifecycle verification in CI;
- hosted Supabase migrations 0008/0009 with zero security-advisor lints;
- advisor-driven foreign-key indexes and rollback-only hosted verification.

### Build 008 — Secure Media & Document Storage Foundation
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- public/internal/confidential media classification;
- provider-neutral private media metadata and append-only lifecycle evidence;
- strict image/PDF validation, signature checks and application size limits;
- server-authorized public/private media access contract;
- short-lived signed private access after canonical campground permission checks;
- three version-controlled Supabase Storage buckets with MIME/size restrictions;
- safe aggregate media health in I.T. & Analysis;
- hosted Supabase migration 0010 with zero security-advisor lints;
- rollback-only hosted lifecycle proof with zero retained synthetic rows.

### Build 009 — Omnichannel Communications Foundation
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- one provider-neutral communications domain for Web/PWA, voice, DTMF, speech, SMS/MMS, email and push;
- private communication endpoints and purpose/channel preferences;
- append-only consent and normalized provider-event evidence;
- transactional, operational and marketing purpose classification;
- campground-scoped dispatch idempotency and cross-property endpoint isolation;
- bounded provider attempts with retryable/terminal failure conventions and capped backoff;
- free replaceable mock provider boundary;
- sanitized aggregate communications health in I.T. & Analysis;
- hosted Supabase migrations 0011/0012 with zero security-advisor lints;
- advisor-driven foreign-key index completion and rollback-only hosted verification with zero retained synthetic rows.

### Build 010 — Inbound/Outbound Voice & IVR Gateway
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campground-scoped private voice-line/provider bindings;
- inbound signed webhook gateway with bounded replay window;
- authenticated outbound voice routing through the canonical communications permission engine;
- transactional provider-event idempotency and call/dispatch/IVR state updates;
- provider-neutral semantic IVR state-machine foundation;
- same-campground staff transfer with safe fallback;
- free mock/sandbox voice provider for call placement, transfer and webhook normalization;
- append-only semantic IVR event evidence with no DTMF/PIN/payment/audio/transcript storage;
- sanitized voice-line/call/IVR/transfer health in I.T. & Analysis;
- hosted Supabase migrations 0013/0014 with zero security-advisor lints;
- advisor-driven voice foreign-key indexes and rollback-only hosted verification with zero retained synthetic rows.

### Build 011 — Numeric Keypad/DTMF Interaction Engine
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- provider-neutral numeric keypad/DTMF routing on the Build 010 voice gateway;
- short menu conventions for site, reservation and pass entry;
- repeat, back, main-menu and staff-transfer keypad conventions;
- transient multi-digit site/reservation/pass collection with no raw durable keypad storage;
- bounded timeout/invalid-input retries with staff fallback;
- sensitive PIN/verification classification and redaction;
- signed-provider DTMF normalization with campground/provider-event idempotency;
- append-only semantic IVR evidence and digit-free provider metadata;
- safe aggregate DTMF health in I.T. & Analysis;
- automated unit, repository and PostgreSQL lifecycle proof;
- hosted Supabase rollback verification with zero retained synthetic rows and zero security-advisor lints.

### Build 012 — SMS/MMS Conversation & Command Gateway
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- provider-neutral inbound/outbound SMS/MMS gateway;
- signed replay-bounded inbound webhook verification;
- guided numbered menus and keyword navigation;
- structured site/reservation/pass command parsing with identity verification gating;
- natural-language intent proposals with mandatory server validation;
- outbound MMS through validated secure-media assets and inbound MMS pending-scan metadata;
- campground authorization, dispatch/provider-event idempotency and delivery/read history;
- privacy-safe persistence with no raw durable message-body column;
- sanitized SMS/MMS health in I.T. & Analysis;
- hosted Supabase migrations 0015/0016 with zero security-advisor findings;
- advisor-driven composite foreign-key index closure and rollback/privacy verification;
- exact-tree `dev` and `main` production promotion with all GitHub gates GREEN.

### Build 013 — Telephone/SMS Identity, Verification & Staff Re-Authentication
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- caller ID/SMS sender treated only as routing hints, never authentication;
- private short-lived guest/staff channel verification challenges;
- salted scrypt verifiers for guest references, one-time codes and staff channel PINs;
- guest site/reservation/pass reference plus OTP verification;
- staff PIN verification and privileged PIN + OTP/recent-session re-authentication;
- bounded issuance, attempts, expiry, lockout and categorical fraud signals;
- canonical campground permission re-checking after identity verification;
- Build 006 privileged-action/audit integration with no secret echo;
- voice DTMF and structured SMS lookup intents gated behind `verify.identity`;
- sanitized aggregate verification health in I.T. & Analysis;
- hosted Supabase migration 0017 with zero Security Advisor findings;
- exact-tree `dev` and `main` promotion with independent GREEN GitHub gates.

## Current active build
**Build 014 — Messaging Consent, STOP/START/HELP & Preference Ledger**

Status: **IMPLEMENTED — PROMOTION GATES PENDING.**

Delivered on the feature branch:
- provider-level STOP suppression before outbound provider dispatch;
- START transport restoration without implicit Canadian marketing re-consent;
- HELP availability under suppression;
- purpose-specific marketing preference and append-only consent evidence;
- configurable jurisdiction rules with conservative Canadian fallback;
- normalized idempotent provider preference-event ledger;
- aggregate I.T. consent/preference health;
- PostgreSQL lifecycle and CI verification.

## Next queued build
**Build 015 — Telephone/SMS Workflow Parity Harness**

Status: **QUEUED — NOT STARTED**

## Operating rule
- Work primarily on `dev`.
- Promote to `main` only after applicable gates are GREEN.
- Every feature must declare Web/PWA, IVR/DTMF and SMS support or a documented safe/visual fallback.
- Prefer free/open-source software and free development tiers while preserving scale/migration paths.
- Treat iCamp as a live application whose requirements can evolve through versioned, modular changes.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
- After every completed build, provide the detailed summary defined in `docs/BUILD_OPERATING_MODEL.md`.
