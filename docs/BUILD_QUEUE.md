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

### Build 014 — Messaging Consent, STOP/START/HELP & Preference Ledger
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- provider-level STOP suppression before outbound provider dispatch;
- START transport restoration without implicit Canadian marketing re-consent;
- HELP availability under suppression;
- purpose-specific marketing preference and append-only consent evidence;
- configurable jurisdiction rules with conservative Canadian fallback;
- normalized idempotent provider preference-event ledger;
- aggregate I.T. consent/preference health;
- PostgreSQL lifecycle and CI verification;
- hosted Supabase migrations 0018/0019 with zero Security Advisor findings;
- advisor-driven compliance-rule foreign-key index closure;
- exact-tree `dev` and `main` promotion with independent GREEN GitHub gates.

### Build 015 — Telephone/SMS Workflow Parity Harness
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- executable Web/PWA, IVR/DTMF and SMS/MMS workflow parity registry;
- reusable IVR and SMS adapters over canonical domain commands;
- protected secure-link handoff for unavoidable visual steps;
- explicit staff-assisted telephone fallback;
- graphical-only workflow declarations instead of fake keypad equivalents;
- payment safety boundary that excludes raw card collection from custom IVR/SMS;
- aggregate workflow-parity health in I.T. & Analysis;
- automated guest/staff parity and dynamic visual-handoff proof;
- no database migration or paid communications provider required;
- exact-tree `dev` and `main` promotion with independent GREEN GitHub gates.

### Build 016 — Demo Campground, Test Data & End-to-End Harness
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- deterministic synthetic organization/campground/section/subsection seed;
- prototype-only demo sites, cottages and operational assets;
- production-failing seed guard with explicit non-production opt-in;
- non-production-only demo catalogue surface;
- Playwright Chromium browser end-to-end framework;
- CI database seed verification and browser smoke gates;
- no production personal data in fixtures;
- exact-tree `dev` and protected `main` promotion with independent GREEN GitHub gates.

### Build 017 — Campground, Section & Subsection Administration
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- protected campground, section and subsection administration;
- multiple ordered sections and subsections with active/inactive lifecycle;
- bounded section-specific operating settings;
- optimistic row-version conflict protection;
- campground-scoped permission checks and PostgreSQL RLS create/update boundaries;
- append-oriented audit evidence;
- management workspace integration with contextual help and freshness controls;
- Web/PWA visual editor with secure-link/staff-assisted IVR/SMS fallback;
- exact-tree `dev` and protected `main` promotion with independent GREEN GitHub gates.

### Build 018 — Overhead Image Library & Versioning
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- protected campground overhead/drone/site-plan image library;
- JPEG/PNG/WebP safe preflight, image-dimension checks and metadata sanitization;
- secure-media storage with checksum evidence and rollback cleanup;
- monotonically increasing map-image versions with one active and one published version per campground;
- permission-checked activation and privileged audited publication;
- authenticated previews, freshness tracking and circular contextual help;
- repaired secure-media filename validation for ordinary real-world image filenames;
- full-platform roadmap clarification for equipment/fleet, employee administration, occupational safety, advanced finance/job costing/tax worksheets, and hosted campground SaaS subscription entitlements;
- exact-tree `dev` and protected `main` promotion with independent GREEN GitHub gates.

### Build 019 — Zoom/Pan Coordinate Engine
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- canonical original-image and normalized 0–1 coordinate contract;
- invertible shared affine transform for raster imagery, overlays, future labels/polygons and pointer hit-testing;
- fit-to-viewport scaling, bounded pan and 25%–1600% zoom;
- focal-point-preserving wheel/button zoom;
- high-DPI device-pixel transform derived from the CSS transform;
- interactive management coordinate inspector using the active Build 018 image;
- mouse/pointer/touch and keyboard navigation with live source/normalized coordinate readouts;
- automated round-trip, high-DPI, zoom-anchor, repeated no-drift and pan-bound tests;
- contextual circular ⓘ help and freshness controls;
- explicit Build 020 boundary for polygon creation/persistence;
- exact-tree `dev` and protected `main` promotion with independent GREEN GitHub gates.

### Build 020 — Polygon Plotter Core
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- click-to-create irregular polygons over the active campground overhead image;
- explicit validated close-shape workflow;
- selectable draggable vertices with add/move/delete editing;
- self-intersection, duplicate-adjacent-point, bounds and minimum-area validation;
- canonical source-pixel plus normalized 0–1 geometry using the Build 019 transform;
- PostgreSQL persistence bound to the exact Build 018 overhead image version;
- optimistic row-version conflict protection and append-oriented audit evidence;
- campground-scoped `campground.map` authorization and private-schema storage;
- Web/PWA visual editor with honest secure-link/staff-assisted IVR/SMS fallback;
- contextual circular ⓘ help and freshness controls;
- hosted Supabase migrations 0020–0022 with zero Security Advisor findings;
- provider-portable platform decision register with no paid mapping API required;
- exact-tree feature and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 021 — Advanced Polygon Editing
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- whole-polygon movement using the Build 019/020 canonical source coordinate contract;
- duplicate with source-polygon provenance and active/visible/unlocked reset;
- 50-step session undo/redo for geometry edits;
- persistent lock/unlock with server-side geometry/label protection;
- hide/show without destructive removal;
- recoverable archive/restore lifecycle with actor/timestamp evidence;
- 0.25/1/5/10 px precision steps, snapping, bounds and centre calculations;
- selected-vertex or whole-polygon keyboard/button nudge and direct vertex-selection aids;
- optimistic row-version conflict protection and append-oriented audit evidence;
- campground-scoped `campground.map` authorization and private-schema persistence;
- Web/PWA full visual editing with honest secure-link/staff-assisted IVR/SMS fallback;
- hosted Supabase migration 0023 with verified columns/indexes, private table permissions and zero Security Advisor findings;
- no new Vercel project, Cloudflare Pages project, Worker, D1 database or R2 bucket;
- exact-tree feature, `dev` and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 022 — Map Layers, Labels & Icons
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- six canonical Booking, Maintenance, Security, Utilities, Amenities and Management layer families;
- server-enforced campground permission filtering before layers or their polygons reach the browser;
- persistent layer ordering, names, icons, enabled state and curated visibility permissions;
- required polygon-to-layer binding with same-organization/campground database enforcement;
- independent map-facing polygon labels plus optional whitelisted icon overrides and label visibility;
- inherited layer icons using application-owned glyphs with no third-party icon or mapping dependency;
- manager-only layer configuration and reorder actions protected by `campground.configuration`;
- optimistic row-version conflict protection and append-oriented audit evidence for layer changes;
- Web/PWA layer composition with honest secure-link/staff-assisted IVR/SMS fallback;
- Build 020/021 database verification preserved under the new required layer contract;
- hosted Supabase migration 0024 with verified schema/indexes/private privileges and zero Security Advisor findings;
- no new Vercel, Cloudflare, paid mapping, icon or GIS resource;
- exact-tree feature, `dev` and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 023 — Canonical Map Object Binding
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- canonical map identity anchors for sites, cottages, pools, washrooms, gates, docks, roads, buildings and generic assets;
- exactly one current polygon-or-point geometry binding per canonical object;
- unique polygon ownership so one saved polygon cannot silently represent multiple canonical objects;
- same-organization/campground foreign-key enforcement across canonical objects, map image versions, layers and polygons;
- database canonicalization of polygon image-version/layer metadata at the binding boundary;
- Build 019 source-pixel plus normalized 0–1 contract for exact point bindings;
- permission-filtered object inspector with canonical code/type/name, binding details, polygon attachment, point placement and unbind controls;
- server re-checks for `campground.map`, `campground.configuration` and bound-layer visibility permissions;
- append-oriented audit evidence for object creation, polygon/point binding and unbinding;
- circular contextual help plus honest visual-handoff/staff-assisted IVR/SMS fallback;
- hosted Supabase migrations 0025/0026 with private-table privilege verification and zero Security Advisor findings;
- advisor-driven composite foreign-key index closure with no remaining unindexed-FK advisory;
- no new Vercel, Cloudflare, paid mapping, GIS or icon resource;
- exact-tree feature, `dev` and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 024 — Unified Accommodation Model
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- one canonical accommodation parent shared by campsite, rental-cottage and permanent-unit inventory;
- exactly one enforced matching subtype linkage per accommodation;
- required same-scope linkage to a Build 023 canonical map identity, including the new permanent-unit map kind;
- automatic reuse of compatible unclaimed map identities or atomic creation of a matching identity;
- shared monotonic availability/status revision hooks without prematurely implementing later booking/status engines;
- lifecycle-aware inventory eligibility with common code, name, section and optional subsection administration;
- forced PostgreSQL RLS through the trusted `icamp_app` role with `accommodation.read` / `accommodation.manage` enforcement;
- direct `anon` and `authenticated` access kept revoked;
- optimistic row-version protection and append-oriented audit evidence for accommodation/map-identity creation and updates;
- Web/PWA accommodation registry, contextual circular help, freshness tracking and links to campground structure/map identities;
- honest IVR/DTMF and SMS/MMS staff-assisted administration boundary;
- hosted Supabase migration 0027 with zero Security Advisor findings and no new unindexed-FK advisory;
- no new Vercel, Cloudflare, paid mapping or external inventory resource;
- exact-tree feature, `dev` and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 025 — Campsite Types & Utility/Service Model
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campsite tent/RV/mixed classification with service and stay profiles;
- independent electrical, water, wastewater and Wi-Fi service facts;
- campsite/RV dimensions plus waterfront, pull-through, surface, shade, fire-ring and picnic-table characteristics;
- parent accommodation availability-revision propagation for campsite fit/service changes;
- forced-RLS management path, optimistic concurrency and append-oriented audit evidence;
- Web/PWA campsite administration with contextual help and honest staff-assisted IVR/SMS configuration fallback;
- hosted Supabase migration 0028 with verified schema/triggers/private access and zero Security Advisor findings;
- no new paid or hosted platform resource;
- exact-tree feature, `dev` and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 026 — Rental Cottage Model
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- rustic and serviced rental-cottage classification on the canonical Build 024 accommodation subtype;
- bedroom, bed and physical sleeping-occupancy facts;
- kitchen/kitchenette, private/shared washroom and shower configuration;
- heating, cooling, refrigerator, cooktop, oven and microwave facts;
- step-free access, accessible washroom and advertised view classification;
- parent accommodation availability-revision propagation for cottage compatibility changes;
- forced-RLS management path, optimistic cottage row-version concurrency and append-oriented audit evidence;
- visible integrated Accommodation assembly combining Build 024 identity, Build 025 campsite detail and Build 026 cottage detail;
- Web/PWA full cottage administration with contextual help and honest staff-assisted IVR/DTMF and SMS/MMS configuration fallback;
- hosted Supabase migration 0029 with 19/19 fields verified, both triggers active, direct anon/authenticated reads denied and zero Security Advisor findings;
- no new paid or hosted platform resource;
- exact-tree feature, `dev` and production promotion with CI, browser E2E, database, CodeQL and Secret Scan gates GREEN.

### Build 027 — Cottage Turnover & Housekeeping Model
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- reusable cottage turnover templates for departure, deep-clean, seasonal and maintenance-reset workflows;
- explicit linen and housekeeping instructions plus categorized cottage inventory checklists;
- immutable per-turnover checklist snapshots so template edits cannot rewrite historical work evidence;
- live checklist completion, issue notes and assigned turnover lifecycle state;
- repeatable damage/security readiness inspections with ready/blocked operational outcomes;
- canonical accommodation availability/status revision propagation for turnover lifecycle changes;
- forced-RLS `icamp_app` data access, direct anon/authenticated denial and append-oriented audit evidence;
- visible Build 027 turnover/housekeeping operations integrated directly into the existing Accommodation assembly;
- hosted Supabase migrations 0030/0031 with zero Security Advisor findings and advisor-driven composite FK index closure;
- transactional hosted verification of checklist snapshots, damage/security evidence and revision-hook propagation;
- no new paid or hosted platform resource;
- exact-tree feature, hardening, `dev` and production promotion with CI, Browser E2E, Database, CodeQL and Secret Scan gates GREEN.

### Build 028 — Site/Cottage Public Gallery: Up to 10 Images
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- maximum ten active guest-facing images per campsite or rental cottage with a single hero, explicit ordering, captions and required accessible alternative text;
- real source, thumbnail and optimized WebP delivery variants while reusing the existing Build 008 public-media storage boundary;
- browser-side free-first derivative preparation with server validation, avoiding a paid image-transformation dependency during prototype development;
- strict public-gallery separation from internal maintenance, housekeeping, damage and security evidence;
- audited gallery create/update/archive service with accommodation/media permission checks, optimistic concurrency and media lifecycle evidence;
- visible responsive gallery management integrated directly into the Accommodation Operations Workbench;
- durable iCamp Operations Workbench interface direction, replacing build-number navigation with role workspace, campground context, canonical object workbench and task-panel layers;
- hosted Supabase migration 0032 with forced RLS, direct-role denial, rollback-only ten-image/hero enforcement proof and zero Security Advisor findings;
- no new paid service, storage bucket, Vercel project, Cloudflare project or worker;
- exact-tree feature, `dev` and production promotion with CI, Browser E2E, Database, CodeQL and Secret Scan gates GREEN.

### Build 029 — Operational Asset & Equipment/Fleet Model
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- canonical operational asset parent with facility and equipment/fleet subtypes;
- pools, water parks, washrooms, fields, playgrounds, halls, beaches, docks, launches, roads, parking, gates, buildings, garbage/septic areas, utilities and similar facility types;
- tractors, mowers, maintenance vehicles, carts, trailers, power equipment, watercraft and other equipment/fleet types;
- make/model/serial/ownership facts, usage meter snapshot and storage/home location;
- required facility map identity plus optional mobile-equipment map linkage to Build 023 canonical objects;
- current operating-state/status-revision hooks while preserving Build 030 as the authoritative status-history and transition engine;
- forced-RLS asset/equipment permissions with direct anon/authenticated denial and audited writes;
- visible responsive Operational Assets & Equipment Operations Workbench integrated into Management → Campgrounds;
- repository-level Web, Mobile, SEO & Discovery contract with explicit noindex boundaries for authenticated workspaces/auth routes, H1/metadata/canonical/sitemap/structured-data/mobile/accessibility requirements for future public routes;
- hosted Supabase migrations 0033/0034, zero Security Advisor findings and advisor-driven composite FK index closure;
- no new Vercel, Cloudflare or paid hosted runtime;
- exact-tree feature, hardening, `dev` and production promotion with CI, Browser E2E, Database, CodeQL and Secret Scan gates GREEN.

### Build 030 — Accommodation & Asset Status Engine
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- authoritative accommodation states for available, held, reserved, arriving, occupied, departing, inspection, maintenance, winterized and closed;
- authoritative facility/equipment/fleet states for unknown, operational, limited, inspection, maintenance, unavailable, seasonal, winterized and closed;
- PostgreSQL-enforced transition rules and append-only status history for both state machines;
- actor, timestamp, optional reason, revision and audit evidence for every real status transition;
- accommodation status changes advance both status and availability revisions;
- optimistic row-version protection and server-authorized transition commands;
- responsive Management → Campgrounds → Status control centre spanning accommodations, facilities, equipment and fleet;
- hosted Supabase migrations 0035–0037 with zero Security Advisor findings and Build 030 RLS performance warnings closed;
- exact-tree feature, hardening, `dev` and production promotion with CI, Browser E2E, Database, CodeQL and Secret Scan gates GREEN;
- production merge SHA `50d0e05fe6c75efb620b8909aebdbad291076b86` independently GREEN after merge.

### Build 031 — Management Closures, Holds & Map Publication
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- bulk date-scoped closures and holds for accommodations, operational assets and campground sections;
- inclusive date windows, required reasons and database overlap protection;
- auditable management override semantics that cancel/supersede instead of rewriting history;
- cancellation-only mutation after creation with optimistic row-version protection;
- FORCE RLS and dedicated `campground.operations.manage` authorization;
- responsive Management → Campgrounds → Status controls for bulk scheduling, review and cancellation;
- safe map publication blocked by unbound/stale canonical object bindings unless an explicit audited override is used;
- append-only map publication switch evidence with publication revisions, readiness counts, actor and reason;
- hosted Supabase migrations 0038/0039 with zero Security Advisor findings and all Build-031-specific Performance Advisor warnings closed;
- exact-tree feature, advisor hardening, `dev` and production promotion with Verify, Browser E2E, Database, CodeQL/JavaScript analysis and Secret Scan gates GREEN;
- production merge SHA `7f5161a722ef4e9b9196405361f087b719ee27b7` independently GREEN after merge.

### Build 032 — Booking Calendar & Date Rules
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campground-local check-in/out times, booking lead windows and minimum/maximum stay rules;
- configurable weekend-day classification;
- named holiday and season calendars with optional stay overrides;
- append-preserved calendar evidence and server-side prevention of overlapping active seasons;
- provider-independent booking-date evaluator for lead time, stay bounds, weekend nights, holiday and season matching;
- responsive Management → Campgrounds → Booking calendar & date rules workbench with proposed-stay preview;
- FORCE RLS, actor-bound writes, no `icamp_app` DELETE privilege and append-oriented audit evidence;
- hosted Supabase migration 0040 as `20261013161558`, with zero Security Advisor findings and no Build-032-specific Performance Advisor regression;
- exact feature, `dev`, production PR and independent `main` verification with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN;
- production feature merge SHA `76019fd0ba807f89240556c6e5f02208b601dca1`.

### Build 033 — Capacity, Guest & Vehicle Limit Rules
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- layered occupant, visitor and vehicle limits by campground, accommodation type, section and individual accommodation;
- optional non-overlapping campsite-area bands with partial inheritance;
- rental-cottage physical sleeping capacity enforced as a hard ceiling;
- append-preserved capacity-rule evidence with archive-and-replace workflow;
- reusable server-side capacity evaluator and visible management preview;
- FORCE RLS, actor-bound writes, no `icamp_app` DELETE privilege and audited create/archive operations;
- hosted Supabase migration 0041 as `20261013172550`, with zero Security Advisor findings and no Build-033-specific Performance Advisor regression;
- exact feature, `dev`, production PR and independent `main` verification with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN;
- production feature merge SHA `048dd3fb874f6404b99d0c8ebfba91fd8bc51e31`.

## Active build in promotion
**Build 034 — Accommodation Compatibility Engine**

Status: **IMPLEMENTED — PROMOTION IN PROGRESS**

## Operating rule
- Work primarily on `dev`.
- Promote to `main` only after applicable gates are GREEN.
- Every feature must declare Web/PWA, IVR/DTMF and SMS support or a documented safe/visual fallback.
- Prefer free/open-source software and free development tiers while preserving scale/migration paths.
- Treat iCamp as a live application whose requirements can evolve through versioned, modular changes.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
- After every completed build, provide the detailed summary defined in `docs/BUILD_OPERATING_MODEL.md`.
