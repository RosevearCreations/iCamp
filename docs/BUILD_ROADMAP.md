# iCamp Active Build Roadmap — Restarted Product Sequence

## Roadmap status

The repository/CI/security work completed before this document is the **Pre-Implementation Engineering Baseline** and is intentionally **not** part of the active build numbering.

The active iCamp2027 product roadmap restarts here at **Build 001**.

No active product build should begin until this roadmap reset is accepted as the source of truth.

---

# Phase 1 — Application, Data and Security Foundation

## Build 001 — Responsive PWA Application Shell
- Establish public, guest, front-desk, maintenance, security, POS, staff and management workspaces.
- Phone/tablet/desktop responsive shell.
- PWA manifest/installability baseline.
- Accessible navigation and layout primitives.

## Build 002 — Environment, Configuration & Health Framework
- Typed environment configuration.
- dev/production distinction and environment banners.
- health/version/build-SHA endpoints.
- feature flags and safe configuration validation.

## Build 003 — Database, Migration & Multi-Property Foundation
- PostgreSQL migration system.
- organizations, campgrounds and property boundaries.
- UUID keys, timestamps and record lifecycle conventions.
- migration verification in CI.

## Build 004 — Authentication & Secure Sessions
- Guest/staff authentication.
- reset/recovery.
- secure session lifecycle.
- privileged MFA readiness.

## Build 005 — Roles, Permissions & Row-Level Security
- Permission catalogue.
- role templates/custom roles.
- campground assignments.
- deny-by-default server authorization and RLS tests.

## Build 006 — Audit Trail & Privileged Action Controls
- Append-oriented audit events.
- reason capture.
- before/after state where practical.
- recent re-authentication hooks for high-risk operations.

## Build 007 — Background Jobs, Scheduler & Operational Queues
- Durable scheduled-job abstraction.
- retry/idempotency conventions.
- dead-letter/failed-job visibility.
- scheduler health reporting.

## Build 008 — Secure Media & Document Storage Foundation
- Public/internal/confidential media classes.
- signed access for private media.
- image/file validation and limits.
- metadata and lifecycle records.

## Build 009 — Notification Platform Foundation
- In-app/email foundation.
- provider adapter interfaces for SMS/push.
- notification templates and delivery events.
- opt-in/opt-out framework.

## Build 010 — Demo Campground, Test Data & End-to-End Harness
- Synthetic campground seed.
- demo sites/cottages/assets.
- browser test framework.
- no production personal data in test fixtures.

---

# Phase 2 — Campground Structure and Virtually Realistic Map

## Build 011 — Campground, Section & Subsection Administration
- Multiple campground sections/subsections.
- ordering, active/inactive state.
- section-specific settings.

## Build 012 — Overhead Image Library & Versioning
- Upload real overhead/drone/site-plan images.
- source image dimensions/version metadata.
- active/published map version.
- safe image processing.

## Build 013 — Zoom/Pan Coordinate Engine
- Store geometry in original-image/normalized coordinates.
- shared transform matrix for image, polygons, labels and hit testing.
- zoom/pan/high-DPI correctness tests.
- prevent clickable-area drift.

## Build 014 — Polygon Plotter Core
- Click-to-create irregular polygons.
- close shape.
- vertex add/move/delete.
- polygon validation.

## Build 015 — Advanced Polygon Editing
- Move/duplicate.
- undo/redo.
- lock/unlock.
- hide/archive.
- precision and selection aids.

## Build 016 — Map Layers, Labels & Icons
- Booking, maintenance, security, utilities, amenities and management layers.
- visibility permissions.
- labels/icons and layer order.

## Build 017 — Canonical Map Object Binding
- Bind polygons/points to canonical sites, cottages, pools, washrooms, gates, docks, roads, buildings and assets.
- prohibit orphan/duplicate bindings.
- object inspector.

## Build 018 — Unified Accommodation Model
- Canonical accommodation parent model.
- campsite/cottage/permanent-unit subtype linkage.
- shared availability/status hooks.

## Build 019 — Campsite Types & Utility/Service Model
- Tent, RV, mixed, serviced/unserviced, waterfront, seasonal/yearly and walk-up types.
- electrical amperage, water, sewer/septic, Wi-Fi.
- dimensions, RV limits and site characteristics.

## Build 020 — Rental Cottage Model
- Rustic and serviced rental cottages.
- bedrooms/beds/occupancy.
- kitchen/kitchenette.
- private/shared washroom/shower.
- heating/cooling/appliances/accessibility/view.

## Build 021 — Cottage Turnover & Housekeeping Model
- Turnover templates.
- linen/housekeeping requirements.
- damage/security inspection.
- cottage inventory checklist.

## Build 022 — Site/Cottage Public Gallery: Up to 10 Images
- Maximum 10 active public images per accommodation.
- hero ordering/captions/alt text.
- thumbnails/optimized variants.
- internal maintenance media remains separate.

## Build 023 — Operational Asset Model
- Pools, water parks, washrooms, fields, playgrounds, halls, beaches, docks, launches, roads, garbage/septic areas and similar assets.
- map linkage and operating status.

## Build 024 — Accommodation & Asset Status Engine
- available/occupied/maintenance/closed.
- held/reserved/arriving/departing/inspection/winterized/etc.
- status history and transition rules.

## Build 025 — Management Closures, Holds & Map Publication
- Block individual/multiple accommodations/assets/sections.
- dated closure reasons.
- safe map publication/version switch.
- auditable overrides.

---

# Phase 3 — Booking, Availability, Pricing and Payments

## Build 026 — Booking Calendar & Date Rules
- Check-in/out times.
- booking windows.
- minimum/maximum stays.
- weekends/holidays/seasons.

## Build 027 — Capacity, Guest & Vehicle Limit Rules
- Maximum occupants/visitors/vehicles.
- rules by campground, section, accommodation type and individual accommodation.
- site-size-aware configurable limits.

## Build 028 — Accommodation Compatibility Engine
- Tent/RV/cottage compatibility.
- equipment length/utilities.
- accessibility/pets/occupancy/features.
- reject incompatible booking choices server-side.

## Build 029 — Server-Authoritative Live Availability
- Reservations, holds, closures, turnover and seasonal assignments.
- live refresh.
- concurrency tests.

## Build 030 — Atomic Temporary Reservation Holds
- Configurable hold duration.
- countdown.
- atomic conflict prevention.
- expiry/release and idempotency.

## Build 031 — Public Interactive Booking Map
- Date/filter-driven map.
- green/grey/yellow/red operational presentation.
- selectable accommodation polygons.
- accessible list alternative.

## Build 032 — Campsite & Cottage Detail/Booking Experience
- Features, rules, rate summary.
- up-to-10-image gallery.
- map context and nearby amenities.
- cottage-specific details.

## Build 033 — Rate Plans & Dynamic Date Pricing
- Nightly/weekly/monthly/seasonal/yearly.
- cottage rates.
- weekend/holiday/peak/off-season/event.
- promotional rates.

## Build 034 — Add-Ons, Passes and Service Fees
- Extra guests/vehicles.
- visitor/day/week passes.
- Wi-Fi, garbage pickup, rentals, launch fees and other add-ons.
- tax/fee configuration hooks.

## Build 035 — Reservation Checkout
- Guest/contact data.
- occupants/pets/vehicles.
- rule acknowledgement.
- add-ons and final server quote.
- hold revalidation.

## Build 036 — Deposits, Balances & Payment Provider Adapter
- Full/fixed/percentage deposits.
- security deposits.
- balance due rules.
- provider sandbox integration and verified webhooks.

## Build 037 — Confirmations, Receipts & Reservation Documents
- Confirmation numbers.
- receipt/invoice records.
- email/in-app confirmation.
- printable view.

## Build 038 — Reservation Management Console
- Create/edit/move/extend/shorten/cancel.
- accommodation changes.
- fees/add-ons.
- complete change history.

## Build 039 — Cancellation, Refund & Adjustment Safeguards
- Policy engine.
- partial/full refund.
- approval thresholds.
- original-payment linkage and audit.

## Build 040 — Walk-Up, Overflow & Office Booking
- Staff-created bookings.
- walk-up inventory.
- overflow areas.
- same authoritative availability engine.

## Build 041 — Seasonal/Yearly Assignment Foundation
- Long-term site assignment.
- seasonal/yearly charges.
- non-nightly lifecycle.
- integration point for winterization and permanent units.

---

# Phase 4 — Guest, Front Desk, Vehicles, Visitors and Physical Access

## Build 042 — Guest Profiles & Saved Stay Information
- Optional account.
- contact details.
- RV/vehicle/pet profiles.
- stay/receipt history and privacy controls.

## Build 043 — Front Desk Check-In
- Verify balance/occupants/pets.
- vehicle and visitor setup.
- rules and access credentials.
- rentals/store add-ons.

## Build 044 — Check-Out & Accommodation Turnover Trigger
- Outstanding charges.
- rentals/keys/credentials return.
- automatic cleaning/inspection.
- departure status.

## Build 045 — My Stay Guest Portal
- Reservation/site/cottage.
- map/rules/Wi-Fi.
- store/rentals/events/local interests.
- assistance/receipts.

## Build 046 — Stay Extension & Accommodation Move
- Recheck availability.
- repricing/payment difference.
- maintenance/housekeeping impact.
- audit.

## Build 047 — Road Vehicle Registration
- Cars, trucks, motorcycles, tow vehicles.
- plate/jurisdiction/description.
- owner/driver and host accommodation.
- validity and status.

## Build 048 — Day/Week Vehicle Passes & Extra-Vehicle Fees
- Non-stay vehicle passes.
- date/time validity.
- fee/payment.
- parking/access rules.

## Build 049 — Visitor Registration & Site-Specific Limits
- Host site/reservation.
- visitor identity/contact as configured.
- max-visitor rule resolution.
- fees and visit validity.

## Build 050 — Access Credential Abstraction
- Key card/fob.
- keypad PIN.
- QR/printed/wristband pass.
- provider credential references.
- expiry/revocation.

## Build 051 — Gate, Barrier & Access Device Registry
- Gates/doors/barriers/controllers.
- zones and hardware/provider mapping.
- device health state.
- management configuration.

## Build 052 — Gate State & Access Event Monitoring
- Open/closed/unknown when supported.
- access attempts.
- credential/person/vehicle association.
- denied-access reason.

## Build 053 — Manual Gate Open/Close Override
- Permission-controlled server command.
- required reason.
- rate limit/re-auth hooks.
- complete audit/provider outcome.

## Build 054 — Access Zones, Schedules & Rules
- Guest/visitor/staff/contractor access.
- time/day/zone restrictions.
- camper-only areas and event access.

## Build 055 — Security Incident Management
- Access/security incident.
- severity/assignment.
- notes/evidence.
- escalation and resolution.

## Build 056 — Wristband/QR/Pass Issuance & Validation
- Issue/revoke/expire.
- event/visitor/day-use linkage.
- non-guessable validation identifiers.

## Build 057 — Credential Lifecycle at Check-In/Check-Out
- Provision on arrival.
- extend when stay extends.
- revoke at checkout/cancellation.
- lost/replaced credential workflow.

## Build 058 — Security & Access Operations Dashboard
- Gate/device status.
- active credentials.
- recent denied access.
- overrides.
- expiring passes and incidents.

---

# Phase 5 — Maintenance, Inspections, Waste and Camper Assistance

## Build 059 — Maintenance Taxonomy & Priority Model
- Garbage/fire/septic/water/electrical/grounds/building/etc.
- Emergency/Urgent/Normal/Preventive.
- configurable targets.

## Build 060 — Work Order Engine
- Location/asset/accommodation.
- assignment/status.
- notes/media/material/labour.
- completion evidence.

## Build 061 — Maintenance Roles, Foreman Queue & Escalation
- Crew/foreman/main foreman/manager.
- assignment permissions.
- triage/escalation.

## Build 062 — Recurring Maintenance Scheduler
- Hourly/every-N-hours/daily/weekly/monthly/seasonal/custom.
- discrete occurrence history.
- overdue/missed task handling.

## Build 063 — Versioned Inspection Templates & Sign-Off
- Checklists by asset/site/cottage.
- versioning.
- inspector/sign-off roles.
- failed item corrective action.

## Build 064 — Pool & Water-Park Maintenance Operations
- Recurring checks.
- operating/closure state.
- inspection/maintenance evidence.
- safety-sensitive sign-off hooks.

## Build 065 — Washroom, Shower & Laundry Upkeep
- Scheduled cleaning/inspection.
- supplies/status.
- issue escalation and closure.

## Build 066 — Sports Field, Playground, Hall & Recreation Maintenance
- Baseball/softball fields and other facilities.
- recurring condition checks.
- closures/corrective work.

## Build 067 — Roads, Utilities, Garbage Areas & Infrastructure Maintenance
- Roads/parking.
- electrical/water/septic utility assets.
- garbage/recycling areas.
- scheduled and reactive work.

## Build 068 — Post-Departure Campsite Cleanup & Inspection
- Automatic checkout task.
- site-type checklist.
- block rebooking when configured until cleared.

## Build 069 — Rental Cottage Housekeeping & Turnover
- Cleaning.
- linen/inventory checklist.
- damage evidence.
- release cottage to available state after required sign-off.

## Build 070 — Preventive Maintenance Program
- Equipment/facility maintenance templates.
- service intervals.
- parts/labour history.
- overdue visibility.

## Build 071 — Offline Maintenance Workspace
- Cached assigned work.
- offline notes/checklists/media queue.
- conflict/sync state.
- no offline high-risk finalization.

## Build 072 — Camper Assistance Request Interface
- Maintenance/garbage/septic/electrical/water/Wi-Fi/noise/security/rental/store/other.
- severity/media/contact preference.
- active-stay linking.

## Build 073 — Assistance Triage & Management Escalation
- Reclassify/assign/escalate.
- guest communication.
- closure/outcome.

## Build 074 — Garbage Service Models
- Central bins.
- included site pickup.
- scheduled pickup.
- paid on-demand pickup.
- recycling/organics streams.

## Build 075 — Paid Garbage Stickers/Tags & Pickup Redemption
- POS/online sale.
- optional serialized QR/barcode.
- site/customer linkage.
- redemption/pickup work order.
- inventory/revenue history.

---

# Phase 6 — Rules, Safety, Seasonal Sites, Permanent Units and Financing

## Build 076 — Versioned Campground & Facility Rule Sets
- Campground, pool, waterfront, sports, playground, event and access rules.
- version publication.
- exact-version acknowledgements.

## Build 077 — Warning, Suspension & Reinstatement Workflow
- Authorized staff warnings.
- feature/area access suspension.
- management review/reinstatement.
- audit history.

## Build 078 — Lifeguarded Pool & Supervised Swimming Safety Workflow
- Capacity/age/supervision rules.
- acknowledgement.
- warning/removal records.
- temporary closure.
- trained-staff decision boundary.

## Build 079 — Beach, Lake/Ocean Swimming & Waterfront Safety Rules
- Swimming zones.
- hours/closures.
- waterfront acknowledgements/incidents.
- policy enforcement.

## Build 080 — Emergency Communication & Safety Guardrails
- Whole campground/section/site/staff audiences.
- approval/audit.
- explicit emergency-services boundary.

## Build 081 — Seasonal/Yearly Winterization Workflow
- Configurable shutdown checklist.
- water shutoff/draining and campground-defined utility steps.
- evidence.
- maintenance/foreman sign-off.

## Build 082 — Cold-Weather Winter-Readiness Compliance
- Alternative to shutdown where allowed.
- insulation/heated-water and other campground-defined evidence.
- approval/defect loop.

## Build 083 — Spring Reopening Inspection
- Opening checklist.
- corrective actions.
- authorization to reopen yearly/seasonal site.

## Build 084 — Permanent Unit Ownership Model
- Unit distinct from land/site.
- ownership/occupancy history.
- documents and status.

## Build 085 — Permanent Unit Listing & Buyer Inquiry
- For-sale status.
- approved listing information.
- inquiry routing.
- management visibility.

## Build 086 — Permanent Unit Sale/Transfer Workflow
- Buyer application.
- inspections.
- campground approval.
- fees/documents/closing checklist.
- agreement transfer/replacement.

## Build 087 — Office Financing Application Intake
- Optional financing application.
- confidential documents.
- staff status workflow.
- strict permission boundary.

## Build 088 — Financing Provider/Compliance Boundary
- External provider/reference abstraction.
- decision/disclosure status.
- retention/audit.
- no improvised lending logic.

## Build 089 — Golf Cart, E-Bike & Recreational Device Registration
- Owner/host site.
- serial/description.
- approved driver.
- optional insurance/document references.
- validity/status.

## Build 090 — Recreational Device Safety Inspection & Authorization
- Configurable inspection.
- approval/expiry.
- zone/time restrictions.
- suspension/revocation.

---

# Phase 7 — Campground Events, Local Interests and Destination Promotion

## Build 091 — Campground Event Series & Occurrences
- Friday dances, Halloween events, shows, meals, tournaments, etc.
- one-time/recurring.
- per-occurrence change/cancellation.

## Build 092 — Event Registration, Ticketing & Paid Access
- Free/paid/reservation-required.
- ticket/pass/wristband/QR.
- payment/refund.
- check-in.

## Build 093 — Event Venue, Capacity & Eligibility
- Venue/area.
- capacity.
- camper-only/visitor eligibility.
- age/access restrictions.

## Build 094 — Local Places & Attractions Catalogue
- Nearby beaches, trails, museums, shopping, restaurants, fairs and attractions.
- category/distance/tags.
- official/source reference.

## Build 095 — Time-Limited Local Event Catalogue & Freshness
- Fall fairs, truck/car shows, festivals, markets and other events.
- start/end.
- review/expiry date.
- suppress stale events automatically.

## Build 096 — Contextual Destination Promotion Engine
- Promote relevant local content in booking, confirmation, pre-arrival, My Stay and activities pages.
- date/season/family/pet/accessibility targeting controlled by campground.

## Build 097 — Marketing Preferences, Consent & Opt-Out
- Promotional communication preferences.
- opt-out handling.
- channel rules.
- audit/retention.

## Build 098 — Local Promotion Performance & Content Review
- impressions/clicks where appropriate.
- freshness queue.
- remove ineffective/stale content.
- no hidden advertising data sharing.

## Build 099 — Guest Reviews & Moderation
- Verified-stay reviews of campground/site/cottage/rental/amenity.
- moderation/reporting.
- publication controls.

## Build 100 — Public Activities, Events & Destination Pages
- Campground events.
- local interests.
- date-aware content.
- SEO-friendly public pages where configured.

---

# Phase 8 — Waterfront, Boats, Docks and Equipment Rentals

## Build 101 — Water Features, Beaches & Swimming Zones
- Lakes/rivers/ocean/beaches.
- map linkage.
- operating status/rules.

## Build 102 — Boat Registration
- Owner/guest.
- host accommodation.
- boat description/registration references.
- validity.

## Build 103 — Boat Launch/Ramp Access & Day-Use Fees
- Active-stay eligibility by default.
- configurable non-camper paid access.
- tow vehicle/trailer.
- launch session history.

## Build 104 — Dock & Slip Inventory
- Docks/slips.
- size/features/status.
- transient/seasonal eligibility.

## Build 105 — Dock/Slip Assignment & Availability
- Booking/assignment.
- date ranges.
- campsite/cottage/day-use linkage.
- conflict prevention.

## Build 106 — Equipment Rental Catalogue
- Pedal boats, canoes, kayaks, paddleboards, bikes, golf carts, fishing equipment, life jackets, BBQs, games.

## Build 107 — Rental Availability & Booking
- Hourly/daily.
- reservation linkage.
- deposit/agreement.
- inventory availability.

## Build 108 — Rental Pickup, Return & Damage Inspection
- condition.
- return.
- damage.
- deposit handling.
- maintenance trigger.

## Build 109 — Safety Equipment & Required Rental Accessories
- Life jackets/helmets/etc. as configurable requirements.
- issue/return tracking.

## Build 110 — Waterfront/Rental Operations Dashboard
- Active launches/docks/rentals.
- overdue returns.
- closures/incidents.
- maintenance status.

---

# Phase 9 — Campground Store, POS, Inventory and Delivery

## Build 111 — Product & Supplier Catalogue
- SKU/barcode/category.
- supplier.
- cost/sell price/tax.
- images/status.

## Build 112 — Inventory Movement Ledger
- Receipts/sales/returns/waste/adjustments/transfers.
- low-stock.
- traceable balances.

## Build 113 — POS Register
- Scan/search/cart.
- cash/card/campsite account.
- receipts.
- permissions.

## Build 114 — Cash Session & Register Controls
- Open/close.
- expected/actual.
- manager variance.
- audit.

## Build 115 — Online Campground Store
- Camper catalogue/cart.
- inventory-aware purchase.
- online payment/campsite account.

## Build 116 — Campsite/Cottage Delivery & Pickup
- Delivery/pickup.
- delivery toggle/hours.
- active-stay destination validation.
- fulfillment queue.

## Build 117 — Service Products, Passes & Sticker Sales
- Firewood/ice/propane/services.
- vehicle/day passes.
- garbage stickers/tags.
- service-product linkage.

## Build 118 — Stock Expiry, Damage & Reorder Operations
- Expiry.
- damaged/waste.
- reorder thresholds.
- supplier replenishment.

## Build 119 — POS Refund, Discount & Manager Approval
- Returns/refunds.
- discount permissions.
- thresholds.
- financial/audit linkage.

## Build 120 — Campsite Account Charges & Final Settlement
- Authorized room/site-style charges.
- running stay balance.
- checkout settlement/reconciliation.

---

# Phase 10 — Workforce, Vendors and External Services

## Build 121 — Staff Directory & Department Model
- Staff profiles.
- department.
- campground assignments.
- restricted personal data.

## Build 122 — Employee Scheduling
- Shift/department coverage.
- conflicts.
- phone view.

## Build 123 — Timekeeping
- Clock in/out.
- breaks.
- overtime flags.
- job/department allocation.

## Build 124 — Training, Qualification & Expiry Tracking
- Lifeguard/maintenance/security/etc. qualification records as configured.
- expiry reminders.
- role-readiness checks.

## Build 125 — Vendor Directory & Contract Management
- Garbage/septic/ISP/propane/firewood/trades/etc.
- contacts/contracts/rates/documents.

## Build 126 — Recurring External Service Scheduling
- Garbage collection.
- septic service.
- recurring vendor work.
- completion/cost linkage.

## Build 127 — Accounts Payable Intake
- Vendor invoices.
- due/approval/payment state.
- department/property allocation.

---

# Phase 11 — Finance and Management

## Build 128 — Revenue & Expense Classification
- Accommodation/store/rental/event/pass/service revenue.
- payroll/utilities/garbage/septic/internet/insurance/tax/fuel/etc. expenses.

## Build 129 — Internal Financial Ledger
- Charges/payments/refunds/deposits/taxes/expenses.
- traceability to source.

## Build 130 — Profit & Loss Reporting
- Daily/weekly/monthly/annual.
- gross/net.
- occupancy and per-accommodation metrics.

## Build 131 — Payment, POS & Ledger Reconciliation
- Reservation/payment.
- POS/payment.
- deposits/refunds.
- exception queue.

## Build 132 — Management Operations Dashboard
- Occupancy.
- arrivals/departures.
- maintenance.
- gates/security.
- store deliveries.
- rentals/events.
- revenue and overdue items.

## Build 133 — Accounting Export/Integration Adapter
- Standardized exports.
- provider abstraction for accounting systems.

## Build 134 — Budgets, Cost Centres & Department Spending
- Budget categories.
- campground/department cost allocation.
- variance.

## Build 135 — Accommodation, Cottage, Store & Service Profitability
- Revenue/cost attribution.
- cottage profitability.
- store/rental/service margins.

## Build 136 — Tax, Fee & Financial Configuration Review
- Configurable taxes/fees.
- financial permission review.
- no hard-coded jurisdictional tax assumptions.

---

# Phase 12 — Search, Documents, Intelligence and System-Wide Operations

## Build 137 — Global Permission-Aware Search
- Guest/reservation/site/cottage/vehicle/visitor/work order/staff/product/rental/payment/pass.

## Build 138 — Document Management
- Contracts, insurance, safety, vendor, employee, rental, financing and campground documents.
- retention/access classes.

## Build 139 — Universal Timeline
- Reservation, access, maintenance, assistance, POS, rental, event, finance and management events.
- permission-filtered.

## Build 140 — Reports, Exports & Operational Evidence
- Configurable reports.
- CSV/PDF/export hooks.
- audit-friendly evidence packages.

---

# Phase 13 — Reliability, Security, Privacy and Launch

## Build 141 — Accessibility & Device Certification
- Keyboard/screen reader/touch/contrast.
- phone/tablet/desktop browser matrix.

## Build 142 — Performance, Query Budget & Realtime Scale Review
- Indexes.
- query budgets.
- realtime subscription control.
- image optimization.
- peak booking load tests.

## Build 143 — Abuse, Rate-Limit & Security Hardening
- Auth/public abuse controls.
- upload abuse.
- webhook replay defense.
- access-command safeguards.
- penetration-test checklist.

## Build 144 — Backup, Restore & Disaster Recovery
- Database/storage backup validation.
- restore drill.
- rollback and incident runbook.

## Build 145 — Privacy, Retention, Export & Deletion Workflows
- Guest/visitor/vehicle/staff/incident/financing retention.
- export/correction/deletion/anonymization where applicable.

## Build 146 — Multi-Campground Isolation & Owner Dashboard
- Property switching.
- cross-property ownership.
- strict tenant-isolation tests.

## Build 147 — Full Production Readiness Gate
- End-to-end campsite/cottage booking.
- payments.
- maintenance/inspections.
- physical access.
- visitors/vehicles.
- seasonal/permanent workflows.
- events/local promotions.
- POS/rentals/waterfront.
- finance/security/recovery.

## Build 148 — First Real Campground Pilot Configuration
- Real overhead image.
- polygons.
- sites/cottages/assets/gates.
- rules/rates.
- recurring maintenance.
- staff.
- test credentials and workflows.

## Build 149 — Pilot Operational Acceptance & Remediation
- Front desk.
- maintenance.
- security/access.
- booking.
- POS.
- real device/browser checks.
- close pilot defects before public release.

## Build 150 — Public Launch Gate
- Production domain.
- legal/privacy/terms.
- production payment/notification/access integrations.
- backups/monitoring/support.
- final GREEN verification.

---

# Build Gate Applied to Every Active Build

Every build must explicitly answer:
1. What user/business requirement does it satisfy?
2. What canonical data changes are required?
3. Who may read the data?
4. Who may change it?
5. What server-side authorization/RLS is required?
6. What security/privacy risks are introduced?
7. What audit events are required?
8. What automated tests prove correctness?
9. What responsive/accessibility checks apply?
10. Does it affect availability, money, inventory, physical access, credentials, safety, or permissions?
11. What concurrency/idempotency controls are required?
12. What failure/recovery path is required?
13. What manual user action, if any, is truly unavoidable?
14. Is `dev` GREEN and traceable to a commit before promotion?
15. Is production GREEN after promotion?

# Manual Action Policy

Do not ask the user to perform work that connected tools can safely perform.

Manual action is expected only for items such as:
- provider account authorization/terms;
- billing;
- production secret creation;
- MFA;
- DNS/domain ownership;
- physical gate/access hardware enrollment;
- real campground aerial/overhead image and real site photos;
- real tax/legal/business data;
- real staff/guest/vendor data;
- financing agreements/provider onboarding.

When manual action is required, provide exact numbered steps and never ask for a secret to be pasted into chat.
