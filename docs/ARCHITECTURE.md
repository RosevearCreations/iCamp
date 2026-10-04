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

## 19. Observability

Every environment should expose:
- application/version SHA;
- health status;
- migration version;
- structured logs;
- error tracking;
- integration health;
- queue/scheduler health;
- access-device health where connected.

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
