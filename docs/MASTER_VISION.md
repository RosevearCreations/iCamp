# iCamp Master Vision — iCamp2027

## Purpose
iCamp is a complete campground operating system for mobile phones, tablets, PCs, laptops and web/PWA use. It combines the public camper experience with internal front-desk, maintenance, retail, workforce, financial and management operations.

## Core experience
A real overhead image, drone image, aerial image, site plan or campground illustration becomes the visual center of the system. Management can draw irregular multi-point polygons directly over that image and bind each polygon to a real campground object such as a campsite, cabin, washroom, event area, dock, road, utility, store, playground or maintenance asset.

The same authoritative campground model powers booking, maintenance and management instead of maintaining disconnected copies.

## Interactive campground map
Management can upload and version overhead images. Authorized users can create polygons by clicking points and closing the shape. The editor must support adding, moving and deleting vertices; moving, duplicating, locking, hiding and archiving polygons; labels/icons; opacity; undo/redo; map layers; and different permissions for public and internal data.

Default campsite state presentation:
- available — translucent green
- occupied/unavailable — muted or greyed
- maintenance required — translucent yellow
- closed — translucent red

Additional states may include reserved, arriving today, departing today, inspection required, seasonal, walk-in, management hold, weather closure and emergency closure.

## Campsite and area records
Each bookable or operational area can store identification, section/subsection, type, dimensions, RV/trailer limits, parking, pull-through/back-in configuration, surface, shade, utilities, electrical amperage, water, sewer/septic, Wi-Fi, fire pit, picnic table, accessibility, waterfront/swimming access, pet/vehicle/guest limits, generator/fire/quiet-hour restrictions, photographs and internal notes.

## Public booking
Guests choose arrival/departure dates, party size, pets, equipment type and size, required hookups and amenities. iCamp returns genuinely live compatible inventory.

Availability is server-authoritative. A site cannot be double-booked.

Selecting a site creates a configurable temporary hold, such as 5–20 minutes. Other users cannot acquire an overlapping valid hold. The guest sees a countdown. Successful checkout converts the hold to a reservation; expiry releases it.

Booking rules can apply campground-wide, by section, by site, by date/season/event and by customer/inventory class. Rules include minimum/maximum stays, weekend/holiday minimums, advance windows, same-day policies and check-in/check-out times.

Pricing supports nightly, weekly, monthly, seasonal and yearly rates; peak/off-season, weekend, holiday and event rates; promotions; and charges for additional people, pets, vehicles, Wi-Fi, utilities, services, rentals and other add-ons.

## Deposits and payments
Management can configure full payment, fixed or percentage deposit, security deposit and future balance rules. Payment processing is integrated through a replaceable provider adapter. iCamp never stores raw card data.

Reservations support creation, modification, moves, extensions, shortening, cancellations, upgrades, add-ons, discounts, refunds and complete history.

## Front desk
Check-in can verify payment, guests, vehicles/licence plates, pets, rules and access information and can add store/rental items. Check-out settles outstanding items, handles deposits/rentals and marks departure.

A departure can automatically create a cleanup/inspection task and place the site into maintenance/inspection state until required checks pass.

## Maintenance
Maintenance uses the same campground map with an operations-focused layer.

Work categories may include garbage, fire-pit cleanup, site cleanup, washroom/shower cleaning, septic, water, electrical, damaged tables/fire pits, trees, roads, landscaping, pests, plumbing, Wi-Fi, buildings, rental equipment and emergencies.

Priorities include Emergency, Urgent, Normal and Preventive and remain configurable.

Roles may include maintenance employee, senior employee, crew leader, foreman, main foreman, operations manager, general manager and owner/admin.

Work orders track location, category, priority, reporter, assignment, timestamps, media, materials, labour, status, completion notes/evidence and inspection.

Preventive and recurring maintenance are supported.

## Camper assistance
A camper can open iCamp from a website/PWA/QR code and submit assistance linked to the active stay/site. Categories can include maintenance, garbage, septic, electrical, water, Wi-Fi, noise, security, store delivery, rental assistance and other.

The camper can provide severity, description, media and preferred contact method. Foremen/management can reclassify, assign, escalate, contact the guest and close the issue.

Life-threatening emergencies must be clearly routed toward official emergency services; iCamp must not represent itself as a replacement for them.

## Sections and inventory models
Campgrounds can contain multiple sections and subsections with their own rates, rules, staff, amenities and restrictions.

Inventory may be nightly/weekly reservable, seasonal, yearly, long-term, walk-in only, overflow, staff/owner use or temporarily blocked.

Management can block a site, multiple sites, a section, amenity, facility, rental item, event space, single date or date range for maintenance, weather, construction, private use, emergency or other reasons.

## Amenities, rentals and events
Amenities can include pools, lakes, beaches, playgrounds, laundry, washrooms/showers, Wi-Fi, fishing, trails, boat launches, dog parks, stores, restaurants and recreation areas with photos, hours, rules, fees, location and status.

Rental inventory can include pedal boats, canoes, kayaks, paddleboards, bicycles, golf carts, fishing equipment, life jackets, BBQs and games. Rentals support quantity/assets, hourly/daily rates, deposits, availability, agreements, condition checks and maintenance.

Event/facility rentals can include halls, pavilions, shelters, fire pits, meeting rooms, fields, wedding areas and group campsites.

## Campground store and POS
iCamp includes a campground store with products such as firewood, charcoal, ice, drinks, snacks, food, toiletries, camping supplies, bug spray, sunscreen, propane, batteries, souvenirs, clothing and fishing supplies.

The POS supports scanning/search, cart, cash/card, campsite-account charges, receipts, refunds, cash sessions and staff permissions.

Inventory tracks products, categories, suppliers, purchase/sell price, quantity, reorder levels, receipts, damage/waste, expiry, barcodes/SKUs and margins.

Campers can order online from their site, choose pickup or site delivery and pay online or use an authorized campsite account.

Delivery can be turned on/off and limited by schedule.

## Management and business operations
Management must have complete control over campground configuration and appropriate administrative override capabilities, with sensitive actions audited.

Revenue tracking includes campsites, seasonal sites, cabins, events, rentals, store sales, firewood, propane, Wi-Fi, visitor fees, parking, laundry and services.

Expenses include payroll, utilities, internet, garbage, septic, insurance, property tax, fuel, maintenance, supplies, retail inventory, contractors, repairs, equipment, marketing, banking/payment fees and other categories.

Vendor/contract management covers garbage collection, septic, ISP, propane, firewood, pest control, electricians, plumbers and other providers, including contact details, contracts, dates, rates, service schedules, invoices and documents.

Recurring services such as garbage pickup can be scheduled and tracked with reminders, completion and costs.

## Personnel and roles
The system supports owners, administrators, general managers, campground managers, assistants, foremen, maintenance, grounds, cleaning, store, reservation/front desk, security, accounting and contractors.

Authorization is permission-based rather than solely title-based. Permissions can independently control booking changes, refunds, rates, map editing, maintenance assignment, inventory, reporting, finance, user administration and other functions.

Employee scheduling, mobile schedule viewing, timekeeping, breaks, overtime and labour allocation are included in the roadmap.

## Accounting and reporting
iCamp tracks sales, deposits, payments, refunds, taxes, expenses, vendors, accounts payable, revenue/cost categories and traceable ledger events, with export/integration capability for external accounting systems.

Reports include daily/weekly/monthly/annual revenue, expenses, gross/net profit, occupancy, revenue per site/guest and profitability of store/rentals.

Management dashboard answers what is happening now: occupancy, arrivals/departures, inspections, urgent maintenance, store deliveries, active rentals, revenue and overdue items.

## Guest account and portal
Optional guest accounts can contain contact information, stays, vehicles, RVs, pets, receipts, rentals, orders and favorite sites.

During a stay, My Stay provides the site, dates, map, rules, Wi-Fi, store, rentals, events, assistance, payments/receipts and extend-stay functions.

Verified guests can review the campground, site, cabin, rental, event or amenity, subject to moderation.

## Communications
Email, SMS, push and in-app channels are provider-adapted. Use cases include confirmations, receipts, arrival/checkout reminders, work assignments, store orders, emergencies, weather/operating advisories and announcements.

Management can target an entire campground, section, site or staff audience, with strong controls on emergency broadcasts.

## Audit, search, documents and media
Privileged actions log actor, action, timestamp and before/after state where practical.

Global search can cover guest, reservation, site, phone/email, licence plate, work order, employee, product, rental and payment while respecting permissions.

Document storage supports contracts, insurance, safety materials, vendor agreements, employee files, rental agreements, rules and inspections.

Media storage supports site/product photos and private maintenance, damage, inspection and complaint evidence.

## Offline field work
Maintenance should eventually work with weak connectivity: cache assigned jobs, checklists and map/site data; capture notes/photos; queue changes; and sync with conflict handling later. Financial and booking finalization remains server-authoritative.

## Multi-campground future
Initial operation may be one campground, but architecture must support multiple campground properties/organizations without redesigning core tables.

## Free/low-cost development
Development should prioritize free or inexpensive tiers where practical while keeping providers replaceable. Suitable categories include GitHub for source control, managed PostgreSQL/Auth/Storage/Realtime such as Supabase, PWA hosting on a modern serverless platform, an open-source image/polygon engine, optional MapLibre for geographic mapping and payment-provider sandbox/test environments.

## Ultimate objective
From the management side, iCamp should answer: **What is happening in our campground right now?**

From the camper side, a complex operating system should feel like a simple visual booking, stay-management, shopping, rental and assistance application.


## Extended campground operations — permanent sites, safety, visitors, vehicles and waterfront

### Operational facilities are maintainable assets
Pools, guarded pools, water parks/splash pads, washrooms, showers, laundry buildings, recreation halls, playgrounds, baseball/softball fields, sports courts, beaches, boat launches, docks, roads, garbage areas, septic facilities and similar park features must be modeled as operational assets, not only public-facing amenities.

Every applicable asset can have:
- a location/polygon on the campground map;
- operating/open/closed status;
- safety rules and posted instructions;
- maintenance categories;
- inspection templates;
- recurring upkeep schedules measured in hours, days, weeks, months or seasons;
- required sign-off roles;
- condition history and incident history;
- photographs/documents;
- automatic work-order generation;
- closure until a failed inspection is resolved.

Examples include hourly pool-deck checks, daily washroom cleaning, weekly sports-field inspection, scheduled water-quality/operational checks, and seasonal opening/closing procedures.

### Seasonal/yearly site lifecycle and winterization
Long-term and yearly sites require a lifecycle beyond a normal reservation.
A site can be configured as seasonal/yearly/permanent-unit occupancy and can require a formal winter shutdown.

Winterization can require:
- owner/occupant declaration;
- water shutoff;
- line draining/winterization;
- electrical/propane safety steps where applicable;
- removal/storage requirements;
- photo evidence;
- maintenance inspection;
- maintenance/foreman sign-off;
- date completed;
- exceptions/defects and corrective work.

A site does not reach the configured winter-closed state until required sign-offs pass.

Campgrounds that permit continued cold-weather occupancy can instead require a **winter-readiness compliance record**, such as documented insulated/heated water protection or other campground-defined safety requirements. Management controls the checklist; iCamp records evidence and approvals rather than inventing legal/safety standards.

### Permanent-unit / cottage-style sites
Some long-term sites contain trailers, park models or cottage-like units that are bought and sold while remaining on the same campground site.

iCamp must support:
- a permanent-unit record distinct from the land/site record;
- current ownership/occupancy history;
- listing-for-sale status;
- office-managed inquiries and approval workflow;
- transfer/application process;
- campground fees and administrative charges;
- documents and inspection requirements;
- sale/transfer closing checklist;
- site agreement continuity or replacement;
- optional financing/application workflow offered by the campground or an external provider.

Financing functions must be architected as regulated/high-risk financial workflows: iCamp may collect an application and track status, but lending decisions, disclosures, identity verification, payment schedules and legal obligations must be handled only through appropriately configured campground processes/providers.

### Campground events and access control
Campgrounds may run recurring and one-time activities such as Friday-night dances, holiday/Halloween events, live entertainment, tournaments, meals, markets and private functions.

Events can be:
- free;
- paid;
- reservation-required;
- capacity-limited;
- camper-only;
- visitor-eligible;
- age/restriction controlled;
- wristband/pass/key/QR controlled.

Events require recurrence rules, venue assignment, capacity, dates/times, access rules, fees, attendee registration, ticket/pass issuance, check-in and cancellation/closure controls.

### Visitor registration and passes
Visitors to campers can be required to register at the office before entering.

Visitor controls include:
- host campsite/reservation;
- visitor identity/contact details appropriate to campground policy;
- vehicle registration if applicable;
- arrival/departure validity;
- visitor fee;
- wristband, printed pass, QR pass or access credential;
- allowed areas/events;
- revoked/expired status.

Maximum visitors are configurable at campground, section, site-type and individual-site level and may be constrained by site size, occupancy, fire/safety capacity or management policy.

### Site types and service compatibility
Sites explicitly model camping/accommodation type and services. Examples include:
- tent-only;
- RV/trailer;
- mixed tent/RV;
- cabin/cottage/park model;
- full service;
- electric-only;
- water/electric;
- no hookups;
- waterfront;
- seasonal/yearly;
- walk-up.

Booking compatibility must prevent selection that violates configured site/equipment/utility/occupancy rules.

### Personal mobility and recreational vehicle registration
Campground-operated or guest-owned vehicles/devices used within the property can require registration and, where campground policy requires it, inspection/approval.

Examples:
- golf carts;
- e-bikes;
- mobility/recreational carts;
- ATVs/UTVs where permitted;
- other campground-authorized devices.

Records can include owner/host campsite, identifying description/serial/plate, insurance/document references where required, approved drivers, expiry, safety inspection checklist, approval/revocation status and access restrictions.

### Waterfront, boat launch and dock operations
Waterfront campgrounds may manage:
- lakes;
- rivers;
- ocean access;
- beaches;
- swimming zones;
- boat launches/ramps;
- docks/slips;
- transient boat access.

Boat registrations can be linked to an active campsite/reservation by default, while management can optionally allow non-camper day access for a fee.

Records can include boat owner, registration/description, host site, launch fee, launch permission, dock/slip assignment, arrival/departure, trailer/vehicle information and rules acknowledgement.

### Safety-rule acknowledgement and enforcement
Pools, lifeguarded swimming areas, beaches, water parks, docks, boat ramps, sports facilities, playgrounds and other controlled features can have versioned rule sets.

iCamp must support:
- displayed rules;
- required acknowledgement where configured;
- age/supervision restrictions;
- capacity limits;
- opening hours;
- temporary closures;
- incident/warning records;
- access suspension/removal by authorized staff;
- reinstatement/management review;
- audit history.

For lifeguarded or supervised areas, staff can record warnings and enforce facility removal/suspension according to campground policy. iCamp records policy and enforcement; it does not replace trained staff judgment or statutory safety requirements.
