# iCamp Master Vision — iCamp2027

## 1. Mission

iCamp is a complete campground operating platform for phones, tablets, laptops and desktop computers. It is designed to run the public camper experience and the internal campground business from one authoritative system.

iCamp is not only a reservation application. It combines:
- live campsite and cottage booking;
- a virtually realistic overhead campground map;
- site, cottage and facility media;
- front desk and guest services;
- visitor and vehicle registration;
- gate/access security;
- maintenance, inspections and recurring upkeep;
- seasonal/yearly site administration;
- permanent-unit/cottage-style ownership transfers;
- events, tickets and passes;
- local-attraction discovery and promotion;
- waterfront, dock, boat and launch operations;
- rentals;
- campground store, POS, pickup and delivery;
- staff, scheduling and timekeeping;
- vendors, contracts and recurring services;
- accounting, costs, profits/losses and management reporting;
- safety rules, incidents, acknowledgements and enforcement.

The public experience should remain simple even though the management system behind it is comprehensive.

## 2. One authoritative campground model

A campsite, rental cottage, facility, dock, store item, reservation, guest, vehicle, visitor, work order and financial transaction each have one canonical record.

Booking, maintenance, security, POS and management do not keep disconnected copies of the same campground objects.

A site can simultaneously be:
- a clickable polygon on the overhead map;
- available or occupied;
- linked to a guest reservation;
- linked to registered vehicles and visitors;
- receiving store delivery;
- awaiting inspection;
- associated with utility and maintenance history;
- producing revenue and cost records.

## 3. Virtually realistic campground map

Management can upload a real overhead image, drone image, aerial photograph, site plan or high-quality illustration.

Authorized staff can plot irregular areas by clicking points around:
- campsites;
- cottages/cabins;
- washrooms;
- pools;
- water parks/splash pads;
- beaches/swimming zones;
- baseball/softball fields;
- playgrounds;
- halls/pavilions;
- stores;
- roads;
- parking;
- garbage stations;
- boat launches;
- docks/slips;
- maintenance buildings;
- utilities;
- restricted areas;
- other important locations.

The map supports zoom and pan without losing alignment. Polygon geometry is stored in image-space/normalized coordinates and transformed at render time, so the clickable area remains accurate regardless of zoom level, device size, image scaling or high-DPI display.

The plotter must support:
- create/close irregular polygons;
- add/move/delete vertices;
- move/duplicate polygons;
- lock/unlock;
- hide/show;
- archive;
- undo/redo;
- labels/icons;
- layer ordering;
- opacity;
- snapping/precision aids where useful;
- zoom-aware editing and hit testing;
- accessible non-map alternatives.

## 4. Visual status

Default campsite/cottage states:
- available — translucent green;
- occupied/unavailable — muted/grey;
- maintenance/inspection required — translucent yellow;
- closed/unavailable — translucent red.

Additional states may include held, reserved, arriving today, departing today, cleaning, inspection required, seasonal, yearly, winterized, winter-readiness pending, walk-up, management hold, weather closure and emergency closure.

Colours are derived from authoritative operational state, not manually painted.

## 5. Campsites, cottages and accommodation inventory

iCamp supports distinct accommodation/site types, including:
- tent-only;
- RV/trailer;
- mixed tent/RV;
- full-service;
- electric-only;
- water/electric;
- unserviced;
- waterfront;
- seasonal/yearly;
- walk-up;
- overflow;
- cabins;
- rustic rental cottages;
- serviced cottages with kitchens and/or washrooms;
- park models/permanent units.

Rental cottages use the same live availability, hold, pricing, payment and reservation engine as campsites, while supporting cottage-specific attributes such as:
- bedrooms/beds;
- occupancy;
- kitchen/kitchenette;
- private/shared washroom;
- shower;
- linens;
- heating/cooling;
- appliances;
- accessibility;
- view/waterfront;
- housekeeping;
- damage/security deposit;
- cottage-specific inspection and turnover.

## 6. Site and cottage photography

Each specific campsite or cottage can have up to **10 managed customer-facing images** from different views, plus separately classified internal/maintenance media.

The media system should support:
- ordering/hero image;
- captions;
- accessibility alt text;
- public/private classification;
- version/replace/archive;
- orientation metadata;
- safe image processing;
- thumbnails and optimized delivery.

The overhead map can open the relevant gallery when a site/cottage is selected.

## 7. Live booking and temporary holds

Guests enter dates, party size, pets, equipment type/size, required hookups and desired features.

The server determines compatible live inventory.

When a site or cottage is selected, iCamp creates an atomic temporary hold for a configurable period. No overlapping valid hold or reservation can be created for the same inventory and time.

Checkout revalidates:
- availability;
- hold ownership;
- current price;
- rules;
- capacity;
- inventory compatibility;
- payment state.

## 8. Rates, deposits and payments

Pricing may include:
- nightly, weekly, monthly, seasonal and yearly rates;
- cottage rates;
- peak/off-season;
- weekday/weekend;
- holiday/event;
- extra adults/children;
- pets;
- extra vehicles;
- visitor fees;
- day/week passes;
- Wi-Fi;
- firewood/ice;
- rentals;
- boat launch/dock fees;
- garbage pickup stickers;
- other services.

Management can configure full payment, fixed/percentage deposits, security deposits, scheduled balances and cancellation/refund rules.

Raw card data is never stored by iCamp.

## 9. Guest, front desk and check-in/out

Front desk workflows can manage:
- identity/contact;
- guests/occupants;
- pets;
- vehicles;
- visitors;
- passes/access credentials;
- rule acknowledgements;
- balances;
- store/rental add-ons;
- check-in/check-out;
- site/cottage changes;
- stay extensions.

Checkout can automatically create turnover/inspection work before the accommodation becomes bookable again.

## 10. Vehicle registration and passes

Any car, truck, motorcycle, tow vehicle or other regular road vehicle on campground property can be required to be registered to:
- an active campsite/cottage reservation;
- a seasonal/yearly site;
- a staff/contractor authorization;
- or an approved day/week pass.

Records can include plate, province/state, description, owner/driver, host reservation/site, validity dates, pass/fee, and access status.

Management can configure maximum vehicles by site/site type/section and paid extra-vehicle rules.

## 11. Visitors and access credentials

Visitors can be required to register at the office and link to the camper/site they are visiting.

iCamp supports:
- configurable maximum visitors;
- fees;
- arrival/departure windows;
- vehicle registration;
- wristbands;
- printed passes;
- QR passes;
- key cards/fobs;
- keypad/PIN credentials;
- future electronic access credentials;
- event-specific access;
- expiry/revocation.

## 12. Physical security and gate control

iCamp includes a dedicated security/access module.

It may integrate with compatible:
- gate controllers;
- key card/fob systems;
- keypad systems;
- barrier arms;
- door/access controllers.

The module should track:
- gate/door open/closed/unknown state when hardware supports it;
- device health/connectivity;
- access attempts/events;
- credential used;
- time;
- associated guest/site/visitor/staff record;
- denied access reason;
- manual staff override.

Authorized staff can issue a manual open/close command where supported. Every override must be permission-controlled and audited.

Hardware integration must use a server-side adapter/gateway boundary; browsers must not directly control gate hardware. Physical emergency release, fire/life-safety requirements and local code always remain independent of iCamp.

## 13. Mobility/recreational devices

Golf carts, e-bikes and other campground-permitted devices can require registration and optional safety checks.

Records may include:
- owner/host site;
- serial/identifier;
- description;
- approved drivers;
- insurance/document references if campground policy requires them;
- inspection checklist;
- approval/expiry;
- restrictions;
- suspension/revocation.

## 14. Maintenance and operational assets

Pools, washrooms, showers, water parks, beaches, baseball fields, playgrounds, halls, roads, docks, launches, garbage areas, septic facilities and other features are **operational assets**, not merely amenities.

They can have:
- map location/polygon;
- operating/open/closed state;
- inspection templates;
- hourly/daily/weekly/monthly/seasonal/custom maintenance;
- automatically generated work orders;
- responsible team;
- required sign-off;
- failure/closure rules;
- condition history;
- incident history;
- photos/documents.

## 15. Garbage and waste service

Campgrounds may use different garbage models:
- communal garbage bins/dumpsters;
- site pickup included in stay;
- scheduled site pickup;
- paid pickup;
- purchased garbage stickers/tags/bags;
- recycling/organics streams.

iCamp should allow management to configure the model per campground/section.

Paid stickers/tags can be:
- sold through POS or online store;
- linked to a guest/site;
- uniquely numbered or QR/barcode identified where desired;
- redeemed/collected by maintenance;
- included in revenue and inventory;
- tracked for pickup scheduling and completion.

## 16. Camper assistance

Guests can request assistance from My Stay or a QR-accessed interface for issues such as:
- garbage;
- septic;
- electrical;
- water;
- Wi-Fi;
- maintenance;
- noise;
- security;
- store delivery;
- rental;
- other.

Requests are linked to the active stay/site where possible and support severity, text, media and contact preference.

## 17. Seasonal/yearly site lifecycle

Long-term sites require a lifecycle beyond a normal short-stay reservation.

Winter shutdown can require:
- owner/occupant declaration;
- water shutoff/draining;
- campground-defined electrical/propane/safety steps;
- removal/storage requirements;
- photo/document evidence;
- maintenance inspection;
- foreman sign-off;
- corrective work;
- winter-closed status.

Where cold-weather occupancy is permitted, management can require a winter-readiness checklist, such as documented water insulation/heating protection.

Spring reopening can require another inspection and sign-off.

## 18. Permanent units and cottage-style ownership

Some trailers, park models or cottage-like units remain physically on the same site when bought and sold.

The permanent unit is a separate object from the land/site.

iCamp supports:
- ownership history;
- occupancy;
- listing status;
- buyer inquiry;
- campground approval;
- inspection;
- fees;
- transfer documents;
- closing checklist;
- agreement replacement/continuity;
- optional office financing application workflow.

Financing is treated as a high-risk regulated workflow and may be integrated with an appropriate external provider. iCamp must not improvise lending decisions or legal disclosures.

## 19. Campground events

Campgrounds may run:
- Friday dances;
- Halloween-in-summer;
- live entertainment;
- tournaments;
- meals;
- markets;
- holiday events;
- private events.

Events can be free or paid, recurring or one-time, capacity-limited, camper-only or visitor-eligible.

iCamp supports venue, recurrence, tickets/passes/wristbands, registration, check-in, access rules, cancellation and revenue/refunds.

## 20. Local interests and destination promotion

iCamp should help sell the **destination**, not only the campsite.

Management can maintain nearby attractions and time-limited local events such as:
- fall fairs;
- truck/car shows;
- festivals;
- farmers' markets;
- beaches;
- hiking;
- fishing;
- museums;
- restaurants;
- local shopping;
- seasonal attractions.

Local-interest records can include:
- name;
- category;
- location/distance;
- dates/hours;
- description;
- official/source link;
- image where licensed/appropriate;
- expiry/review date;
- family/pet/accessibility tags.

These can be promoted contextually through:
- booking flow;
- confirmation;
- pre-arrival messages;
- My Stay;
- event/activities pages;
- campground announcements;
- post-booking recommendations.

Management controls what is promoted. Time-sensitive external events must have a freshness/expiry workflow so stale events are not advertised.

Marketing preferences and applicable consent/opt-out requirements must be respected.

## 21. Waterfront, boat launches and docks

Waterfront operations can include:
- lakes/rivers/ocean access;
- swimming zones;
- boat launches/ramps;
- docks/slips;
- transient/seasonal dock occupancy.

Boats can be linked to an active site/cottage by default, with configurable paid day-use access for non-campers.

Rules, launch fees, registrations, tow vehicles, dock assignments, closures and incidents are tracked.

## 22. Safety rules and enforcement

Pools, lifeguarded swimming, beaches, water parks, docks, boat ramps, sports areas, playgrounds and other controlled features can have versioned rules.

iCamp supports:
- displayed rules;
- acknowledgements;
- age/supervision restrictions;
- capacity;
- hours;
- warnings;
- incidents;
- access suspension/removal;
- reinstatement/review;
- closure.

iCamp records campground policy and staff action. It does not replace trained staff, certified inspections, emergency services or statutory safety obligations.

## 23. Rentals

Rental inventory can include pedal boats, canoes, kayaks, paddleboards, bicycles, golf carts, fishing equipment, life jackets, BBQs, games and other equipment.

Rental records include availability, pricing, deposits, agreements, condition, return inspection, damage and maintenance.

## 24. Store and POS

The campground store can sell:
- firewood;
- charcoal;
- ice;
- food/drinks/snacks;
- toiletries;
- camping supplies;
- propane;
- batteries;
- souvenirs;
- fishing supplies;
- garbage stickers/tags;
- passes;
- other goods/services.

POS supports barcode/search, cash/card, campsite account charges, refunds, receipts, cash sessions and permissions.

Campers can order online for pickup or site delivery when management enables the service.

## 25. Staff, vendors and business administration

iCamp supports roles such as owner, administrator, manager, foreman, maintenance, housekeeping, store, reservation/front desk, security, accounting and contractors.

Permissions are granular rather than relying only on job title.

Business administration includes:
- employee scheduling/timekeeping;
- vendors/contracts;
- garbage/septic/ISP/propane/firewood providers;
- recurring service schedules;
- supplier invoices;
- costs and expenses;
- revenue;
- taxes;
- payments/refunds/deposits;
- accounting exports/integrations;
- profit/loss;
- operational dashboards.

## 26. Search, documents, media and audit

Global search respects permissions and can cover guests, reservations, sites, cottages, vehicles, visitors, work orders, staff, products, rentals, payments and passes.

Documents and media are classified public/internal/confidential.

Privileged changes are audited with actor, time, action, reason and before/after state where practical.

## 27. Offline field work

Maintenance and inspection workflows should eventually tolerate poor campground connectivity by caching assigned tasks and queuing safe field updates.

Booking, payment, access-control commands and other high-risk writes remain server-authoritative.

## 28. Multi-campground future

The initial deployment may serve one campground, but the architecture must support multiple properties and organizations without rebuilding the core data model.

## 29. Development approach

Development should use free or low-cost tiers where practical and avoid unnecessary provider lock-in.

The active numbered roadmap is intentionally restarted after the pre-implementation engineering baseline so every Build number reflects this complete vision.

## 30. Ultimate objective

Management should be able to answer:

**What is happening in our campground right now?**

Campers should experience a simple visual system for choosing a place to stay, understanding the property, discovering nearby activities, managing their stay, accessing facilities, shopping, renting equipment and obtaining help.
