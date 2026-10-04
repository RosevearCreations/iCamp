# iCamp Architecture Source of Truth

## 1. Purpose
iCamp is a web-first, mobile-capable campground operating platform. One authoritative data model powers guest booking, live availability, interactive campground mapping, front desk, maintenance, staff, store/POS, rentals, vendors, accounting, reporting, and management.

## 2. Architectural principles
1. One authoritative campground database. A site, reservation, guest, work order, order, payment, rental, employee, vendor, and asset each have a canonical record.
2. Server-authoritative business rules. Availability, holds, prices, permissions, payments, refunds, inventory, and financial totals are never trusted to browser-only logic.
3. Security by default. Least privilege, deny-by-default authorization, row-level controls, audit history, secure secrets handling, rate limits, validation, and immutable financial/event records where appropriate.
4. Web-first PWA. The first client is responsive and installable on phones, tablets, laptops, and desktops; native apps can be added later without replacing the backend.
5. Role-specific experiences. Campers, front desk, maintenance, retail, foremen, managers, accounting, and owners see tailored workflows.
6. Offline-tolerant field work. Maintenance and inspections are designed to support queued/offline work later.
7. Provider abstraction. Payment, email, SMS, maps, accounting, and storage integrations use adapters so iCamp is not unnecessarily locked to one vendor.
8. Auditability. Every privileged change should be attributable to a user, time, reason, and before/after state where practical.
9. Multi-campground ready. Initial deployment can serve one campground, while IDs and authorization boundaries support future multiple properties.
10. Accessible and responsive. Keyboard, screen reader, touch, large text, contrast, and mobile workflows are first-class requirements.

## 3. Proposed development stack
### Application
- TypeScript
- React/Next.js-style full-stack web architecture
- Progressive Web App support
- Responsive component system
- Automated unit, integration, API, permission, and browser tests

### Data and identity
- PostgreSQL as the authoritative database
- Supabase is the preferred initial managed development platform for PostgreSQL, Auth, Storage, Realtime, and server-side functions where appropriate.
- Row Level Security for tenant/property/user data boundaries.
- Application-layer permission checks in addition to database policies for privileged actions.

### Deployment
- GitHub repository: RosevearCreations/iCamp
- main = production
- dev = integration/staging
- feature/build branches may be used for risky work
- Initial hosting should use a free/low-cost developer tier where practical.
- Hosting provider remains replaceable.

### Campground map engine
The overhead campground image is treated as a managed plan rather than being dependent on paid geographic map tiles.
- Upload an overhead/drone/site-plan image.
- Store polygons using normalized image coordinates so overlays remain accurate at different screen sizes.
- SVG/canvas rendering for editable polygons, labels, hit-testing, colour overlays, opacity, selection, and status.
- Polygon editor supports irregular shapes, add/move/delete vertices, close shape, duplicate, lock, hide, reorder, and undo/redo.
- Optional geospatial coordinates can later connect the plan to MapLibre or other GIS data.

### Payments
- Payment provider adapter.
- Stripe test mode is the preferred first integration because it provides a complete sandbox/test workflow.
- Card data must never be stored by iCamp.
- Webhooks are verified server-side and made idempotent.

### Notifications
Provider adapters for:
- Email
- SMS
- Push/in-app notifications
No guest or staff contact channel is hard-coded to one vendor.

## 4. Core domain model
### Organization and property
- organizations
- campgrounds
- campground_sections
- campground_subsections
- campground_settings

### Map and physical assets
- map_images
- map_layers
- map_objects
- map_polygons
- polygon_vertices or JSON geometry
- site_assets
- utility_assets
- amenity_assets

### Campsites and availability
- sites
- site_types
- site_features
- site_amenities
- site_restrictions
- site_status
- site_status_history
- closures
- management_holds

### Booking
- availability_rules
- rate_plans
- rate_rules
- reservation_holds
- reservations
- reservation_guests
- reservation_vehicles
- reservation_pets
- reservation_addons
- reservation_events
- checkins
- checkouts

### Guests
- guest_profiles
- guest_preferences
- guest_documents
- guest_reviews
- guest_messages

### Maintenance
- maintenance_categories
- maintenance_priorities
- work_orders
- work_order_assignments
- work_order_events
- inspections
- inspection_templates
- inspection_results
- maintenance_media
- preventive_maintenance

### Staff and authorization
- staff_profiles
- roles
- permissions
- role_permissions
- staff_role_assignments
- campground_staff_assignments
- shifts
- time_entries
- audit_events

### Store/POS
- products
- product_categories
- suppliers
- inventory_locations
- inventory_balances
- inventory_movements
- pos_orders
- order_lines
- deliveries
- pickups
- cash_sessions

### Rentals and events
- rental_assets
- rental_inventory
- rental_bookings
- rental_inspections
- event_spaces
- event_bookings

### Finance
- payments
- refunds
- deposits
- charges
- taxes
- expenses
- vendors
- contracts
- recurring_services
- invoices
- ledger_entries
- financial_categories

### Communications
- notifications
- notification_templates
- camper_assistance_requests
- incident_events
- announcements

## 5. Availability and hold architecture
Availability must be calculated on the server from:
- confirmed reservations
- active temporary holds
- management closures
- maintenance closures
- seasonal/yearly assignments
- minimum/maximum stay rules
- site compatibility
- date and section rules

Temporary holds are database records with an expiration timestamp.
Creating a hold must be atomic. Two users must not be able to obtain valid overlapping holds for the same inventory.
Expired holds become invalid automatically and are ignored/reaped safely.
Checkout revalidates the hold before creating the reservation.

## 6. Map status model
Default visual states:
- available: translucent green
- occupied: muted/greyed
- maintenance: translucent yellow
- closed: translucent red

Additional states can include reserved, arriving today, departing today, inspection required, seasonal, walk-in, management hold, emergency closure, and weather closure.

The map presentation is derived from authoritative operational state rather than manually painted colours.

## 7. Security architecture
### Authentication
- Secure hosted authentication with verified email where required.
- MFA available for management and privileged roles.
- Password reset and account recovery flows.
- Session expiration and revocation.
- No credentials stored in repository.

### Authorization
- Deny by default.
- Least privilege.
- Permission-based authorization rather than title-only authorization.
- Server-side checks on every protected mutation.
- RLS/data policies at the database boundary.
- Property/campground boundary on every protected record.
- No client-supplied role or price is trusted.

### Sensitive actions
Require additional protections for:
- role and permission changes
- refunds
- large discounts
- manual payment changes
- financial exports
- deletion/anonymization
- campground-wide closures
- emergency notifications
- map publication
- vendor contract changes

### Application security
- CSRF protections where applicable
- secure cookies
- strict CORS
- Content Security Policy
- output encoding/XSS prevention
- parameterized SQL/query builder
- file type/size validation
- malware-aware upload strategy
- signed/private media URLs for sensitive material
- rate limiting and abuse protection
- webhook signature verification
- idempotency for payment/order/reservation operations
- secrets only in deployment secret stores
- dependency scanning
- code scanning
- audit logging

### Privacy
Collect the minimum guest/staff information needed for campground operations.
Define retention rules for identity records, payment references, incident media, employee records, and logs.
Sensitive health/emergency information should not be collected unless operationally necessary.

## 8. Financial integrity
- Money values stored in integer minor units where practical.
- Taxes and fees computed on server.
- Immutable or append-only financial event records preferred over destructive edits.
- Refunds reference original payment.
- Reconciliation reports identify mismatches between reservations, POS, payments, deposits, refunds, and ledger entries.
- Payment webhooks are deduplicated/idempotent.
- PCI-sensitive card data remains with payment processor.

## 9. Store/POS integrity
- Inventory changes are movements, not silent quantity overwrites.
- Sales, returns, waste, receipts, transfers, adjustments, and deliveries create traceable inventory movements.
- Delivery can be toggled globally and by schedule.
- Campsite delivery orders must link to an active stay or explicitly approved destination.
- POS permissions distinguish cashier, manager, refund, discount, and cash-session functions.

## 10. Maintenance architecture
Work orders have:
- location/site
- category
- severity/priority
- reporter
- assignee/team
- status
- timestamps
- notes
- media
- materials
- labour/time
- completion evidence
- inspection/approval

Checkout can automatically create an inspection/cleanup order. A site can remain unavailable until required inspection gates pass.

## 11. Camper assistance
The guest portal can create assistance requests linked to the active reservation/site.
Severity is guided, but management can reclassify it.
Emergency UI must clearly direct life-threatening emergencies to appropriate emergency services rather than implying iCamp replaces emergency response.

## 12. Offline and synchronization
Later field/offline support uses:
- locally cached assigned tasks
- queued changes with client-generated operation IDs
- server reconciliation
- conflict detection
- media upload retry
- explicit sync state

Financial and booking writes remain server-authoritative and should not be finalized offline.

## 13. Observability
Every environment should expose:
- health checks
- structured logs
- error tracking
- audit events
- performance metrics
- job/queue status
- deployment version/SHA
- database migration version

## 14. Environments
### Local/test
Developer test data only.

### dev
Integration environment using test payment credentials and synthetic/demo data.

### main/production
Real campground data and production credentials.

Production data must never be copied casually into lower environments.

## 15. Promotion policy
A build is not considered complete until:
1. Requirements are implemented.
2. Schema migrations are versioned.
3. Security checks pass.
4. Automated tests pass.
5. Accessibility/responsive checks pass where relevant.
6. dev deployment is healthy.
7. Smoke tests pass.
8. Documentation is updated.
9. Production promotion is performed only when the build is authorized for production.
10. Production health is verified GREEN.

## 16. Manual-input policy
The user should only be interrupted for actions that cannot be performed safely or technically through connected tools, such as:
- accepting provider terms
- entering payment/billing information
- retrieving or creating secret API keys
- domain/DNS ownership steps
- MFA confirmation
- uploading a real campground overhead image
- entering real business/tax/legal information

When manual action is necessary, instructions must be explicit, numbered, and tell the user exactly what to copy back without exposing secrets in chat.


## 17. Extended operations model

### Maintainable operational assets
Amenities and operational assets are separate concepts. A pool, washroom, water park, sports field, dock, boat ramp, playground or recreation building may be publicly advertised as an amenity while simultaneously having an internal asset record with:
- polygon/location;
- asset type;
- operating state;
- inspection templates;
- recurring maintenance schedules;
- safety/rule set;
- responsible department;
- sign-off requirements;
- condition/incident history;
- automatic closure/work-order rules.

Recurring schedules must support hourly, daily, weekly, monthly, seasonal and custom recurrence. Completion history is retained rather than overwriting the last completed task.

### Seasonal/yearly lifecycle
Long-term site assignments use a lifecycle model separate from short-stay reservations:
- active season;
- winterization due;
- winterization submitted;
- inspection required;
- corrective work required;
- winter closed;
- approved winter occupancy;
- opening inspection due;
- reopened.

The site can require evidence and maintenance/foreman sign-off before transitioning to winter closed or cold-weather approved.

### Winter-readiness compliance
Rules are configurable by campground because climate, laws and utilities differ. The system stores campground-defined requirements such as insulated/heated water protection, shutoff/draining, utility checks, photos and staff approval. Compliance records are versioned and auditable.

### Permanent units and cottage-style ownership
Land/site and permanent unit are separate entities. Proposed additional domain entities:
- permanent_units
- permanent_unit_ownership
- permanent_unit_listings
- permanent_unit_transfer_applications
- permanent_unit_inspections
- financing_applications
- financing_provider_references

A unit can change ownership while the underlying site remains unchanged. Financing is isolated behind a high-risk provider/workflow boundary and must never be assumed to be an ordinary iCamp credit feature.

### Events and access
Add:
- events
- event_series
- event_occurrences
- event_venues
- event_access_rules
- event_registrations
- event_tickets_passes
- event_checkins

Recurring event series generate occurrences while allowing individual dates to be cancelled or altered.

### Visitors and access credentials
Add:
- visitor_registrations
- visitor_hosts
- visitor_vehicles
- access_credentials
- access_credential_events

Visitor limits resolve from the most specific applicable rule: individual site -> site type -> section -> campground. Access credentials can represent wristbands, printed passes, QR codes or future electronic keys.

### Recreational/personal mobility registration
Add:
- registered_devices_vehicles
- device_vehicle_inspections
- device_vehicle_authorizations
- authorized_drivers

This is distinct from ordinary road vehicles on a reservation because campground-operating permissions and safety checks can differ.

### Waterfront operations
Add:
- water_features
- swimming_zones
- boat_registrations
- boat_launches
- boat_launch_sessions
- docks
- dock_slips
- dock_assignments

Access policy can require an active campsite or can explicitly allow paid day-use guests.

### Rule sets and enforcement
Rules must be versioned records, not hard-coded text. Add:
- rule_sets
- rule_versions
- rule_acknowledgements
- safety_warnings
- access_suspensions
- incident_enforcements

A guest acknowledgement points to the exact rule version agreed to. Staff enforcement actions require permission and audit history.

### Safety boundary
iCamp records campground policies, inspection evidence, staff decisions and acknowledgements. It must not present campground-configured checklists as a substitute for applicable law, certified inspections, lifeguard training, marine rules or other statutory safety obligations.
