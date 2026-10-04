# iCamp Build Roadmap

This roadmap converts the complete iCamp vision into staged, testable builds. Each build should end with code, tests, documentation, and a security review appropriate to its scope.

## Phase 0 — Foundation and source of truth

### Build 001 — Repository Foundation & Engineering Guardrails
- Establish dev/main workflow.
- Create application skeleton, formatting, linting, tests, environment validation, CI.
- Add README, architecture, roadmap, security, contribution/deployment documentation.
- Add branch/build conventions and release checklist.
- Add secret scanning and dependency/security scanning.
- No manual input unless a hosting connection requires account authorization.

### Build 002 — Responsive PWA Application Shell
- Phone/tablet/desktop layouts.
- Public, guest, staff, maintenance, POS, management application shells.
- Installable PWA manifest/service worker baseline.
- Accessibility baseline.
- Navigation adapts by role.

### Build 003 — Environment, Configuration & Health Framework
- dev/production configuration schema.
- typed environment validation.
- /health and build/version endpoints.
- runtime feature flags.
- safe error handling.
- environment-specific banners to prevent accidental production actions.

### Build 004 — Database Foundation & Migration System
- PostgreSQL schema framework.
- organizations/campgrounds/sections/subsections/settings.
- UUID IDs, created/updated metadata, soft-delete policy where appropriate.
- migration CI.
- seed/demo campground.

### Build 005 — Authentication & Session Security
- guest and staff authentication.
- password reset.
- verified identity flows.
- secure sessions.
- management MFA readiness.
- sign-in event logging and session revocation.

### Build 006 — Roles, Permissions & Row-Level Security
- permission catalogue.
- role templates.
- custom roles.
- campground assignments.
- deny-by-default policy.
- RLS/data policy tests.
- privileged-action middleware.

### Build 007 — Audit Trail & Administrative Safety Controls
- append-only audit events.
- before/after values where appropriate.
- actor, reason, IP/session metadata where lawful and useful.
- elevated action confirmations.
- audit viewer for owners/admins.

## Phase 1 — Campground model and visual map

### Build 008 — Campground/Section/Subsection Administration
- create/edit campground structure.
- multiple sections/subsections.
- display order.
- active/inactive state.
- future multi-property boundaries.

### Build 009 — Overhead Image Library
- secure upload/storage of aerial/drone/site-plan images.
- image metadata, versions, active map selection.
- zoom/pan viewer.
- image validation and size controls.

### Build 010 — Polygon Plotter Core
- click-to-create irregular polygons.
- connect points/close shape.
- select/move vertices.
- add/remove vertices.
- move polygon.
- undo/redo.
- normalized coordinates.

### Build 011 — Polygon Editor Advanced Controls
- duplicate.
- lock/unlock.
- hide/show.
- layer order.
- labels/icons.
- configurable opacity.
- bulk selection.
- safe deletion/archive.

### Build 012 — Map Layers
- booking layer.
- maintenance layer.
- utility layer.
- amenities layer.
- management-only layer.
- layer permissions and visibility.

### Build 013 — Campsite & Area Object Binding
- bind a polygon to a site, cabin, event space, amenity, road, washroom, utility, store, dock, etc.
- enforce unique/canonical object linkage.
- object inspector panel.

### Build 014 — Campsite Master Data
- site number/name/type.
- dimensions.
- parking.
- surface.
- shade.
- RV/trailer limits.
- site photos.
- notes.

### Build 015 — Utilities, Amenities & Restrictions
- electrical/amperage.
- water.
- sewer/septic.
- Wi-Fi.
- fire pit/picnic table.
- swimming/waterfront/accessibility.
- pets, vehicles, guests, generator/fire/quiet-hour restrictions.

### Build 016 — Site Status Engine
- available/occupied/maintenance/closed.
- reserved/arriving/departing/inspection/seasonal/walk-in/management-hold states.
- status history.
- state transition rules.
- map colours generated from status.

### Build 017 — Management Map Controls
- block one/many sites.
- close section.
- date-range closure.
- maintenance/weather/private-event/emergency reason.
- scheduled reopening.
- auditable override.

## Phase 2 — Reservation and availability engine

### Build 018 — Booking Calendar & Date Rules
- check-in/check-out rules.
- booking windows.
- min/max stay.
- same-day controls.
- weekends/holidays/season rules.

### Build 019 — Site Compatibility Engine
- filter by equipment type/length.
- utilities.
- accessibility.
- pets.
- vehicles.
- guest counts.
- required amenities.

### Build 020 — Server-Authoritative Live Availability
- calculate availability from reservations, holds, closures, assignments, and rules.
- live refresh.
- no client-trusted availability.
- concurrency tests.

### Build 021 — Atomic Temporary Reservation Holds
- configurable hold duration.
- countdown timer.
- atomic acquisition.
- expiry/reaping.
- conflict handling.
- anti-double-booking tests.

### Build 022 — Public Interactive Booking Map
- requested dates + party/equipment filters.
- available green.
- occupied/unavailable grey.
- maintenance yellow.
- closed red.
- selectable site details and photos.
- accessible list alternative to map.

### Build 023 — Rate Plans & Pricing Rules
- nightly/weekly/monthly/seasonal/yearly.
- weekend/holiday/peak/off-season/event.
- extra guest/pet/vehicle/service fees.
- discounts/promotions.
- server price quotation.

### Build 024 — Reservation Checkout
- guest identity/contact.
- party, vehicles, pets.
- rules acknowledgment.
- addons.
- price breakdown.
- hold revalidation.
- reservation creation.

### Build 025 — Deposits, Balances & Payment Adapter
- full/fixed/percent deposits.
- balance due dates.
- security deposits.
- payment-provider abstraction.
- Stripe test-mode adapter.
- verified idempotent webhooks.

### Build 026 — Reservation Confirmation & Receipts
- confirmation number.
- email/in-app confirmation.
- receipt/invoice record.
- resend workflow.
- printable view.

### Build 027 — Reservation Management Console
- create/edit/move/extend/shorten/cancel.
- site upgrade/change.
- fee/addon changes.
- reason capture.
- full event history.

### Build 028 — Refunds, Cancellations & Financial Safeguards
- cancellation policies.
- partial/full refunds.
- approval thresholds.
- original-payment linkage.
- audit.
- reconciliation checks.

### Build 029 — Seasonal, Yearly & Walk-Up Site Models
- seasonal assignment.
- annual/long-term record.
- walk-up inventory.
- overflow.
- owner/staff holds.
- mixed inventory within sections.

## Phase 3 — Front desk and guest journey

### Build 030 — Guest Profiles & Guest Account
- optional account.
- contact details.
- saved RV/vehicle/pet profiles.
- stay history.
- receipts.
- favourites.
- privacy controls.

### Build 031 — Check-In Workflow
- payment verification.
- occupants.
- vehicles/licence plates.
- pets.
- rules.
- passes/access codes.
- add rentals/store items.
- checked-in state.

### Build 032 — Check-Out Workflow
- outstanding balance.
- rental return.
- deposit handling.
- departure state.
- automatic post-departure task trigger.

### Build 033 — My Stay Guest Portal
- site details/map.
- dates.
- campground rules.
- Wi-Fi instructions.
- store/rentals/events.
- assistance.
- receipts.
- extend-stay request.

### Build 034 — Extend Stay / Site Move Workflows
- availability check.
- repricing.
- payment difference.
- housekeeping/maintenance implications.
- audit trail.

### Build 035 — Reviews & Moderation
- campground/site/cabin/rental/event/amenity reviews.
- verified-stay linkage.
- moderation.
- abuse reporting.
- publication controls.

## Phase 4 — Maintenance and field operations

### Build 036 — Maintenance Taxonomy & Priority Model
- garbage, fire pit, septic, water, electrical, tree, road, washroom, Wi-Fi, building, rental, landscape, etc.
- configurable priorities Emergency/Urgent/Normal/Preventive.
- SLA/target times.

### Build 037 — Work Order Engine
- create/assign/status.
- site/location.
- category/priority.
- notes/media.
- materials/labour.
- completion evidence.
- history.

### Build 038 — Maintenance Roles & Foreman Queue
- maintenance employee/senior/crew leader/foreman/main foreman/manager.
- assignment permissions.
- escalation.
- triage queue.
- management visibility.

### Build 039 — Departure Cleanup & Inspection Automation
- checkout creates quick-clean/inspection.
- checklist by site type.
- keep site unavailable until required checks pass.
- completion restores bookability when appropriate.

### Build 040 — Preventive Maintenance & Recurring Work
- scheduled washroom/grounds/equipment/site tasks.
- recurring templates.
- overdue warnings.
- seasonal maintenance plans.

### Build 041 — Maintenance Mobile Workspace
- assigned jobs.
- large touch targets.
- map navigation.
- start/pause/complete.
- notes/photos.
- quick material/labour capture.

### Build 042 — Offline Maintenance Queue
- cached assigned jobs.
- queued updates.
- retry/sync.
- conflicts.
- explicit sync status.
- booking/payment writes excluded from offline finalization.

## Phase 5 — Camper assistance, incidents and communication

### Build 043 — Camper Assistance Popup
- active-stay/site linking.
- categories: maintenance/garbage/septic/electrical/water/Wi-Fi/noise/security/store/rental/other.
- severity.
- description/photo/contact preference.

### Build 044 — Incident Triage & Escalation
- management/foreman queue.
- reclassify priority.
- assign.
- contact guest.
- notes/media.
- escalation.
- close with outcome.

### Build 045 — Emergency Communication Guardrails
- campground/section/site/staff audience.
- templates.
- approval controls.
- audit.
- explicit emergency-services disclaimer/routing.

### Build 046 — Notification Platform
- email/in-app foundation.
- provider adapters for SMS/push.
- templates.
- opt-in/opt-out where required.
- delivery status/retry.

### Build 047 — Campground Announcements
- planned outages.
- weather-related operating notices.
- event notices.
- quiet-hours reminders.
- section-specific announcements.

## Phase 6 — Amenities, rentals and events

### Build 048 — Amenity Catalogue
- pools/beaches/playgrounds/laundry/showers/washrooms/Wi-Fi/fishing/hiking/boat launch/dog park/store/etc.
- description/location/photos/hours/rules/fees/status.

### Build 049 — Rental Inventory
- pedal boats/canoes/kayaks/paddleboards/bikes/golf carts/fishing gear/life jackets/BBQs/games.
- quantities/assets.
- hourly/daily rates.
- deposits.
- availability.

### Build 050 — Rental Booking & Return Inspection
- reservation linkage.
- pickup/return.
- condition.
- damage.
- deposit handling.
- maintenance trigger.

### Build 051 — Event & Facility Booking
- halls/pavilions/shelters/fields/wedding areas/group sites.
- date/time availability.
- capacities.
- rates/deposits.
- blackout periods.

## Phase 7 — Store, POS and campsite delivery

### Build 052 — Product & Supplier Catalogue
- products/categories/SKU/barcode.
- supplier.
- purchase/sell price.
- tax category.
- margin.
- images.
- active state.

### Build 053 — Inventory Ledger
- receipts.
- sales.
- returns.
- waste.
- adjustments.
- transfers.
- low-stock thresholds.
- expiry tracking where applicable.

### Build 054 — POS Register
- scan/search/cart.
- campsite-account charging.
- cash/card.
- receipts.
- returns/refunds.
- cashier permissions.

### Build 055 — Cash Session & POS Management Controls
- open/close register.
- expected/actual cash.
- manager variance.
- refunds/discount permissions.
- immutable transaction history.

### Build 056 — Online Campground Store
- camper catalog.
- cart.
- online payment or authorized campsite account.
- availability-aware inventory.

### Build 057 — Campsite Delivery & Pickup
- delivery/pickup selection.
- delivery service global toggle.
- delivery hours.
- active-stay validation.
- staff fulfillment queue.
- delivered/picked-up state.

## Phase 8 — Staff and workforce

### Build 058 — Staff Directory & Employment Roles
- staff profiles.
- department.
- role assignments.
- campground assignments.
- active/inactive.
- emergency contact data kept appropriately restricted.

### Build 059 — Employee Scheduling
- shifts.
- department schedules.
- maintenance/store/front desk coverage.
- phone view.
- conflict detection.

### Build 060 — Timekeeping
- clock in/out.
- breaks.
- overtime flags.
- department/job allocation.
- audit and manager adjustment workflow.

### Build 061 — Training, Qualifications & Access Readiness
- role-required training.
- certifications.
- expiry.
- qualification checks for restricted work.

## Phase 9 — Vendors, contracts and recurring services

### Build 062 — Vendor Directory & Contracts
- garbage, septic, ISP, propane, firewood, pest, electrical, plumbing, etc.
- contacts.
- contracts.
- start/end dates.
- documents.
- rates.

### Build 063 — Recurring External Services
- garbage pickup schedules.
- septic schedules.
- service reminders.
- completion records.
- associated cost/invoice.

### Build 064 — Accounts Payable Intake
- supplier/vendor invoices.
- due dates.
- approval state.
- campground/department allocation.
- payment status.

## Phase 10 — Finance and management

### Build 065 — Revenue & Expense Classification
- reservation/store/rental/event/service revenue.
- payroll/utilities/garbage/septic/internet/insurance/tax/fuel/maintenance/supplies/contractor costs.
- configurable categories.

### Build 066 — Internal Ledger & Financial Event Model
- charges/payments/refunds/deposits/taxes/expenses.
- append-oriented financial entries.
- traceability to source transaction.

### Build 067 — Profit & Loss Reporting
- daily/weekly/monthly/annual.
- gross/net.
- occupancy.
- revenue per site/guest.
- store/rental profitability.

### Build 068 — Payment & Ledger Reconciliation
- reservation vs payment.
- POS vs payment.
- deposit/refund matching.
- exception queue.
- investigation audit notes.

### Build 069 — Management Operations Dashboard
- occupancy.
- arrivals/departures.
- sites awaiting inspection.
- urgent maintenance.
- store deliveries.
- rentals.
- revenue.
- overdue vendor items.

### Build 070 — Accounting Export/Integration Adapter
- export standardized financial data.
- adapter framework for QuickBooks/Xero or other systems later.
- no provider lock-in.

## Phase 11 — Search, media, documents and operational intelligence

### Build 071 — Global Search
- guest/reservation/site/phone/email/licence plate/work order/employee/product/rental/payment.
- permission-filtered results.

### Build 072 — Document Management
- contracts.
- insurance.
- safety.
- vendor agreements.
- employee docs.
- rental agreements.
- campground rules.
- retention/access controls.

### Build 073 — Media Management
- campsite/product/maintenance/damage/inspection media.
- private/public classification.
- signed access for private media.
- attachment audit.

### Build 074 — Universal Timeline
- reservation, maintenance, guest assistance, POS/rental, financial and management events in a permission-filtered timeline.

## Phase 12 — Reliability, accessibility, multi-property and production hardening

### Build 075 — Accessibility & Device Certification
- keyboard.
- screen reader.
- touch.
- contrast.
- responsive layouts.
- phone/tablet/desktop browser matrix.

### Build 076 — Performance & Realtime Scale Review
- query budgets.
- indexes.
- realtime subscriptions.
- image optimization.
- caching.
- load/concurrency tests for high-demand booking periods.

### Build 077 — Abuse, Rate-Limit & Security Hardening
- rate limiting.
- anti-bot controls on high-risk public actions.
- upload abuse controls.
- auth attack protections.
- webhook replay protection.
- penetration-test checklist.

### Build 078 — Backup, Restore & Disaster Recovery
- database backup validation.
- restoration drill.
- storage recovery.
- rollback.
- incident runbook.
- recovery objectives.

### Build 079 — Privacy, Retention & Data Subject Workflows
- retention policies.
- export.
- correction.
- deletion/anonymization where legally appropriate.
- sensitive employee/incident data controls.

### Build 080 — Multi-Campground Readiness
- property switching.
- organization ownership.
- cross-property owner dashboard.
- strict tenant isolation tests.

## Phase 13 — Extended campground operations

### Build 081 — Operational Asset Maintenance Scheduler & Inspection Matrix
- treat pools, lifeguarded pools, water parks/splash pads, washrooms, showers, laundry, playgrounds, baseball/softball fields, sports courts, beaches, docks, boat ramps, halls and similar facilities as maintainable operational assets.
- hourly/daily/weekly/monthly/seasonal/custom recurring work.
- configurable inspection templates and responsible department.
- automatic work-order creation.
- completion and missed-task history.
- failed inspection can close/restrict the asset until cleared.
- maintenance and management sign-off rules.
- map/polygon linkage.
- safety-sensitive tasks remain configurable to applicable local requirements rather than hard-coded legal claims.

### Build 082 — Seasonal/Yearly Site Winterization & Reopening
- seasonal/yearly lifecycle distinct from ordinary reservations.
- configurable winter shutdown checklist.
- water shutoff/draining and campground-defined utility/safety checks.
- evidence/photo/document capture.
- maintenance/foreman sign-off.
- corrective-work loop.
- winter-closed status only after required approvals.
- configurable winter-occupancy alternative with winter-readiness evidence such as insulated/heated water protection where required by campground policy.
- spring/opening inspection and reopening sign-off.

### Build 083 — Permanent Unit / Cottage-Style Ownership & Transfer
- permanent unit record separate from campsite land record.
- current ownership/occupancy history.
- unit can remain physically on site while ownership changes.
- sale/listing status.
- buyer inquiry/application.
- campground approval workflow.
- transfer documents, fees and inspections.
- agreement renewal/replacement.
- closing checklist and audit trail.

### Build 084 — Office Financing Application & Compliance Boundary
- optional office financing/application workflow for eligible permanent units.
- application intake and document checklist.
- status tracking and staff permissions.
- provider/reference abstraction for external financing.
- lending decision, disclosure, identity verification and payment-plan boundaries treated as regulated/high-risk operations.
- no client-calculated approval or hidden credit decision logic.
- strong confidential-data controls and audit logging.

### Build 085 — Recurring Events, Ticketing & Venue Access
- one-time and recurring event series.
- Friday dances, seasonal/Halloween activities, live entertainment, tournaments, meals and other campground events.
- free/paid/reservation-required events.
- recurrence with per-occurrence override/cancellation.
- venue, capacity, attendee restrictions and camper/visitor eligibility.
- ticket/pass/wristband/QR access.
- event check-in and attendance.
- event revenue/refunds where applicable.

### Build 086 — Visitor Registration, Limits & Access Credentials
- office visitor registration linked to host campsite/reservation.
- adjustable maximum visitors by campground, section, site type and individual site.
- visitor fees.
- vehicle registration where applicable.
- arrival/departure validity window.
- wristband, printed pass, QR pass or future electronic-key abstraction.
- allowed/restricted areas and events.
- revoke/expire workflow.
- visitor access audit history.

### Build 087 — Golf Cart, E-Bike & Campground Device Registration
- register guest/seasonal-resident mobility and recreational devices used around the campground.
- golf carts, e-bikes and other campground-permitted vehicle/device classes.
- owner/host site.
- identifier/serial/plate/description.
- document/insurance references if required by campground policy.
- approved driver records.
- optional safety inspection and sign-off.
- expiry, suspension and revocation.
- access restrictions by area/time/device class.

### Build 088 — Waterfront, Boat Launch, Dock & Slip Operations
- model lakes/rivers/ocean access, beaches and swimming zones.
- boat registration.
- boat launch/ramp access.
- campsite-linked eligibility by default.
- configurable paid day-use/non-camper access.
- launch fees.
- trailer/tow-vehicle record.
- dock/slip assignment.
- transient and seasonal dock occupancy.
- waterfront rule acknowledgement.
- closures and incident linkage.

### Build 089 — Facility Safety Rules, Acknowledgement & Enforcement
- versioned rule sets for pools, lifeguarded swimming areas, water parks, beaches, docks, boat ramps, sports fields, playgrounds and other controlled features.
- hours, age/supervision rules, capacity and access restrictions.
- required acknowledgement when configured.
- exact rule-version evidence.
- warning/incident records.
- authorized-staff removal or access suspension.
- management review and reinstatement.
- closure controls.
- explicit boundary that iCamp records/enforces campground policy but does not replace trained staff or statutory safety requirements.

### Build 090 — Production Readiness Gate
- complete end-to-end guest booking.
- payment sandbox to production-readiness checklist.
- maintenance lifecycle including recurring operational assets.
- seasonal/yearly winterization lifecycle.
- visitor/access, event, waterfront and safety-policy workflows.
- POS lifecycle.
- security matrix.
- monitoring.
- rollback.
- no critical/high unresolved defects.

### Build 091 — First Campground Pilot
- configure one real campground.
- upload real overhead image.
- plot sites and operational assets.
- enter site types, utilities, amenities, rules and rates.
- configure recurring maintenance/inspection schedules.
- configure seasonal/yearly policies if applicable.
- configure visitor, vehicle/device, event and waterfront policies if applicable.
- create staff roles.
- test bookings and operations without exposing production publicly until accepted.

### Build 092 — Public Launch Gate
- production domain.
- legal pages.
- privacy/terms.
- production payment credentials.
- notification credentials.
- backups.
- support workflow.
- final GREEN verification.

## Build gate applied to every build
Every build must answer:
1. What user/business requirement does it satisfy?
2. What data changes are required?
3. What permissions are required?
4. What security risks are introduced?
5. What audit events are required?
6. What automated tests prove correctness?
7. What responsive/accessibility checks apply?
8. Does it affect availability, money, inventory, or permissions? If yes, are writes server-authoritative and idempotent where needed?
9. What manual action, if any, is unavoidable?
10. Is dev healthy and is the deployment/version traceable?

## Manual actions expected later
We should not ask for these before the corresponding build needs them.
- Supabase/project authorization and any secret values.
- Hosting account/project connection if no connector can perform it.
- Payment provider account acceptance and production activation.
- SMS/email provider account setup if selected.
- Domain/DNS ownership changes.
- Real business/tax/legal configuration.
- Real campground aerial/overhead image.
- Real rates, policies, taxes, site inventory, products, contracts, staff, and vendor data.

For each manual action, provide exact numbered steps at the time it is needed. Secrets should be entered directly into the provider/deployment secret store and should not be pasted into chat.
