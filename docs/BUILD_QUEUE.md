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

### Build 034 — Accommodation Compatibility Engine
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- server-authoritative tent, RV and cottage compatibility evaluation;
- RV length, width, height, electrical, water, wastewater and Wi-Fi fit checks using existing campsite facts;
- cottage occupancy, accessibility and requested-feature checks using existing cottage facts;
- explicit campsite accessibility and campsite/cottage pet compatibility facts;
- Build 033 capacity rules folded into the same booking-fit result;
- stable server rejection contract for incompatible booking choices;
- visible Management → Campgrounds compatibility preview and audited policy management;
- hosted Supabase migration `20261013204945`, zero Security Advisor findings and no Build-034-specific advisor regression;
- exact feature, `dev`, production PR and independent `main` verification with Verify, Browser E2E, Database migrations, CodeQL and Secret Scan GREEN;
- production feature merge SHA `be04c5b7fbb15e9292124b7a3b70af8e5a95d4bf`.

### Build 035 — Server-Authoritative Live Availability
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- one server-authoritative date-window availability result across reservations, unexpired temporary holds, management closures/holds, unresolved cottage turnover and seasonal assignments;
- protected reservation, hold-source and seasonal-assignment persistence with direct anon/authenticated access denied;
- PostgreSQL advisory-lock serialization and conflict rejection for competing inventory writes;
- accommodation availability-revision propagation for reservation, hold and seasonal-assignment changes;
- reusable server rejection contract with `ICAMP_ACCOMMODATION_UNAVAILABLE`;
- responsive Management → Campgrounds → Live availability workbench with ten-second live refresh;
- explicit Build 036 boundary preserving atomic temporary-hold creation/countdown/expiry/idempotency for the next build;
- hosted Supabase migrations `20261013223449` and `20261013223746`, zero Security Advisor findings and closure of all Build-035-specific unindexed-foreign-key findings;
- production PR #138 and independent `main` verification with Verify, Browser E2E, Database migrations, CodeQL and Secret Scan GREEN;
- production feature merge SHA `b68953c20b2963c76fd56d7fc827b0ea615defae`.

### Build 036 — Atomic Temporary Reservation Holds
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campground-configurable temporary hold duration with bounded 2-60 minute policy;
- campground-scoped idempotency keys with deterministic retry behavior;
- advisory-lock serialization across hold-key retries and accommodation inventory;
- automatic expiry semantics, lazy expiry reconciliation and explicit idempotent release;
- RLS-protected hold mutation through the trusted `icamp_app` role while direct anon/authenticated mutation remains denied;
- Management → Campgrounds → Live availability → Temporary holds workbench with one-second countdown and pending-state action buttons;
- shared atomic hold authority documented for future Web/PWA, IVR/DTMF and SMS/MMS booking flows.

### Build 037 — Public Interactive Booking Map
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- date/type/availability-driven public booking map over the currently published campground map version;
- canonical accommodation-to-map polygon bindings with no duplicate public inventory model;
- green/grey/yellow/red operational presentation derived from live availability plus accommodation status;
- keyboard/touch selectable accommodation polygons and matching accessible list alternative;
- published overhead image access limited to media proven by PostgreSQL to be the active campground's published map;
- public workspace discovery link plus noindex query-filter safety during the unhosted rough-sketch phase;
- Web/PWA full visual flow with honest IVR/DTMF and SMS/MMS canonical-data/secure-handoff fallbacks;
- no database migration, new paid service, Vercel project, Cloudflare project, Worker, D1 database or R2 bucket.

### Build 038 — Campsite & Cottage Detail/Booking Experience
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- public campsite/rental-cottage detail pages linked from the Build 037 booking map with selected dates preserved;
- server-authoritative Build 035 live availability and blocker state;
- Build 028 up-to-10-image guest gallery using optimized public media only;
- canonical campsite and cottage features, pet/accessibility facts and Build 032 booking-rule summary;
- current published-map context plus canonical Amenities-layer discovery;
- truthful rate-status boundary with no fabricated amount before Build 039;
- Web/PWA full visual experience with IVR/DTMF and SMS/MMS concise canonical-data/secure-handoff contracts;
- no database migration or new hosted runtime.

### Build 039 — Rate Plans & Dynamic Date Pricing
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- canonical campsite/rental-cottage rate plans with accommodation-specific or accommodation-kind scope;
- nightly, weekly, monthly, seasonal and yearly price fields stored in integer cents;
- weekend, holiday, season, event and promotional dynamic adjustments;
- server-authoritative quote calculation integrated into the public accommodation detail experience;
- truthful unavailable-rate behavior instead of fabricated client-side pricing;
- FORCE RLS, actor-bound pricing writes and no application DELETE privilege;
- hosted Supabase migrations `20261014134304` and `20261014142429`;
- zero Supabase Security Advisor findings and closure of all Build-039-specific FK-index and duplicate-policy warnings;
- exact-tree feature, hardening, `dev` and production promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 040 — Add-Ons, Passes and Service Fees
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- canonical campground-scoped booking charge catalogue for add-ons, visitor passes and service fees;
- campground-wide, accommodation-type and accommodation-specific charge scope;
- per-stay, per-night, per-unit and percentage-of-stay pricing in integer minor currency units;
- server-authoritative automatic service-fee calculation and optional charge validation;
- extra guest/vehicle, visitor day/week pass, Wi-Fi, garbage pickup, rental, launch-fee and other add-on support;
- tax and fee classification hooks without invented tax rates;
- public campsite/cottage detail integration with canonical charge prices and automatic-fee estimate;
- FORCE RLS, explicit role grants, actor-bound pricing writes and no application DELETE privilege;
- hosted Supabase migration `20261014171830 / add_ons_passes_service_fees`;
- zero Supabase Security Advisor findings and no Build-040 performance WARN findings;
- exact-tree feature, `dev` and production promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 041 — Reservation Checkout
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- signed-in guest-owned temporary checkout holds with safe active-hold reuse;
- reservation-specific primary guest/contact data plus occupant, visitor, pet and vehicle counts;
- checkout-time Build 032 date-rule, Build 033 capacity and Build 034 compatibility revalidation;
- server-authoritative Build 039 accommodation pricing plus Build 040 selected add-ons, passes and automatic service fees;
- explicit campground booking-rule acknowledgement;
- atomic hold conversion into one idempotent pending reservation;
- immutable checkout, compatibility, rule, quote and charge-line evidence;
- Web/PWA full checkout with IVR/DTMF and SMS/MMS structured/secure-link handoff contracts;
- explicit no-payment boundary preserving deposits, balances and provider processing for Build 042;
- hosted Supabase migration `20261014203442 / reservation_checkout`;
- zero Supabase Security Advisor findings and no Build-041 performance WARN findings;
- exact feature, `dev` and production runtime promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 042 — Deposits, Balances & Payment Provider Adapter
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campground-configurable full, fixed-dollar and percentage booking deposits;
- refundable security deposits with booking, balance or arrival due stages;
- reservation balance rules for booking time, days before arrival or arrival;
- immutable reservation payment-policy schedules derived from the Build 041 accepted quote;
- provider-neutral, idempotent reservation payment attempts and payment-state evidence;
- free mock/sandbox payment provider adapter with deterministic capture;
- HMAC-signed, replay-bounded and idempotent payment webhook processing;
- guest payment progress plus campground payment-policy management;
- Web/PWA full payment flow with IVR/DTMF status-only and SMS/MMS secure-link fallbacks;
- explicit no-raw-card/PAN/CVV/provider-secret persistence boundary;
- hosted Supabase migrations `20261015012157 / deposits_balances_payment_provider` and `20261015012647 / payment_provider_fk_indexes`;
- zero Supabase Security Advisor findings and closure of all Build-042 unindexed-foreign-key findings;
- exact feature, advisor-hardening, `dev` and production runtime promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 043 — Confirmations, Receipts & Reservation Documents
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- confirmation after the immutable Build 042 booking-time payment obligation is satisfied, without requiring later balance or arrival-stage security amounts early;
- deterministic confirmation, invoice and receipt numbers backed by immutable reservation-document evidence;
- one confirmation and invoice per reservation plus one receipt per captured Build 042 payment;
- reservation transition from `pending` to `confirmed` without rewriting Build 041 accepted quote or Build 042 payment-schedule evidence;
- protected in-app confirmation, invoice, captured-payment receipt list and browser-printable reservation document view;
- provider-neutral transactional confirmation-email dispatch through the existing communications domain and free mock provider;
- FORCE RLS with `icamp_app` read-only access and trusted-server-only document writes;
- Web/PWA full document experience with IVR/DTMF concise status and SMS/MMS secure-link fallbacks;
- hosted Supabase migration `20261015025538 / confirmations_receipts_reservation_documents`;
- zero Supabase Security Advisor findings and no Build-043 performance WARN findings;
- feature PR #167, production PR #168, exact `dev` SHA `a434a8fa270220822ea2a578ad7c8589c361072a`, and runtime production `main` SHA `a98457e72863c61f9a4b9dd4973170c4a8522052`;
- exact feature, `dev` and production runtime promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 044 — Reservation Management Console
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campground-scoped staff reservation creation using current Build 039 rates and Build 040 booking charges;
- edit/move/extend/shorten workflows with optimistic row-version checks and transaction-level reservation serialization;
- accommodation/date changes enforced by the existing live-inventory conflict authority plus revision-signal hardening for accommodation-only moves;
- current reservation-management projection without rewriting Build 041 checkout, Build 042 payment-schedule/payment evidence or Build 043 confirmation/invoice/receipt evidence;
- add-on, pass and service-fee repricing through the canonical charge engine;
- cancellation that releases live inventory while explicitly executing no refund in Build 044;
- paid changes/cancellations flagged for Build 045 financial review;
- append-only complete reservation change history with before/after snapshots, reason, totals, delta, captured amount, actor, channel and idempotency evidence;
- FORCE RLS and campground reservation permission enforcement;
- Web/PWA full management console with verified-staff IVR/DTMF and SMS/MMS concise-action/secure-link fallbacks;
- hosted Supabase migration `20261015042048 / reservation_management_console`;
- zero Supabase Security Advisor findings and no Build-044 performance WARN findings;
- feature PR #171, production PR #172, exact `dev` SHA `e2dc44925ca2cc52cc59f6e9e099366c7b387f20`, and runtime production `main` SHA `fb6cd4bb1c6bbf0f01b3d24898cc2758b56ecc5c`;
- exact feature, `dev` and production runtime promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 045 — Cancellation, Refund & Adjustment Safeguards
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- campground-configurable cancellation/refund policy with early/late refund percentages, refundable security-deposit treatment, cancellation fee and approval threshold;
- policy-driven cancellation refund recommendations that never exceed captured, unrefunded Build 042 payment amounts;
- original-payment-linked partial, full and cancellation refund requests with idempotency and active-refund reservation safeguards;
- mandatory finance approval for threshold/policy overrides plus requester/approver separation;
- provider-neutral refund execution through the free mock adapter with normalized private provider-event evidence;
- append-only refund, credit, charge, forfeit, write-off and review-resolution financial adjustment evidence;
- zero-refund cancellation forfeit/review resolution without rewriting Build 041 quote, Build 042 payment, Build 043 document or Build 044 change-history evidence;
- FORCE RLS, campground finance/refund authorization and private provider-event boundaries;
- Web/PWA full financial safeguard workspace with IVR/DTMF status-only/staff-assisted fallback and SMS/MMS secure-link fallback;
- hosted Supabase migration `20261015124028 / cancellation_refund_adjustment_safeguards`;
- zero Supabase Security Advisor findings and no Build-045 performance WARN findings;
- feature PR #175, production PR #176, exact `dev` SHA `6ec3641c76c18db4f0635ef90448734b292c12b5`, and runtime production `main` SHA `7139df61f69f6c4e1466edd57830236db6642c99`;
- exact feature, `dev` and production runtime promotion with Verify, Browser E2E, Database/lifecycle/idempotence, CodeQL and Secret Scan GREEN.

### Build 046 — Walk-Up, Overflow & Office Booking
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- office, walk-up and overflow reservation intake against canonical reservations and Build 035 live availability;
- active overflow-area membership over canonical accommodations;
- append-only office-intake evidence with FORCE RLS and direct anon/authenticated denial;
- hosted Supabase migration `20261015140439 / walk_up_overflow_office_booking`;
- production PR #180 merged to `main` at `f2de91b194fa737136287973426685e94b83a8a9`.

### Build 047 — Seasonal/Yearly Assignment Foundation
Status: **FULLY PROMOTED — `main` GREEN.**

Delivered:
- canonical seasonal/yearly campsite and permanent-unit assignments over Build 035 availability;
- Build 039 server-derived long-term package pricing and immutable charge snapshots;
- append-only lifecycle evidence, `seasonal.manage` authorization and winterization handoff;
- hosted Supabase migrations through `20261015150438 / build047_production_hardening`;
- feature hardening PR #184 and production PR #185;
- production `main` SHA `49522aacad8eaa8f74ed4593cbfb7368d811112f` with CI, CodeQL and Secret Scan GREEN.

### Build 048 — Guest Profiles & Saved Stay Information
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #187, advisor-hardening PR #188 and production PR #189;
- hosted migrations `20261015174554 / guest_profiles_saved_stay` and `20261015222110 / build048_advisor_hardening`;
- Supabase Security Advisor: zero findings;
- final production `main` SHA `1c9f6aefe746807c9edc00ff39ed81d451d3f0ec`;
- exact production CI, CodeQL and Secret Scan GREEN;
- `dev` synchronized identically to `main`.

### Build 049 — Front Desk Check-In
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #190, advisor-hardening PR #191 and production PR #192;
- hosted migrations `20261016005314 / front_desk_check_in` and `20261016005631 / build049_advisor_hardening`;
- Supabase Security Advisor: zero findings;
- final production `main` SHA `1213782a1a376c8ebf2df46942cee5c703c62159`;
- exact production CI, CodeQL and Secret Scan GREEN;
- `dev` synchronized identically to `main`.

### Build 050 — Check-Out & Accommodation Turnover Trigger
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #193 and production PR #194;
- hosted migration `20261016123049 / check_out_accommodation_turnover`;
- Supabase Security Advisor: zero findings;
- final production `main` SHA `a01f94a63345b2290875f68471124c33986970ae`;
- exact production CI, CodeQL and Secret Scan GREEN;
- `dev` synchronized identically to `main`.

### Build 051 — My Stay Guest Portal
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #195 and production PR #196;
- hosted migration `20261016132713 / my_stay_guest_portal`;
- Supabase Security Advisor: zero findings;
- final production `main` SHA `7976cac430a7639376faeb12a7c820478608bb37`;
- exact production CI, CodeQL and Secret Scan GREEN;
- `dev` synchronized identically to `main`.

### Build 052 — Stay Extension & Accommodation Move
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #197 and production PR #198;
- hosted migrations `20261016222946 / stay_extension_accommodation_move` and `20261016223019 / build052_advisor_hardening`;
- Supabase Security Advisor: zero findings;
- Build-052 composite reservation foreign-key performance finding resolved;
- production feature `main` SHA `ac4fe9e8c9c60ef516f9e9cd02bdaca87e6f1ed6`;
- exact production CI run #38977366289, CodeQL run #38977366278 and Secret Scan run #38977366262 GREEN;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit GREEN.

### Build 053 — Road Vehicle Registration
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #200 and production PR #201;
- hosted migration `20261017025818 / road_vehicle_registration`;
- Supabase Security Advisor: zero findings;
- no Build-053 warning-level or unindexed-foreign-key Performance Advisor regression;
- exact feature head `f23b3119ca1c259318fdc893b58815cc9ceb2b6f` passed CI run #38997214216, CodeQL run #38997214246 and Secret Scan run #38997214181;
- exact `dev` merge SHA `9d23a9a704b72dec4a5fddade6534218d89ad379` passed CI run #38997343478, CodeQL run #38997343472 and Secret Scan run #38997343521;
- production PR gates passed CI run #38997477837, CodeQL run #38997477871 and Secret Scan run #38997477860;
- production feature `main` SHA `72f2b62bee6a92c0bb161a19b2e54e8bd9f7fd57` passed CI run #38997620167, CodeQL run #38997620126 and Secret Scan run #38997620122;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit GREEN;
- `dev` synchronized to the production feature SHA and independently reverified GREEN.

### Build 054 — Day/Week Vehicle Passes & Extra-Vehicle Fees
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #203 and production PR #204;
- hosted migrations `20261017174141 / day_week_vehicle_passes_extra_vehicle_fees` and `20261017174220 / build054_advisor_hardening`;
- hosted Build 054 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build-054 composite vehicle-pass payment foreign-key advisory resolved; only expected INFO-level unused-index notices remain for newly created Build 054 indexes;
- exact final feature SHA `8a0217acc5653d409bb22e6b0c42734c0ff27f9f` passed CI run #39054917527, CodeQL run #39054917539 and Secret Scan run #39054917560;
- exact `dev` merge SHA `c305dc2fa1879a85ba2d0db1f1c5d508ac695599` passed CI run #39055081080, CodeQL run #39055081131 and Secret Scan run #39055081075;
- production PR gates passed CI run #39055239989, CodeQL run #39055239953 and Secret Scan run #39055239986;
- production `main` SHA `07d087a96b3611d13f6a330ff9f78bddd87ace48` passed CI run #39055398337, CodeQL run #39055398510 and Secret Scan run #39055398259;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit GREEN;
- `dev` synchronized to the same production SHA and independently passed CI run #39055566951, CodeQL run #39055566940 and Secret Scan run #39055566950.

### Build 055 — Visitor Registration & Site-Specific Limits
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #206 and production PR #207;
- hosted migrations `20261017232511 / visitor_registration_site_specific_limits` and `20261017232536 / build055_advisor_hardening`;
- hosted verification SQL passed for both Build 055 migrations;
- Supabase Security Advisor: zero findings;
- the initial Build-055 composite host-accommodation foreign-key advisory was resolved by migration 0071; post-hardening performance output has no Build-055 unindexed-FK finding;
- exact final feature SHA `98e7b6d4a7d283a0041f77950150db09810e1fed` passed CI run #39079187569, CodeQL run #39079187553 and Secret Scan run #39079187550;
- exact `dev` merge SHA `87ebb7d7ef2f0d9aa3449e881d38160cc3d382bf` passed CI run #39079341256, CodeQL run #39079341275 and Secret Scan run #39079341258;
- production PR gates passed CI run #39079474315, CodeQL run #39079474394 and Secret Scan run #39079474366;
- production feature `main` SHA `d0bc9de1db61c3bb9d367e94a8a056f0642f5f0f` passed CI run #39079623126, CodeQL run #39079623161 and Secret Scan run #39079623125;
- `dev` synchronized to the same production feature SHA and independently passed CI run #39079764819, CodeQL run #39079764826 and Secret Scan run #39079764798;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit GREEN.

### Build 056 — Access Credential Abstraction
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #209, production feature PR #210 and production hardening PR #212;
- hosted migrations `20261018022823 / access_credential_abstraction`, `20261018022837 / build056_data_api_hardening` and `20261018022851 / build056_fk_index_hardening`;
- hosted Build 056 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Supabase Performance Advisor: zero non-unused-index findings after the scoped credential-event FK index hardening;
- hardened `dev` SHA `0d61a6415851dbc929e39e550d7a8b3aa5453c70` passed CI run #39090480678, CodeQL run #39090480576 and Secret Scan run #39090480656;
- production PR gates passed CI run #39090619658, CodeQL run #39090619678 and Secret Scan run #39090619759;
- hardened production `main` SHA `d87212e4df1fb1a55575466828b0f5df59b9aa13` passed CI run #39090737063, CodeQL run #39090737113 and Secret Scan run #39090737111;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit GREEN.

### Build 057 — Gate, Barrier & Access Device Registry
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #214 and production PR #215;
- hosted migration `20261018035652 / access_device_registry`;
- hosted Build 057 verification SQL passed;
- Supabase Security Advisor: zero findings;
- no Build 057 warning-level or unindexed-foreign-key Performance Advisor finding;
- final feature head `42e35d898eded12f3bd9e16731f8821017d4340b`, exact `dev` merge SHA `4e135790d2faf897565a70d7e971bbea8037feae`, and production feature `main` SHA `966c7f117df23b2f44dceffeb71753e9d05c5f61` passed the required GREEN gates.

### Build 058 — Access Event & Device Event Ledger
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #217 and production PR #218;
- hosted migration `20261018050416 / access_device_event_ledger`;
- hosted Build 058 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 058 Performance Advisor findings are only expected INFO-level unused-index notices, with no warning-level or unindexed-FK regression;
- final feature head `0e48f6436911ac035aa360a3ae1c14f583551fec`, exact `dev` merge SHA `d8a3aac92fecaa9d7e7b94905f364277543e6e34`, and production feature `main` SHA `85845e4fd595119ac5df89a8b8782f014458cf43` passed the required GREEN gates.

### Build 059 — Manual Gate Open/Close Override
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #220 and production PR #221;
- hosted migration `20261018140800 / manual_gate_override`;
- hosted Build 059 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 059 Performance Advisor findings are only expected INFO-level unused-index notices, with no warning-level or unindexed-FK regression;
- final feature head `5f02772863e47a022d92f82237a8bc6cdea41831`, exact `dev` merge SHA `78526d41cee9428adf015c6e40ef4d4cbbd04bd8`, and production feature `main` SHA `1835ec6d42fc3417866fcfd25f55108a6db2c238` passed the required GREEN gates.

### Build 060 — Access Zones, Schedules & Rules
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #223, advisor-hardening PR #224 and production PR #225;
- hosted migrations `20261018145114 / access_zones_schedules_rules` and `20261018145759 / access_rules_policy_hardening`;
- hosted Build 060 and hardening verification SQL passed;
- Supabase Security Advisor: zero findings;
- the initial four Build 060 multiple-permissive-policy warnings were corrected; final Performance Advisor has no Build 060 warning-level or unindexed-FK regression;
- final feature head `a8a59a1a188aeaa330f450fbb5884cf563a31b41`, final hardening head `26e86620e872e180086bfc4816d9caddaa94e66a`, exact production-candidate `dev` SHA `915e476707bd0c14e4fdb13436dd9f7acc0dc11a`, and production feature `main` SHA `5bb52fd05929a4277e7e712f069ec394e4726bf1` passed the required GREEN gates.

### Build 061 — Passes, Wristbands & QR Codes
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #227 and production PR #228;
- hosted migration `20261018205024 / access_passes_wristbands_qr`;
- hosted Build 061 verification SQL passed;
- Supabase Security Advisor: zero findings;
- final Performance Advisor has no Build 061 warning-level, multiple-permissive-policy or unindexed-FK regression;
- final feature head `84be1df1974db1b3a40dafe8fc728f3cdd59c5c7`, exact `dev` merge SHA `3a0defceb9caae2be1964bbaf3f2e504f3dd2db3`, and production feature `main` SHA `222bec157754e99de2e8d7eb71cd3af745d95e57` passed the required GREEN gates.

### Build 062 — Credential Lifecycle at Check-In/Check-Out
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #232 and production PR #233;
- hosted migration `20261019013014 / credential_lifecycle_checkin_checkout`;
- hosted Build 062 verification SQL passed;
- Supabase Security Advisor: zero findings;
- final Performance Advisor has no Build 062 warning-level, multiple-permissive-policy or unindexed-FK regression;
- final feature head `b0855d68ee02aa2bfa629426667cf3d7e9d28432`, exact `dev` merge SHA `36846168730f380601441f50ee18db453c7983a1`, and production feature `main` SHA `fb118fe89764d8cb0608320d3156c951e37faa5d` passed the required GREEN gates.

### Build 063 — Security & Access Operations Dashboard
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #235 and production PR #236;
- no database migration was required because Build 063 is a read-only aggregation over the existing Build 056–062 access domains;
- final feature head `331526fb2713d475cbaab481abd69f65ffc2ce02`;
- exact `dev` merge SHA `6ed8fb82fe74cb452e03f684b4fda7a87409363a`;
- production feature `main` SHA `e6d337c8b117337e546a516525b600f782815a6b`;
- feature, `dev`, production PR and production `main` gates all passed Verify, Browser E2E, database compatibility, CodeQL/TypeScript analysis and Secret Scan;
- full Web/PWA security operations dashboard delivered with documented IVR/DTMF and SMS secure/verified fallback boundaries;
- no raw PIN, QR bearer token, credential/pass fingerprint, controller secret or provider credential is exposed;
- security fault/denial/override-failure signals are surfaced without fabricating canonical incident cases.

### Build 064 — Maintenance Taxonomy & Priority Model
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #239 and production PR #240;
- final feature head `ebeed8af1d95b99d454f2c444a0847108147d94a`;
- exact `dev` merge SHA `ccf41c424a9d1594bb8da1ed8b2ac42ead907e64`;
- production feature `main` SHA `dbebcdb8d8a02306a8be72ffe486c9ed2a36e4c6`;
- hosted migration `20261020163500 / maintenance_taxonomy_priority_model`;
- hosted Build 064 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Performance Advisor: no Build 064 warning/error regression; only expected INFO-level unused-index notices;
- feature, `dev`, production PR and production `main` gates passed Verify, Browser E2E, database lifecycle/idempotence, CodeQL/TypeScript analysis and Gitleaks.

### Build 065 — Work Order Engine
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #242 and advisor-hardening PR #243;
- hosted migrations `20261021000714 / maintenance_work_order_engine` and `20261021001253 / build065_advisor_hardening`;
- hosted Build 065 and advisor-hardening verification SQL passed;
- Supabase Security Advisor: zero findings;
- the initial 11 Build 065 unindexed scoped foreign-key INFO findings were resolved; final Build 065 unindexed-FK findings: zero;
- final production candidate `dev` SHA `32e5b32b209a929765ff34caff3a8726b415dbe8`;
- production PR #244;
- production feature `main` SHA `3cdbcf01b1591f2da7b3f3db1f83026dab4b5bc2`;
- production `main` independently passed CI #39520285693, CodeQL #39520285652 and Secret Scan #39520285684;
- Verify, Browser E2E, database lifecycle/idempotence, production build and dependency audit GREEN.

### Build 066 — Maintenance Roles, Foreman Queue & Escalation
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #246 and production PR #247;
- hosted migration `20261021005246 / maintenance_roles_foreman_escalation`;
- hosted Build 066 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 066 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- final feature head `06fabfb2a9d6066eecf82b973d7b8931d96f7cbc`;
- exact production-candidate `dev` SHA `39e635dcb2a4261e945c7576e98e406e75569a69`;
- production feature `main` SHA `5e43374ce4b25aeb42908e2c587330caccb5fb7b`;
- production `main` independently passed CI #39524236466, CodeQL #39524236470 and Secret Scan #39524236488;
- Verify, Browser E2E, database lifecycle/idempotence, production build and dependency audit GREEN.

### Build 067 — Recurring Maintenance Scheduler
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #249 and production PR #250;
- hosted migration `20261021014030 / recurring_maintenance_scheduler`;
- hosted Build 067 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 067 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- final feature head `205bc63e3c9d75a5cf29ac2c24a6946563ef5989`;
- exact production-candidate `dev` SHA `9f675498f2443511b5d5f728884c69f68ae7c7b8`;
- production feature `main` SHA `5787f35d9e1a50080b291299964bb213b5288a68`;
- production `main` independently passed CI #39528974035, CodeQL #39528973978 and Secret Scan #39528974075;
- Verify, Browser E2E, database lifecycle/idempotence, production build and dependency audit GREEN.

### Build 068 — Versioned Inspection Templates & Sign-Off
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #252, advisor-hardening PR #253 and production PR #254;
- hosted migrations `20261021033954 / versioned_inspection_templates_signoff` and `20261021034526 / build068_advisor_hardening`;
- hosted Build 068 and hardening verification SQL passed;
- Supabase Security Advisor: zero findings;
- final Build 068 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- exact hardened production-candidate `dev` SHA `db823f7efd33a7de75594752eecd15bcaf3d57df`;
- production feature `main` SHA `b473656d6d9419ac7b9777a22d05fcc640309d31`;
- production `main` independently passed CI #39540567345, CodeQL #39540567377 and Secret Scan #39540567402;
- Verify, Browser E2E, database lifecycle/idempotence, production build and dependency audit GREEN;
- future graphical/style work is explicitly gated on the documented standard multi-theme semantic-token ruleset.

### Build 069 — Pool & Water-Park Maintenance Operations
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #256 and production PR #257;
- hosted migration `20261021123137 / pool_waterpark_maintenance_operations`;
- hosted Build 069 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 069 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- final feature head `145b879c44322ec6e676c206df601851bd8e61ec`;
- exact production-candidate `dev` SHA `6231e7eafa29913647e3dedd9ba241c714838be1`;
- production feature `main` SHA `94856870eb9139f5a9fc2fb400b6451ed1a82783`;
- production `main` independently passed CI #39600722731, CodeQL #39600723132 and Secret Scan #39600722794;
- Verify, Browser E2E, database lifecycle/idempotence, production build and dependency audit GREEN;
- the future multi-theme graphical/style prerequisite remains unchanged and binding.

### Build 070 — Washroom, Shower & Laundry Upkeep
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #259 and production PR #260;
- final feature head `b1563c3ffa3471b2234e8bff19aee163b2d1d7ee`;
- exact production-candidate `dev` SHA `6c9ab06e66cb441d34f825f037af733399daae2b`;
- production feature `main` SHA `08795cdf215c15543f851d8427cce0eb68e219f5`;
- hosted migration `20261022004203 / washroom_shower_laundry_upkeep`;
- exact Build 070 hosted verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 070 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- production `main` independently passed CI #39703764882, CodeQL #39703764911 and Secret Scan #39703764885;
- Verify, Browser E2E, database lifecycle/idempotence, production build, dependency audit, TypeScript analysis and Gitleaks were GREEN.

### Build 071 — Baseball, Sports, Playground & Hall Maintenance
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #264;
- final feature head `7989abe7aad45888a2dc7814ea26bb30d9c413ea`;
- exact independently verified `dev` SHA `ee92544d139789e428d0c4528b8134078430fbb3`;
- hosted migration `20261022033418 / baseball_sports_playground_hall_maintenance`;
- exact hosted Build 071 verification SQL passed;
- Supabase Security Advisor: zero findings;
- Build 071 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- clean production PR #266;
- production `main` SHA `33e5b201d6cc5c656ed6aed43cbb98e167c91d71`;
- production `main` independently passed CI #39718176592, CodeQL #39718176621 and Secret Scan #39718176597;
- Verify, Browser E2E, database lifecycle/idempotence, production build, dependency audit, TypeScript analysis and Gitleaks were GREEN;
- direct production PR #265 was closed without merge because squash-history divergence made it dirty; the clean main-based promotion preserved Build 070 and isolated the 13 Build 071 changes.

### Build 072 — Roads, Utilities, Garbage & Septic Maintenance
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #268 and clean production PR #270;
- final feature head `399549e6132b574f1949926defd24cbff68397b4`;
- exact independently verified production-candidate `dev` SHA `3e03325fd56d91e9f16d9e4b01460b2d7048e373`;
- hosted migration `20261022125530 / roads_utilities_garbage_septic_maintenance`;
- exact hosted Build 072 verification SQL passed;
- Supabase Security Advisor: zero findings;
- no Build 072 warning/error or unindexed-foreign-key Performance Advisor finding; only expected INFO-level unused-index notices remain;
- production feature `main` SHA `2bd712ab81284ff5ae56ccabe215dd9c2841c233`;
- production `main` independently passed CI #39787429477, analysis #39787429470 and Gitleaks #39787429430;
- Verify, Browser E2E, database lifecycle/idempotence, production build, dependency audit and JavaScript/TypeScript analysis were GREEN;
- clean main-based promotion isolated the 12 Build 072 files/edits and preserved Build 071 closeout history.

### Build 073 — Departure Campsite Cleanup
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #272 and advisor-hardening PR #273;
- final feature head `8375b5f504fbcb0b1c5d3a690edb8df5d8ebacf1`;
- exact independently verified production-candidate `dev` SHA `3fea3b34cf38464ed9445c5f574cdb34dba249d2`;
- hosted migrations `20261022150031 / departure_campsite_cleanup` and `20261022152556 / build073_advisor_hardening`;
- exact hosted Build 073 verification SQL passed for both migrations;
- Supabase Security Advisor: zero findings;
- final Build 073 unindexed-foreign-key findings: zero; only expected INFO-level unused-index notices remain;
- clean production PR #274 isolated the 17 Build 073 files/edits;
- production feature `main` SHA `34b0cbbb68f62dbe459de69bcfbd0aede83030f9`;
- production `main` independently passed Verify, Browser E2E, database lifecycle/idempotence, JavaScript/TypeScript analysis and Gitleaks;
- Build 068 multi-theme semantic-token prerequisite remains binding for future graphical/style work.

### Build 074 — Cottage Housekeeping & Turnover
Status: **FULLY PROMOTED — `main` GREEN.**

Promotion evidence:
- feature PR #282 and production PR #283;
- final feature head `1b996768e8be20136abc8d4cdda45e503101cba7`;
- exact production-candidate `dev` SHA `933029e0743273f6ba84bbfc08df6f4ec069d2fe`;
- hosted migration `20261022190122 / cottage_housekeeping_turnover_operations`;
- exact hosted Build 074 verification SQL passed;
- Supabase Security Advisor: zero findings;
- production `main` SHA `56d84e8f50226742ff511b95f19dbfb3026687bc`;
- production `main` independently passed CI #39838203949, CodeQL #39838203417 and Secret Scan #39838203443;
- Verify, Browser E2E, database lifecycle/idempotence, production build, dependency audit, JavaScript/TypeScript analysis and Gitleaks were GREEN.

## Build 082 — Delivery: Versioned Campground & Facility Rule Sets

This advances the historical Build 082 scope after Build 081 garbage collection reconciliation:

- stable campground/facility rule identities, immutable version publication and seven categories;
- current-version staff and guest views, plus explicit reservation-linked exact-version acknowledgements;
- isolated publish/read roles, guest ownership validation, scoped FORCE RLS, append-only evidence;
- no implicit access suspensions, payment changes, booking contractual rewriting or false IVR/SMS acknowledgements.

Next in the active queue: **Build 083 — Warning, Suspension & Reinstatement Workflow**.

## Most recently fully promoted build
**Build 077 — Camper Assistance Request Interface**

Status: **FULLY PROMOTED — `main` GREEN**

Production evidence:
- exact production-candidate `dev` SHA `8a83abd00c295dea5879f5c332a801d4c2dc7e84`;
- production `main` SHA `f82c0402fbccdcea5512a5469b574f07ca635f67`;
- exact production push passed CI #39993067353, CodeQL #39993067258 and
  Secret Scan #39993067391;
- CI Verify, Database migrations and Browser end-to-end all completed
  successfully on that exact production SHA;
- hosted Build 077 migrations and exact verification SQL passed;
- Supabase Security Advisor returned zero findings.

## Current delivery target
**Build 078 — Assistance Triage & Management Escalation**

Scope, advancing historical Build 079:
- separate operational case projection over immutable Build 077 camper intake;
- reclassification of operational category and priority without rewriting the
  original guest evidence;
- campground-scoped assignment to active staff;
- dedicated assistance triage, escalation, communication and close authorities;
- append-only internal notes and guest-visible communication evidence;
- explicit management escalation with acknowledge/resolve lifecycle;
- terminal outcome-based closure after active escalation is resolved;
- optimistic row-version protection for case/escalation mutations;
- Management workspace queue plus My Stay operational status/update visibility;
- FORCE RLS and no direct anonymous/authenticated Data API access;
- Web/PWA full console with verified IVR/DTMF and SMS secure-handoff parity.

Next after Build 078: **Build 079 — Garbage Service Models**,
advancing historical Build 080.

### Queue horizon after Build 078
- immediate detailed queue remaining after successful promotion:
  **Builds 079–081 (3 builds)**;
- broader active roadmap after Build 078: **Builds 079–156 (78 builds)**;
- the existing several-build planning batch remains sufficient through Build 081.

## Build 086 — Emergency Communication & Safety Guardrails

Implementation delivered for production verification:
- campground/section/site/staff audience-specific immutable notice drafts;
- independent management approval, rejection and cancellation;
- approved-notice manual handoff evidence only after real on-site action;
- emergency-services, accessibility, evacuation and physical-safety boundaries;
- private RLS permissions, source-verified audit history, help and tests.

See `docs/BUILD_086_ACCEPTANCE.md`. Next queued: **Build 087 — Seasonal/Yearly Winterization Workflow**.

## Build 087 — Seasonal/Yearly Winterization Workflow

Implementation ready for verification and staged promotion:
- campground-specific immutable shutdown templates with mandatory water isolation and line draining;
- version-pinned winter work runs linked to canonical Build 047 seasonal/yearly assignments;
- append-only observation/evidence and corrective maintenance-work-order linkage;
- independent maintenance lead/main foreman sign-off for active campground runs only;
- database-enforced seasonal assignment winter-close prerequisite for flagged sites;
- role-restricted management dashboard, contextual help, and RLS-safe test data.

See `docs/BUILD_087_ACCEPTANCE.md`. Next queued: **Build 088 — Cold-Weather Winter-Readiness Compliance**.

## Build 088 — Cold-Weather Winter-Readiness Compliance

Delivery scope:
- an auditable, policy-versioned alternative for eligible sites that may remain open in winter;
- mandatory site observations for water insulation or verified waterless mode, safe heating/power, wastewater protection and winter emergency access;
- explicit defect-to-maintenance-work-order loop and independent manager/foreman approval;
- no bypass of Build 087 required shutdown, no automatic winter booking activation and no physical equipment control;
- private campground-scoped RLS, management UI, contextual help and Camp Rosevear synthetic-data safeguards.

See `docs/BUILD_088_ACCEPTANCE.md`. Next queued: **Build 089 — Spring Reopening Inspection**.

## Build 089 — Spring Reopening & Return-to-Service Safety

Delivery scope:
- immutable campground spring inspection policy with water restoration, safe utilities, sanitation, fire, grounds access and site condition requirements;
- closure-event-pinned seasonal/yearly inspections, plus standalone site records;
- append-only on-site observations, completed corrective work order prerequisites and independent approval;
- canonical long-term `reopened` action gated by the latest winter-close event's spring approval;
- Camp Rosevear synthetic-data safety, private RLS, Web/PWA management, contextual help and safe voice/SMS handoff.

See `docs/BUILD_089_ACCEPTANCE.md`. Proposed next: **Build 090 — Spring Opening Owner Acceptance & Cross-System Operational Hold Review**.

## Build 090 — Spring Opening Owner Acceptance & Cross-System Operational Hold Review

Delivery scope:
- campground-scoped read-only owner evidence and operational hold snapshot;
- latest winter-close pinning, fail-closed missing evidence and live availability permission failures;
- independent reservation/hold/restriction/turnover/seasonal blockers remain authoritative;
- no automatic owner sign-off, booking release or physical safety action.

See `docs/BUILD_090_ACCEPTANCE.md`. The earlier roadmap's permanent-unit Build 090 number conflicts with the active queue and requires explicit renumbering before that separate feature begins.

## Build 091 — Permanent-Unit Ownership-Backed Listing & Buyer Inquiry

Delivery scope:
- owner evidence for a movable/permanent unit kept distinct from campground land and occupancy rights;
- ownership-pinned private listing drafts with independent review;
- current-approved-listing buyer inquiry intake; stale ownership invalidates intake;
- privileged management UI, scoped database safeguards, contextual help and no transfer/payment/public publication side effects.

See `docs/BUILD_091_ACCEPTANCE.md`. Next queued: **Build 092 — Permanent Unit Sale/Transfer Workflow**.

## Build 092 — Permanent Unit Sale/Transfer Workflow

Delivery scope:
- buyer applications pinned to approved listings and matching inquiries;
- six required inspection/fee/document/closing evidence domains, independently reviewed;
- separate, atomic unit-owner ledger handoff and closeout receipt;
- campground-scoped private RLS, Web/PWA management, contextual help, no automatic land/lease/payment transfer.

See `docs/BUILD_092_ACCEPTANCE.md`. Next queued: **Build 093 — Office Financing Application Intake**.

## Operating rule

## Build 110 — Owner Export Follow-Up Aging & Decision Reassessment Audit

Delivery scope:
- a complete owner-only, directed campground-pair aging summary from the latest Build 109 decision per review, retaining the original due date beside the effective reassessed due date; overdue, seven-day, 30-day, later, closure-recommended and final no-action classifications;
- a separate append-only independent reassessment ledger with due dates and evidence references; the reviewer must differ from the original decision-maker, stale decisions are rejected under the same review concurrency lock as Build 109, and manual escalation cites an unclosed Build 107 case;
- database-derived counts of unresolved source exceptions and new cases since the Build 109 review, with conservative closure recommendations requiring independent closeout and no new cases; forced dual-campground RLS, bounded workbench/audit history and contextual help; no actual case closure, applicant data, financial actions, automatic tasks, messaging or file deletion.

See `docs/BUILD_110_ACCEPTANCE.md`. Next expected: **Build 111 — Owner Export Reassessment Follow-Up Outcomes & Independent Closure Acceptance**.

## Build 109 — Owner Export Oversight Review Notes & Follow-Up Decision Ledger

Delivery scope:
- owner-only, pair-scoped 30/90/180-day exception review snapshots with DB-derived immutable total, unclosed, and recurring-receipt counts; category filter and next review within 90 days;
- a separate append-only manual decision ledger for monitor, follow-up, escalation citing an in-scope source exception, or terminal no-action; explicit bounded next due dates, evidence references and notes, with serial concurrency checks;
- both sides reauthorized in the server and forced private RLS, immutable guards, bounded review/case/decision history, contextual help and a direct Build 108 report handoff. No source case closure, applicant/lending actions, automatic messages, local file deletion or owner-data leakage.

See `docs/BUILD_109_ACCEPTANCE.md`. Next expected: **Build 110 — Owner Export Follow-Up Aging & Decision Reassessment Audit**.

## Build 108 — Owner Export Exception Recurrence & Retention Oversight Reporting

Delivery scope:
- an owner-only, read-only 30/90/180-day UTC report over existing append-only export receipts, reconciliations, copy retention evidence, exception cases, outcomes and independent audit reviews;
- observed reopened receipts, repeated campground-pair/issue categories, overdue owner actions, current control gaps, and weekly independently accepted/returned review activity;
- exact cohort totals with separately bounded 50-case and 100-group drilldowns, 50-campground coverage warnings, cross-pair owner permission checks, existing forced database RLS, additive pair/time reporting indexes, contextual help and direct links to Build 107; no historical evidence modification or automated applicant/financial/file/communication actions.

See `docs/BUILD_108_ACCEPTANCE.md`. Next expected: **Build 109 — Owner Export Oversight Review Notes & Follow-Up Decision Ledger**.

## Build 107 — Owner Export Retention Exception Follow-Up & Audit Closeout

Delivery scope:
- detect currently missing/mismatched owner export reconciliation and missing/overdue manual copy retention, then open one active source-receipt-linked case with a bounded next owner action;
- append-only follow-up and escalation outcomes that reference corrective Build 106 evidence before a case can become review-ready;
- independent second-owner audit acceptance or returned follow-up, rechecking current source evidence under concurrency locks; forced dual-campground RLS, owner workbench and contextual help; no applicant, lending, transfer, deletion or communication side effects.

See `docs/BUILD_107_ACCEPTANCE.md`. Next queued: **Build 108 — Owner Export Exception Recurrence & Retention Oversight Reporting**.

## Build 106 — Owner Export Receipt Reconciliation & Evidence Retention Controls

Delivery scope:
- independent authorized owner SHA-256 and row-count reconciliation against the original Build 105 acceptance receipt, retaining both matched and mismatched observations without modifying the source receipt;
- append-only, source-linked attestations for controlled local storage, bounded retention deadline extensions and terminal manual copy disposal; overdue reviews are visible, never silently purged;
- dual-campground owner-only forced RLS and SQL transition/independence guards, integrated owner workbench and contextual ⓘ help; no remote file deletion, applicant data, finance approvals, transfer, hold release or automatic communications.

See `docs/BUILD_106_ACCEPTANCE.md`. Next queued: **Build 107 — Owner Export Retention Exception Follow-Up & Audit Closeout**.

## Build 105 — Cross-Campground Owner Resolution Evidence Search & Export Acceptance

Delivery scope:
- owner-only, server-side search of existing Build 103/104 handoff resolutions, latest independent reassessments and acceptances, with literal evidence-reference search, dual campground/status/date filters and paginated coverage warnings;
- explicitly acknowledged CSV export for one independently authorized campground pair, restricted to 1–50 untruncated metadata-only records, with spreadsheet-injection protection and a transaction-consistent SHA-256 fingerprint;
- immutable, dual-RLS-protected export acceptance receipt recording the exact scope, evidence reference, actor, row count and hash, with no applicant, lending, unit-transfer, hold-clearing, messaging or automation side effects.

See `docs/BUILD_105_ACCEPTANCE.md`. Next queued: **Build 106 — Owner Export Receipt Reconciliation & Evidence Retention Controls**.

## Build 104 — Owner Handoff Resolution Reassessment & Independent Review Acceptance

Delivery scope:
- immutable cross-campground planning-resolution reassessments by a different authorized owner than the original resolver, with supporting evidence and bounded next review when issues remain;
- single source-linked planning acceptance citing the latest supported reassessment, by an owner other than the reviewer, with concurrency protection against stale evidence;
- dual-campground owner-scoped RLS, operator forms, status/history and contextual ⓘ help; no automatic applicant movement, finance decisions, hold release, communications or task creation.

See `docs/BUILD_104_ACCEPTANCE.md`. Next queued: **Build 105 — Cross-Campground Owner Resolution Evidence Search & Export Acceptance**.

## Build 103 — Owner Planning Follow-Up Outcomes & Cross-Campground Resolution Evidence

Delivery scope:
- append-only, source-plan-linked owner coordination outcomes, with a bounded next-action date for open follow-up and terminal states for target review complete or unable to proceed;
- a separate one-time owner planning resolution citing the latest terminal outcome, protected from concurrent stale writes and with no automated applicant, financing, delivery hold, messaging or task side effects;
- independent active owner authorization on both campgrounds and forced row-level security, privacy-safe notes, contextual ⓘ help and visible coverage warnings.

See `docs/BUILD_103_ACCEPTANCE.md`. Next queued: **Build 104 — Owner Handoff Resolution Reassessment & Independent Review Acceptance**.

## Build 102 — Owner Trend Review Annotations & Cross-Campground Follow-Up Handoff Planning

Delivery scope:
- append-only owner annotations on the last 12 UTC weeks of consent, exception and task activity, with source references, owner interpretation and bounded next-review dates;
- handoff plans linked to a source trend annotation and a second authorized owner campground, with no automatic task assignment, customer movement, lending decisions, messages or hold release;
- dual-campground owner authorization under RLS (including cross-organization scope), separated planning screen, ⓘ help, bounded history and user-input validation.

See `docs/BUILD_102_ACCEPTANCE.md`. Next queued: **Build 103 — Owner Planning Follow-Up Outcomes & Cross-Campground Resolution Evidence**.

## Build 101 — Cross-Campground Finance Portfolio Owner View & Risk-Neutral Trend Reports

Delivery scope:
- read-only owner-only portfolio for multiple campgrounds, requiring an active Owner / Administrator role and finance-operations permission for each property independently;
- privacy-safe operational counts over selectable 7-, 30-, and 90-day activity windows, with separate current hold/overdue task snapshots;
- 12-week UTC event-count trends and campground breakdowns, no applicant records, lending/credit profiling, automated messaging or exception releases.

See `docs/BUILD_101_ACCEPTANCE.md`. Next queued: **Build 102 — Owner Trend Review Annotations & Cross-Campground Follow-Up Handoff Planning**.

## Build 100 — Finance Follow-Up Portfolio Monitoring & Exception Recurrence Review

Delivery scope:
- restricted campground-level summary of held cases, outstanding and overdue manual owner tasks, completed administrative tasks and repeated exception reasons;
- deterministic repeat classification (at least two holds with the same reason for the same consent), with bounded display coverage and filters;
- append-only, independently reviewed recurrence observations pinned to current event and verified counts, with contextual help and zero automatic lending, customer communications or hold release.

See `docs/BUILD_100_ACCEPTANCE.md`. Next queued: **Build 101 — Cross-Campground Finance Portfolio Owner View & Risk-Neutral Trend Reports**.

## Build 099 — Owner Follow-Up Task Continuity, Reassessment & Escalation Closure Evidence

Delivery scope:
- one immutable assigned task per accepted campground owner escalation, with bounded due date;
- private owner-only progress evidence with append-only source references, independent reassessment and segregation of duties;
- restricted, owner-authorized administrative closure pinned to the latest reassessment without altering exception holds, applicant consent, credit decisions or transfers.

See `docs/BUILD_099_ACCEPTANCE.md`. Next queued: **Build 100 — Finance Follow-Up Portfolio Monitoring & Exception Recurrence Review**.

## Build 098 — Finance Delivery Exception Ageing, Re-Review & Owner Escalation

Delivery scope:
- deterministic 24h/72h operational ageing of exception, reconciliation or consent evidence origins;
- immutable independent re-review observations and bounded next-review dates;
- private owner escalation request and designated owner acknowledgement without automated messaging or hold clearance.

See `docs/BUILD_098_ACCEPTANCE.md`. Next queued: **Build 099 — Owner Follow-Up Task Continuity, Reassessment & Escalation Closure Evidence**.

## Build 097 — Finance Delivery Evidence Reconciliation & Operator Closure Review

Delivery scope:
- exact version/hash-linked immutable consent, sign-off, manual receipt, applicant response and exception snapshots;
- database-derived completeness state, with disputed/missing or held evidence returned for follow-up;
- independent, immutable operator review allowing administrative evidence closure only when the evidence remains current and unheld.

See `docs/BUILD_097_ACCEPTANCE.md`. Next queued: **Build 098 — Finance Delivery Exception Ageing, Re-Review & Owner Escalation**.

## Build 096 — Manual Delivery Evidence Receipt, Applicant Acknowledgement & Exception Holds

Delivery scope:
- restricted, append-only staff attestation that a consent-matched manual handoff happened outside iCamp, after independent Build 095 readiness;
- independent, evidence-linked applicant receipt-confirmed/disputed/no-response records, explicitly not signatures or acceptance;
- immutable exception hold/independently cleared event sequence, with database-enforced holds and private campground RLS.

See `docs/BUILD_096_ACCEPTANCE.md`. Next queued: **Build 097 — Finance Delivery Evidence Reconciliation & Operator Closure Review**.

## Build 095 — Applicant Offer Delivery Consent, Versioned Disclosures & Manual Sign-Off Boundary

Delivery scope:
- SHA-256-pinned disclosure versions, independently reviewed before internal use;
- applicant-specific manual-channel consent against Build 094 authorized terms;
- separate independent readiness/hold decision with immutable RLS and staff-only PWA UI.

See `docs/BUILD_095_ACCEPTANCE.md`. Next queued: **Build 096 — Manual Delivery Evidence Receipt, Applicant Acknowledgement & Exception Holds**.


## Build 094 — Financing Terms & Independent Offer Authorization

Delivery scope:
- immutable internal-only finance terms, estimated repayments and source-linked disclosures;
- independent authorization for office preparation, not customer credit/loan issuance;
- private tenant-isolated SQL, contextual help and Web/PWA console.

See `docs/BUILD_094_ACCEPTANCE.md`. Next queued: **Build 095 — Applicant Offer Delivery Consent, Versioned Disclosures & Manual Sign-Off Boundary**.


## Build 093 — Office Financing Application Intake

Delivery scope:
- applicant-consented financing interest tied to a current Build 092 sale case;
- four confidential document-reference categories, independently triaged for intake completeness;
- strict private append-only RLS, operator help and no credit, lending, payment or transfer side effects.

See `docs/BUILD_093_ACCEPTANCE.md`. Next queued: **Build 094 — Financing Terms & Independent Offer Authorization**.


- Work primarily on `dev`.
- Promote to `main` only after applicable gates are GREEN.
- Every feature must declare Web/PWA, IVR/DTMF and SMS support or a documented safe/visual fallback.
- Prefer free/open-source software and free development tiers while preserving scale/migration paths.
- Treat iCamp as a live application whose requirements can evolve through versioned, modular changes.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
- After every completed build, provide the detailed summary defined in `docs/BUILD_OPERATING_MODEL.md`.
