# iCamp Architecture Source of Truth — iCamp2027

## 1. Architectural purpose

iCamp is a web-first, mobile-capable campground operating platform. One authoritative backend powers public booking, campground mapping, cottage rentals, front desk, access/security, maintenance, guest services, store/POS, events, local discovery, waterfront operations, rentals, workforce, vendors, finance, reporting and management.

The current repository/application work before the roadmap reset is considered the **Pre-Implementation Engineering Baseline**. The active product roadmap restarts at Build 001.

## 2. Core architectural principles

1. **One canonical data model.** Do not duplicate the campground between booking, maintenance, security, POS or management.
2. **Server-authoritative high-risk decisions.** Availability, holds, price, payment status, permissions, access credentials, gate commands, inventory and finance are never trusted to browser-only logic.
3. **Deny by default.** Every protected action requires explicit authorization.
4. **Defense in depth.** Application authorization and database row/data policies both protect sensitive records.
5. **Audit privileged actions.** Money, access control, permissions, closures, map publication and safety enforcement require traceability.
6. **Web-first PWA.** One responsive codebase serves phones, tablets and computers before native clients are considered.
7. **Provider adapters.** Payment, email, SMS, storage, maps, accounting and gate/security hardware remain replaceable.
8. **Image-space campground mapping.** The overhead plan is not dependent on geographic tile providers.
9. **Event/history orientation.** Financial, access, audit, maintenance and inventory history should be appended as events/movements instead of silently overwritten.
10. **Multi-campground ready.** Organization/property boundaries are present from the beginning.
11. **Accessibility and degraded connectivity are design requirements.**
12. **Safety boundary.** iCamp records policies, evidence and staff actions; it does not replace certified safety systems, emergency services, trained lifeguards or legally required physical controls.

## 3. Proposed technology foundation

### Client/application
- TypeScript.
- React/Next.js full-stack web application.
- Progressive Web App support.
- Responsive layouts.
- Server Components/server routes where appropriate.
- Role-specific workspaces.
- Automated unit, integration, permission and browser tests.

### Data/identity
- PostgreSQL as authoritative database.
- Supabase preferred initially for managed PostgreSQL/Auth/Storage/Realtime where practical.
- Row Level Security/data boundary policies.
- Application-layer permission middleware for protected actions.
- Versioned database migrations.

### Deployment
- GitHub: `RosevearCreations/iCamp`.
- `main` = production/release.
- `dev` = integration/staging.
- Build/feature branches when useful.
- Hosting provider remains replaceable.

### Storage
Media/document storage distinguishes:
- public;
- internal;
- confidential;
- highly restricted.

Private media is served with signed/authorized access rather than public permanent URLs.

## 4. Campground map and coordinate architecture

### 4.1 Base image
A campground map version contains:
- original image dimensions;
- processed/display variants;
- orientation;
- version;
- publication state;
- map calibration metadata where applicable.

### 4.2 Polygon coordinate system
All clickable geometry is stored relative to the **original image coordinate space**, preferably normalized:

- `xNormalized = originalX / originalWidth`
- `yNormalized = originalY / originalHeight`

Each point therefore remains in the range 0..1.

The browser never stores polygon geometry in current screen pixels.

### 4.3 Rendering and zoom
At render time:

- `screenX = viewportOriginX + xNormalized * renderedImageWidth * zoomScale`
- `screenY = viewportOriginY + yNormalized * renderedImageHeight * zoomScale`

The rendering system applies the same transform matrix to:
- the image;
- polygon shapes;
- labels/icons;
- hit-testing;
- edit handles.

This prevents clickable areas drifting away from sites while zooming, panning or changing devices.

### 4.4 Precision
The plotter should use SVG or a canvas/vector layer with:
- pointer coordinate inversion through the active transform matrix;
- high-DPI awareness;
- zoom-independent selection tolerance;
- editable vertices;
- undo/redo;
- polygon validation;
- optional snapping/precision aids;
- test fixtures proving geometry alignment at multiple zoom factors and aspect ratios.

### 4.5 Map objects
A map object is a visual representation of a canonical domain entity, such as:
- campsite;
- rental cottage;
- permanent unit;
- pool;
- washroom;
- water park;
- sports field;
- dock;
- boat ramp;
- building;
- amenity;
- access gate;
- garbage area;
- utility;
- road;
- parking;
- restricted zone.

Map objects can belong to layers with separate public/staff visibility.

## 5. Core domain model

### Organization/property
- organizations
- campgrounds
- campground_sections
- campground_subsections
- campground_settings
- feature_flags

### Map
- map_images
- map_image_versions
- map_layers
- map_objects
- map_geometries
- map_labels
- map_publication_events

### Accommodation inventory
- accommodations
- campsites
- rental_cottages
- permanent_units
- accommodation_types
- site_types
- accommodation_features
- utilities
- amenity_links
- restrictions
- accommodation_status
- accommodation_status_history

A generic `accommodations` parent lets campsites and rental cottages participate in the same booking engine while retaining type-specific detail.

### Accommodation media
- accommodation_media
- media_variants
- media_captions

Customer-facing gallery rules:
- maximum 10 active public gallery images per accommodation;
- ordered hero/gallery positions;
- internal maintenance media does not count toward the public 10-image limit.

### Availability/booking
- availability_rules
- rate_plans
- rate_rules
- reservation_holds
- reservations
- reservation_guests
- reservation_pets
- reservation_addons
- reservation_events
- checkins
- checkouts
- closures
- management_holds

### Cottage-specific stay operations
- cottage_housekeeping_templates
- cottage_turnovers
- cottage_damage_inspections
- cottage_inventory_checklists

### Guests
- guest_profiles
- guest_preferences
- guest_documents
- guest_reviews
- guest_messages
- marketing_preferences

### Road vehicles
- road_vehicles
- vehicle_registrations
- vehicle_passes
- parking_authorizations

### Visitors/access
- visitor_registrations
- visitor_hosts
- visitor_vehicles
- access_credentials
- access_credential_events
- access_zones
- access_rules

### Physical security
- access_devices
- gates
- doors_barriers
- access_device_health
- gate_state_events
- access_attempts
- manual_access_commands
- security_incidents

### Recreational/mobility devices
- registered_devices
- device_types
- device_inspections
- device_authorizations
- authorized_drivers

### Operational assets
- operational_assets
- asset_types
- asset_status
- asset_status_history
- asset_rules

### Maintenance
- maintenance_categories
- maintenance_priorities
- work_orders
- work_order_assignments
- work_order_events
- maintenance_media
- maintenance_material_usage
- maintenance_labour
- preventive_maintenance_templates
- recurring_maintenance_schedules
- generated_maintenance_occurrences

### Inspections
- inspection_templates
- inspection_template_versions
- inspection_occurrences
- inspection_results
- inspection_signoffs
- corrective_actions

### Garbage/waste
- waste_service_models
- waste_streams
- garbage_sticker_products
- garbage_sticker_instances
- garbage_pickup_requests
- garbage_pickup_routes
- garbage_pickup_events

### Seasonal/yearly
- seasonal_assignments
- winterization_templates
- winterization_records
- winter_readiness_records
- reopening_records

### Permanent-unit ownership/transfer
- permanent_unit_ownership
- permanent_unit_listings
- transfer_inquiries
- transfer_applications
- transfer_inspections
- transfer_documents
- transfer_events

### Financing
- financing_applications
- financing_documents
- financing_status_events
- financing_provider_references

Financing data is isolated as confidential/high-risk.

### Events
- event_series
- event_occurrences
- event_venues
- event_access_rules
- event_registrations
- event_tickets_passes
- event_checkins

### Local interests/discovery
- local_places
- local_events
- local_interest_categories
- source_references
- content_freshness_reviews
- promotion_slots
- promotion_campaigns
- promotion_impressions
- promotion_clicks

### Waterfront
- water_features
- swimming_zones
- boat_registrations
- boat_launches
- boat_launch_sessions
- docks
- dock_slips
- dock_assignments

### Rentals
- rental_assets
- rental_inventory
- rental_bookings
- rental_inspections
- rental_damage_events

### Rules/safety
- rule_sets
- rule_versions
- rule_acknowledgements
- safety_warnings
- access_suspensions
- incident_events
- enforcement_events

### Store/POS
- products
- product_categories
- suppliers
- inventory_locations
- inventory_movements
- inventory_balances
- pos_orders
- order_lines
- deliveries
- pickups
- cash_sessions
- discounts
- returns

### Staff/workforce
- staff_profiles
- departments
- roles
- permissions
- role_permissions
- staff_role_assignments
- campground_staff_assignments
- shifts
- time_entries
- qualifications
- training_records

### Vendors/services
- vendors
- contracts
- recurring_services
- vendor_service_occurrences
- vendor_documents
- supplier_invoices

### Finance
- payments
- refunds
- deposits
- charges
- taxes
- expenses
- invoices
- ledger_entries
- financial_categories
- reconciliation_items

### Communications
- notifications
- notification_templates
- announcements
- camper_assistance_requests
- message_delivery_events

### Audit/observability
- audit_events
- system_events
- integration_events

### Background execution
- job_schedules
- job_queue
- queue_workers
- scheduler_heartbeats

## 6. Availability and hold engine

Availability is calculated server-side from:
- confirmed reservations;
- active unexpired holds;
- closures;
- maintenance/inspection blocks;
- management holds;
- seasonal/yearly assignments;
- cottage turnover blocks;
- accommodation compatibility;
- capacity;
- date/rate rules.

Temporary holds have:
- accommodation;
- date/time range;
- owner/session/customer;
- created time;
- expiry;
- state;
- idempotency key.

Overlapping hold acquisition must be atomic. Checkout revalidates before reservation creation.

## 7. Accommodation type compatibility

Compatibility resolves configurable rules for:
- tent/RV/cottage;
- equipment length;
- hookup requirements;
- occupancy;
- pets;
- vehicles;
- accessibility;
- required amenities;
- seasonal/yearly restrictions.

A rental cottage never inherits RV-specific requirements unless explicitly configured.

## 8. Security/access-control architecture

### 8.1 Credential model
Access credentials may represent:
- key card;
- RFID/fob;
- keypad PIN;
- QR pass;
- printed/wristband token;
- provider-specific credential identifier.

The system stores references/tokens appropriate to the provider; it should avoid storing reusable sensitive credential secrets in plaintext.

### 8.2 Gate integration
Gate/access providers implement an adapter interface:
- read state if supported;
- issue open command;
- issue close command if hardware safely supports it;
- provision/revoke credentials;
- receive access event webhook/poll data;
- report device health.

The public/browser client never communicates directly with access hardware.

### 8.3 Manual override
Manual open/close:
- requires explicit permission;
- requires a reason for sensitive overrides;
- creates an audit event;
- records target device, actor, command, request time, provider response and outcome;
- is rate limited;
- may require recent re-authentication for high-risk installations.

### 8.4 Fail-safe boundary
iCamp must not defeat:
- fire/life-safety egress;
- physical emergency releases;
- legally required manual controls;
- hardware safety interlocks.

If iCamp is offline, required physical security/emergency controls remain independently operable.

## 9. Road vehicle access architecture

Every road vehicle present on property can be associated with:
- active accommodation;
- seasonal/yearly site;
- registered visitor;
- staff/contractor;
- day/week pass.

The access engine can evaluate:
- validity;
- date/time;
- campground/zone;
- vehicle limits;
- unpaid/revoked pass;
- management override.

Vehicle records should minimize personal information while retaining what is operationally required.

## 10. Maintenance scheduling engine

Recurring schedules support:
- hourly;
- every N hours;
- daily;
- weekdays;
- weekly;
- monthly;
- season/start-end window;
- custom recurrence.

The schedule creates discrete **maintenance/inspection occurrences**. Completion never overwrites prior history.

Examples:
- hourly supervised-area inspection;
- washroom cleaning every 4 hours;
- daily garbage station check;
- weekly ball field inspection;
- seasonal pool opening/closing;
- yearly winterization.

Missed/failed occurrences can:
- escalate;
- notify;
- create corrective work;
- close/restrict the asset.

## 11. Garbage/waste architecture

Campground configuration chooses one or several waste models:
- central bin;
- included site collection;
- scheduled collection;
- on-demand paid pickup;
- paid sticker/tag/bag.

Sticker/tag handling:
- can be a POS product;
- can have unique serial/QR/barcode;
- can be linked to purchaser/site;
- can be marked issued/redeemed/void;
- can create pickup work;
- contributes to inventory and revenue records.

## 12. Cottage booking architecture

Rental cottages are first-class accommodations using:
- same atomic hold engine;
- same reservation/payment engine;
- cottage-specific rate/occupancy/features;
- housekeeping/turnover state;
- damage/security deposit;
- cottage inventory/condition check.

The booking map can visually distinguish cottages but does not require a separate reservation database.

## 13. Local-interest promotion architecture

Local places/events are curated records, not blindly injected external search results.

Each external/time-sensitive record stores:
- source URL/reference;
- retrieved/entered date;
- event start/end if applicable;
- freshness/review deadline;
- publication status.

Promotion logic can consider:
- booking dates;
- family/pet/accessibility tags;
- season;
- campground section;
- customer marketing preferences;
- configured campaign placement.

Placements include:
- booking confirmation;
- pre-arrival;
- My Stay;
- event/activities page;
- announcements.

Expired local events are automatically excluded until reviewed.

## 14. Financial integrity

- Money stored in integer minor units where practical.
- Tax/fees computed server-side.
- Payments/refunds reference immutable provider IDs.
- Webhooks verified and idempotent.
- Financial corrections create adjustment entries rather than deleting history.
- Financing records are segregated from ordinary reservation payments.

## 15. Store/inventory integrity

Inventory quantity is derived from traceable movements:
- receipt;
- sale;
- return;
- waste;
- adjustment;
- transfer;
- redemption where relevant.

Garbage stickers/tags can use either quantity inventory or individually serialized inventory.

## 16. Rule/version model

Safety, access and campground rules are versioned.

Acknowledgement records point to the exact rule version viewed/accepted.

Updating rules never changes historical acknowledgement evidence.

## 17. Offline policy

Safe offline functions may later include:
- assigned work orders;
- inspections;
- notes/photos;
- site information.

The following do **not** finalize offline:
- reservation holds;
- reservations;
- payments/refunds;
- role changes;
- gate open/close commands;
- credential provisioning;
- financing decisions.

## 18. Security baseline

- MFA readiness for privileged staff.
- secure sessions/cookies;
- server authorization;
- RLS/data policies;
- strict validation;
- CSRF protections where applicable;
- CSP;
- CORS restrictions;
- XSS prevention/output encoding;
- parameterized data access;
- rate limiting;
- abuse detection;
- upload limits/type validation;
- signed private media;
- webhook verification;
- idempotency;
- dependency/secret scanning;
- environment isolation;
- audit logging.

## 19. I.T., Analysis and Observability Architecture

I.T./Analysis is a first-class operational subsystem spanning every iCamp domain.

### 19.1 Health model
Every environment exposes distinct health contracts:
- **liveness** — the application process can respond;
- **readiness** — required runtime configuration/dependencies are usable;
- **version** — release/application/build identity;
- **aggregate public status** — sanitized operational state only.

A health check must never return secrets, connection strings, raw exceptions, stack traces, personal information or detailed security topology.

### 19.2 External watchdog boundary
A fully locked process cannot self-report reliably. Production lockup detection therefore requires an independent monitor outside the iCamp process to call the liveness/readiness endpoints.

The watchdog is an adapter:
- free/self-hosted monitoring can be used during development/pilot;
- larger managed observability services can be adopted later;
- the health contract remains unchanged.

### 19.3 Correlation and support references
Every relevant web request should receive an iCamp-generated correlation/request ID. Error screens and server events use safe support references so an operator can correlate a client report with diagnostics without exposing stack traces to the client.

### 19.4 Structured diagnostic events
The eventual diagnostic event model includes:
- timestamp;
- environment;
- release/build SHA;
- service/component;
- severity;
- category;
- correlation ID;
- campground/property scope where applicable;
- sanitized error fingerprint;
- duration/status metrics;
- dependency/integration reference;
- remediation/incident linkage.

Do not make raw request bodies the default telemetry model.

### 19.5 Error and lockup analysis
The I.T. subsystem should support detection/analysis of:
- unhandled exceptions;
- repeated error fingerprints;
- high latency/timeouts;
- event-loop/runtime stalls where measurable;
- queue/scheduler backlog or heartbeat loss;
- failed provider callbacks;
- database/storage/integration outages;
- resource saturation;
- deployment/configuration mismatch;
- repeated client failures.

### 19.6 Data separation
Public/client status and private diagnostics are separate surfaces.

Until authentication/authorization is available, the I.T. workspace may display only the same safe data allowed on the public status surface. Detailed logs and sensitive diagnostics must wait for Builds 004–006 and later persistence/audit work.

### 19.7 Retention and privacy
Telemetry retention is configurable by data class. Secrets, payment-card data, authentication codes, keypad PINs, sensitive financing data and unnecessary personal content must be redacted or excluded before persistence.

### 19.8 Evolution path
Build 002 establishes contracts and in-process health. Later builds extend:
- Build 007 — queue/scheduler heartbeat and stalled-job visibility;
- Build 148 — performance, query, realtime and observability scale analysis;
- Build 149 — diagnostics abuse/security hardening;
- Build 150 — recovery/incident runbooks;
- Build 153 — production I.T. operations readiness and external watchdog verification.

### 19.9 Background job and scheduler health
Build 007 provides one provider-portable PostgreSQL execution layer for later domains.

The execution contract is:
- durable queued jobs and interval schedules;
- per-queue idempotency keys;
- at-least-once worker delivery;
- finite worker leases and heartbeats;
- bounded exponential retry;
- dead-letter state after exhausted attempts;
- scheduler heartbeat/tick evidence;
- aggregate I.T. signals for overdue work, stalled workers and expired leases.

Queue payloads remain private. Web/PWA, IVR/DTMF and SMS enqueue canonical domain work through the same server-side layer rather than creating channel-specific schedulers.

### 19.10 Global client web status
A safe web status surface may be globally accessible and should communicate service condition without exposing internal diagnostics.

## 20. Environments

### Local/test
Synthetic data only.

### dev
Integration/staging, test payments and demo campground data.

### main/production
Real campground data and production credentials.

Production personal/financial/security data must not be casually copied into dev.

## 21. Promotion gate

A build is GREEN only after applicable:
- requirements;
- schema/migrations;
- authorization/RLS;
- audit behavior;
- tests;
- accessibility/responsive checks;
- security checks;
- integration checks;
- dev health;
- documentation;
- rollback review;
- production verification.

## 22. Manual-input policy

Manual steps are reserved for actions that cannot safely be automated through connected tools, such as:
- provider terms/billing;
- production secret creation;
- MFA;
- domain/DNS;
- real campground image/media;
- legal/tax/business data;
- physical access-controller enrollment;
- telephone/SMS number purchase, registration or regulatory verification required by the chosen provider;
- real financing/provider agreements.

When manual input becomes necessary, provide exact numbered instructions. Secrets are entered directly into the provider secret store and are not pasted into chat.


## 23. Omnichannel Voice, DTMF and SMS Architecture

### 23.1 Channel principle
Web/PWA, IVR/DTMF, speech and SMS are channels over the same application/domain services. Channel handlers do not implement separate booking, pricing, maintenance, access or finance rules.

### 23.2 Telephony provider adapter
Use a replaceable telephony adapter capable of:
- inbound/outbound voice calls;
- DTMF digit gathering;
- optional speech input;
- inbound/outbound SMS and, where available, MMS;
- delivery/call status callbacks;
- number/provider health information;
- verified signed webhooks.

A provider such as Twilio can support DTMF/speech collection, but the domain layer must not depend on Twilio-specific objects.

### 23.3 Proposed communications domain
Add:
- communication_endpoints
- communication_consents
- communication_preferences
- voice_calls
- voice_call_events
- ivr_sessions
- ivr_steps
- ivr_inputs
- sms_conversations
- sms_messages
- sms_commands
- message_opt_events
- call_transfer_events
- communication_provider_events

### 23.4 IVR session state
IVR menus are state machines linked to a short-lived server session. A session can carry only the minimum context needed, such as:
- campground;
- language;
- authenticated guest/staff identity;
- reservation/site reference;
- pending operation;
- retry count;
- expiry.

Digits are interpreted server-side and validated before domain commands are executed.

### 23.5 SMS command/conversation model
Inbound SMS can be handled as:
- exact keywords;
- guided numbered menus;
- structured commands;
- natural-language classification.

Natural-language interpretation never directly mutates data. It produces a proposed structured intent, then normal domain validation/authorization executes the action.

### 23.6 Channel parity contract
Each product build must declare a **channel support matrix**:
- Web/PWA: full, partial, not applicable.
- IVR/DTMF: full, guided equivalent, staff transfer, not applicable.
- SMS: full, guided equivalent, secure-link handoff, not applicable.

A channel may be marked not applicable only when the task is inherently graphical or unsafe for that channel, such as polygon drawing.

### 23.7 Identity and authentication
Caller ID/phone number is only a routing hint, not proof of identity.

Guest verification may combine:
- reservation number;
- date/site detail;
- short-lived one-time code;
- account PIN where appropriately protected.

Staff/high-risk verification requires stronger authentication, such as staff PIN plus a separate one-time factor or approved authenticated session.

### 23.8 Telephone payments
Do not collect raw payment-card numbers in custom IVR logic or SMS.

Telephone flows use:
- provider-hosted secure payment link;
- staff-assisted tokenized provider workflow;
- or a separately approved PCI-compliant IVR payment provider.

### 23.9 Telephony webhooks
Voice/SMS callbacks must:
- verify provider signatures;
- reject replay where supported;
- be idempotent;
- rate limit abuse;
- normalize provider data into internal events;
- avoid logging message content/DTMF secrets unnecessarily.

### 23.10 Consent and messaging separation
Store operational-message and marketing-message purposes separately. Promotional SMS requires jurisdiction-appropriate consent, sender identification and unsubscribe handling. STOP/START/HELP-style events from a provider should update the internal preference/consent history.

### 23.11 Reliability
Telephony provider failure must not corrupt reservations or payments. Calls/SMS may retry or transfer to staff, while completed domain actions remain idempotent and auditable.

### 23.12 Visual-task fallback
Graphical functions such as polygon plotting remain web/PWA tasks. Telephone/SMS offers operational equivalents using site/asset IDs and can send secure links to the relevant visual page.


## 24. Live Evolution, Free-First Development and Scale Migration

iCamp is expected to remain a **live, evolving application**. Requirements, campground operating models, providers, regulations and customer expectations will change over time.

Architecture must therefore favor:
- modular bounded domains rather than one tightly coupled application;
- canonical service interfaces that can gain new channels without duplicating logic;
- versioned configuration instead of hard-coded campground policy;
- feature flags for staged rollout/rollback;
- backward-compatible migrations where practical;
- append-oriented history for financially/safety significant records;
- provider adapters at every external dependency boundary;
- contract tests around adapters and domain services;
- observability/version identifiers so changes can be traced and reversed;
- data export paths so the campground is not trapped by a development provider.

### 24.1 Free-first development/testing

During design, development and early testing, prefer software and service tiers that can be used at no recurring cost where practical.

The free-first requirement must **not** create architectural lock-in or force unsafe limitations. Core iCamp behavior should remain portable.

Preferred development approach:
- open-source frameworks/libraries where practical;
- PostgreSQL-compatible schemas rather than proprietary databases;
- provider-neutral object/media abstractions;
- sandbox/mock integrations for payments, SMS/voice and physical access;
- synthetic/demo data;
- GitHub Actions within available plan limits;
- self-hostable/standalone application output.

Paid services should only become necessary when real production scale, phone numbers/messages, payment processing, hardware integration, storage, uptime or regulatory services genuinely require them.

### 24.2 Scale-up migration

Every managed development service selected later must have a documented exit/scale path.

Examples:
- free managed PostgreSQL -> larger managed PostgreSQL or self-hosted PostgreSQL;
- free web hosting -> paid serverless/container hosting or multi-instance deployment;
- development object storage -> scalable S3-compatible/provider storage;
- telephony sandbox/mock -> production telephony provider adapter;
- payment sandbox -> production payment provider credentials;
- single-instance background work -> durable queue/worker infrastructure.

No core business table should depend on one vendor's proprietary identity unless a portable internal identifier also exists.

### 24.3 Change-management rule

A later alteration should normally be implemented as:
1. a versioned configuration or feature flag when it is campground policy;
2. a new adapter implementation when it is an external provider change;
3. a backward-compatible domain/schema extension when it is new business capability;
4. a migration with rollback/recovery documentation when compatibility is impossible.

Large rewrites should be the exception.


## 25. Multi-Property Data, Freshness and Contextual Help Foundation

### 25.1 Canonical tenancy hierarchy
The foundational tenancy hierarchy is:
- organization;
- campground/property;
- campground section;
- campground subsection.

Every future property-scoped domain table should carry enough canonical scope information to enforce tenant isolation efficiently and to avoid ambiguous cross-property joins.

### 25.2 Portable PostgreSQL migrations
The initial database foundation uses plain PostgreSQL-compatible migrations and tests them against real PostgreSQL in CI.

The migration layer must remain deployable to:
- Supabase-hosted PostgreSQL;
- another managed PostgreSQL provider;
- self-hosted PostgreSQL.

Provider-specific SQL should be isolated and documented rather than embedded throughout the schema.

### 25.3 Record identity and lifecycle
Core records use:
- UUID primary keys;
- created_at / updated_at timestamps;
- archived_at where soft archival is appropriate;
- lifecycle_state;
- row_version for optimistic freshness/change tracking.

Row version and update timestamps provide a low-level foundation for detecting stale admin views without exposing sensitive field contents.

### 25.4 RLS posture before authentication
Tables introduced in an exposed schema must have Row Level Security enabled immediately.

Before authentication/authorization policies exist, the secure posture is **deny by default**: no permissive anon/authenticated policies are created in Build 003.

Build 005 introduces explicit policies tied to campground/property authorization.

### 25.5 Admin freshness model
Admin/analysis freshness is represented independently of the business record payload.

A refresh-state record can identify:
- organization/campground scope;
- workspace/section key;
- source identifier;
- state: idle / refreshing / fresh / stale / failed;
- last requested/start/success/failure timestamps;
- safe error code/fingerprint;
- source watermark/version;
- stale-after threshold;
- row version.

This allows management and I.T. to determine whether a panel is current without retaining a duplicate copy of sensitive client data.

### 25.6 Contextual help contract
Every UI section or form should register a help topic ID.

A help topic has:
- stable ID;
- title;
- concise inline summary;
- detailed guidance;
- audience/classification;
- related topics;
- full help-page route.

The reusable ⓘ control displays inline help and links to the full help page.

Help classifications:
- public/guest;
- operational staff;
- privileged admin/I.T.

The application must never expose privileged help content merely because the help route is guessable.

### 25.7 Help freshness
When help content becomes database/content-managed, it should be versioned and tied to the related feature/build so stale instructions can be detected and reviewed after workflow changes.


## 26. Authentication and Secure Session Architecture

### 26.1 Identity vs authorization
Authentication identifies a global user account.

Authorization remains separate and is applied through roles, permissions and campground/property assignments in Build 005.

This separation prevents a global identity record from silently granting access to every campground.

### 26.2 Private auth storage
Authentication records are stored in the non-exposed `icamp_private` schema:
- user accounts;
- password verifiers;
- sessions;
- password-recovery tokens;
- MFA-factor readiness records.

### 26.3 Passwords
Passwords are server-hashed with scrypt and unique random salts.

The browser/server API never stores or returns plaintext passwords after processing.

### 26.4 Sessions
The browser receives a random opaque token.

PostgreSQL stores only a one-way hash of that token.

Session validity is checked server-side against:
- token hash;
- expiry;
- revocation;
- account active state.

### 26.5 Recovery
Recovery tokens follow the same opaque-token/hash-only pattern.

Recovery consumption changes the password, consumes the token and revokes existing sessions in one database transaction.

Delivery is an adapter boundary.

### 26.6 Identity gates
Public content can remain anonymous.

My Stay requires an authenticated identity.

Operational workspaces require a staff identity before Build 005 adds fine-grained authorization.

### 26.7 Managed hosting without lock-in
RosevearCreations Supabase iCamp currently hosts the development PostgreSQL database.

The application does not rely on Supabase-only table semantics for its canonical identity/session model. Vanilla PostgreSQL CI remains the portability test.


## 27. Authorization and Row-Level Security Architecture

### 27.1 Identity is not authority
Build 004 authenticates a global identity. Build 005 authorizes that identity for explicit campground/property scopes.

A staff account alone grants no campground data access.

### 27.2 Assignment hierarchy
Operational authorization resolves through:
1. staff identity;
2. active campground assignment;
3. one or more role templates/custom roles;
4. granular permission keys;
5. server action guard;
6. PostgreSQL RLS policy.

Each layer is independently meaningful; UI visibility never substitutes for server/database enforcement.

### 27.3 Permission catalogue
Permission keys are capability-oriented and stable across interfaces. Job titles are represented by roles that aggregate permissions rather than hard-coded conditionals throughout domain code.

Permissions carry a risk level so Build 006 and later security work can require additional reason/audit/re-authentication for sensitive capabilities.

### 27.4 Template and custom roles
System templates provide sensible campground operating defaults.

Custom roles are organization-scoped. Database triggers prevent a custom role from being assigned across organizations and prevent inactive roles from being assigned.

### 27.5 Trusted application role
`icamp_app` is a PostgreSQL NOLOGIN/NOINHERIT role with limited grants.

Trusted server/database code deliberately assumes it inside a transaction after setting the canonical request-user context.

The role is not granted to browser-facing Supabase `anon` or `authenticated` roles.

### 27.6 Request identity
RLS resolves identity from transaction-local `icamp.user_id`.

Missing, empty or malformed identity resolves to null and therefore no assignment/permission match.

Do not derive RLS identity from client-provided role names, headers or unverified JWT claims.

### 27.7 Forced RLS
Current property-scoped public tables FORCE RLS, and broad `public` privileges are revoked.

As later domain tables are introduced, each build must define the correct tenant/permission policy rather than relying only on application routing.

### 27.8 Workspace versus action authorization
A workspace has a minimum permission required to enter it.

Individual actions within that workspace must still check their own narrower permission. For example, opening Finance does not automatically grant refund issuance.

### 27.9 Omnichannel authorization
Web/PWA, IVR/DTMF, SMS/MMS, staff-assisted calls and future integrations invoke the same canonical server permission engine.

Channel identity is never authority. Caller ID, SMS sender identity or possession of a UI route cannot bypass campground assignment and permission checks.

### 27.10 Hosted PostgreSQL portability
Supabase currently hosts the development PostgreSQL database, but the authorization migration is continuously verified against vanilla PostgreSQL 17.

Provider-specific browser roles remain outside iCamp's private authorization schema and app role.

### 27.11 Build 006 boundary
Build 005 answers whether an action is permitted.

Build 006 adds evidence and extra safeguards for privileged permitted actions: audit events, reasons, before/after state and recent re-authentication hooks.


## 28. Secure Media & Document Storage Foundation

### 28.1 Canonical media identity
Media and documents use durable iCamp asset IDs and provider-neutral metadata. Object storage is an adapter boundary; provider object identifiers never become the business-domain identity.

### 28.2 Classification boundary
Every asset is classified as public, internal or confidential. Public classification permits intentional unauthenticated retrieval. Internal and confidential assets remain private and require canonical iCamp campground authorization before a temporary provider access URL may be issued.

### 28.3 Validation boundary
The server validates approved MIME type, extension, size and binary signature before upload. Object keys are generated from UUID scope/asset identifiers rather than client filenames.

### 28.4 Lifecycle evidence
Media metadata follows explicit pending, active, quarantined, archived and deleted lifecycle states. Lifecycle events are append-only. Deleted is terminal and only validated assets may become active.

### 28.5 Provider portability
The current development adapter uses Supabase Storage. The canonical schema and authorization rules remain portable to S3-compatible, self-hosted or other object storage. Provider-specific bucket configuration is isolated under `providers/`.

### 28.6 Non-visual channels
IVR/DTMF and SMS do not receive durable private object URLs. They address canonical asset IDs and use staff-assisted or secure authenticated handoff where visual access is required. Later MMS intake reuses the same validation and lifecycle boundary.
