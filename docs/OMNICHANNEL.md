# iCamp Omnichannel Source of Truth

## Purpose

iCamp must remain usable when a camper, visitor or staff member has:
- a smartphone with the full Web/PWA;
- an ordinary mobile phone with SMS;
- a landline or basic phone with a numeric keypad;
- weak campground data coverage;
- a preference or accessibility need for voice rather than a graphical interface.

The channels are different interfaces to the **same iCamp backend**.

## Supported channels

### Web/PWA
Full visual experience, including maps, galleries, dashboards and graphical administration.

### IVR/DTMF
Inbound/outbound telephone calls using numeric keypad tones. Speech input may be supported by the chosen provider.

### SMS/MMS
Text-based guided menus, structured commands, notices and secure-link handoffs. MMS may accept photos where provider/device support exists.

### Staff-assisted telephone
Transfer or callback to campground staff when automation is unsuitable.

## Core rule

No channel owns business logic.

For example, Web booking, IVR booking and SMS booking all call the same:
- availability service;
- compatibility engine;
- temporary-hold service;
- pricing engine;
- reservation service;
- payment workflow;
- audit system.

The same principle applies to maintenance, visitors, vehicles, passes, rentals and other modules.

## Guest workflow expectations

### Availability and booking
Web: full map/list experience.

IVR example:
1. Press 1 for reservations.
2. Enter arrival date.
3. Enter number of nights.
4. Choose Tent, RV or Cottage.
5. Enter people/pets/equipment details as prompted.
6. Hear compatible options by site/cottage number and short description.
7. Select an option.
8. iCamp creates the same temporary hold used by the web system.
9. Confirm contact information.
10. Receive a secure payment link by SMS or transfer to an approved payment workflow.
11. Hear/receive confirmation.

SMS can guide the same process using numbered choices or structured conversation.

### Existing reservation
Guests can:
- retrieve booking;
- hear/read arrival/departure;
- request balance;
- extend stay if available;
- request cancellation;
- add a vehicle/visitor;
- request assistance;
- ask for common services.

Sensitive changes require verification.

### Campsite/cottage information
A caller can enter a site/cottage number and hear:
- type;
- utilities;
- occupancy;
- important features;
- accessibility;
- rate summary;
- availability.

SMS can also return a secure link to the 10-image gallery/map.

### Visitor registration
Guests or office staff can register visitors through guided voice/text workflows, subject to configured limits and fees.

### Vehicle registration
Plate/jurisdiction and vehicle details can be entered by SMS or staff-assisted voice. Numeric-only IVR can collect identifiers that fit DTMF; mixed alphanumeric plate entry should use speech, SMS or staff assistance.

### Camper assistance
Press/text categories for:
- maintenance;
- water;
- electrical;
- septic;
- Wi-Fi;
- garbage;
- security;
- noise;
- store/rental;
- other.

Urgent/life-safety prompts must not imply that iCamp replaces emergency services.

### Store/service orders
Common items/services can have numeric catalogue codes, such as:
- firewood;
- ice;
- garbage pickup;
- garbage sticker/tag;
- common store bundles.

Complex browsing is better handled by SMS link/Web/PWA or staff.

### Events and local interests
Callers can hear upcoming campground activities and curated nearby events based on stay dates. SMS can send details/official links.

### Rentals/waterfront
Guided voice/text can check/reserve equipment, register a boat, request launch access and manage dock/slip assignments where configured.

## Staff workflow expectations

Authorized staff can receive:
- work-order assignments;
- shift alerts;
- incident alerts;
- overdue inspection notices;
- gate/security alerts.

Guided staff IVR/SMS can:
- accept/decline assignments;
- change simple work-order status;
- complete checklist answers;
- report a defect;
- query Site/Asset status by number;
- record short notes;
- acknowledge alerts.

High-risk commands require stronger authentication.

## Management/administrative telephone operations

Where meaningful, authenticated management can query or command:
- site/cottage status;
- closures;
- staff/work order status;
- arrivals/departures;
- occupancy summary;
- urgent incidents;
- gate state;
- vendor/service reminders.

High-risk operations such as refunds, permission changes, financing records or gate overrides may be available only after strong re-authentication and explicit confirmation, and some may intentionally use secure-link/staff-console handoff.

## Graphical-only functions

The following cannot honestly be duplicated on a numeric keypad:
- drawing/editing polygons;
- visually positioning labels;
- viewing photographs;
- visual drag/drop layout tasks;
- graphical reports/charts.

For these, telephone/SMS provides operational equivalence:
- identify the object by numeric ID/site number;
- query/update allowable fields/status;
- send a secure visual link if required;
- transfer to staff if necessary.

## Authentication model

Phone number/caller ID is **not identity proof**.

Possible guest verification:
- reservation number;
- site/cottage number plus booking detail;
- one-time code;
- account PIN.

Staff privileged verification:
- staff identifier;
- PIN;
- second factor/one-time code or authenticated approval;
- recent-authentication window.

Authentication is risk-based: hearing campground hours requires none; opening a gate or issuing a refund requires strong controls.

## Telephone payment

Raw payment card data must not be entered into a custom iCamp IVR or SMS conversation.

Approved patterns:
- secure provider-hosted payment link sent by SMS;
- staff uses the tokenizing payment-provider terminal/workflow;
- future PCI-compliant hosted IVR payment product.

## SMS consent and purposes

Messages are classified:
- operational/transactional;
- safety;
- staff operations;
- marketing/promotional.

Consent/preference records are purpose-specific.

For Canadian commercial text messages, iCamp must be able to retain consent evidence, identify the sender and provide an unsubscribe mechanism as required by applicable CASL rules.

Provider STOP/START/HELP events synchronize to iCamp's internal preference ledger.

## Telephone/SMS security

- provider webhook signatures verified;
- idempotent processing;
- rate limiting;
- replay protection where applicable;
- message bodies/DTMF treated as untrusted input;
- sensitive DTMF/PIN values redacted;
- no secrets echoed;
- session expiry/retry limits;
- suspicious repeated attempts surfaced;
- sensitive data kept out of ordinary SMS whenever a secure link is safer.

## Channel parity acceptance

Each build must maintain a channel matrix:

| Status | Meaning |
| --- | --- |
| Full | Action is fully supported in the channel. |
| Guided equivalent | Same business result through a menu/text workflow. |
| Secure-link handoff | Channel authenticates/routes the user, then securely hands off a visual or protected step. |
| Staff transfer | Automation is inappropriate; user can reach authorized staff. |
| Not applicable | Inherently graphical or technically meaningless for this channel; reason required. |

A build is not complete if a non-visual operational workflow becomes Web-only accidentally.

## Build 009 foundation implementation

Build 009 now provides the canonical shared communications records used by every channel:

- private endpoints;
- purpose/channel preferences;
- append-only consent evidence;
- provider-neutral dispatches;
- bounded provider attempts;
- append-only normalized provider events;
- delivery/call/retry health.

The development adapter is `mock`. Builds 010–014 progressively connect real voice/IVR, DTMF, SMS/MMS, identity verification and compliance synchronization without creating a second communications business model.

## Build 010 voice gateway implementation

Build 010 promotes voice from foundation-only to a provider-neutral sandbox gateway:

- inbound signed webhook ingestion;
- outbound call placement;
- semantic IVR state sessions;
- staff transfer/fallback;
- provider event idempotency and replay controls.

Build 011 supplies numeric keypad collection on top of the same IVR state machine, and Build 012 now supplies the SMS/MMS conversation and command gateway. Voice, keypad and text therefore share one provider-neutral communications/business-logic path.


## Build 011 DTMF implementation

Build 011 adds a bounded numeric keypad interaction layer:

- short 1/2/3 site/reservation/pass menu;
- 8 repeat, 9 staff, 0 main and * back conventions;
- transient multi-digit site/reservation/pass entry;
- bounded invalid/timeout retries;
- provider-event idempotency;
- digit-free semantic evidence;
- sensitive PIN/verification redaction;
- aggregate keypad health only.

Keypad possession never substitutes for identity proof. Build 013 adds the risk-based caller verification layer.

## Build 012 SMS/MMS implementation

Build 012 adds the provider-neutral text gateway:

- inbound/outbound SMS;
- outbound MMS over validated secure-media assets;
- inbound MMS/photo metadata quarantined as pending scan;
- short numbered menus and keywords;
- structured site/reservation/pass command parsing;
- natural-language intent proposals with mandatory server validation;
- signed webhook/replay protection;
- provider-event idempotency;
- delivery/read history when supported;
- aggregate private diagnostics.

Sender address is a routing hint, not identity. Structured identifiers remain verification-gated and natural-language proposals remain validation-gated. Build 013 adds telephone/SMS identity and re-authentication.


## Build 013 identity-verification implementation

Build 013 makes telephone/SMS identity proof channel-neutral:

- voice and SMS use the same short-lived challenge model;
- caller ID and sender address remain routing hints only;
- guest lookup intent requires guest-reference plus one-time-code verification;
- staff access requires a salted channel PIN;
- privileged staff commands require channel PIN plus OTP or recent approved-session re-authentication;
- authorization is checked after identity verification, not replaced by it;
- DTMF site/reservation/pass entries and structured SMS lookup commands return `verify.identity` before protected business lookup;
- raw PINs, OTPs, phone numbers and guest references are excluded from verification/audit/health evidence.


## Build 014 messaging-consent implementation

Build 014 makes the Build 009 purpose/consent model enforceable for SMS/MMS:

- exact STOP/START/HELP controls are normalized before ordinary messaging intents;
- STOP creates provider-level suppression and withdraws marketing messaging;
- ordinary outbound SMS/MMS is blocked before provider dispatch while suppressed;
- START removes transport suppression but does not silently restore marketing consent under the conservative Canadian fallback;
- HELP/compliance responses can remain available while suppressed;
- marketing dispatch requires current granted consent when the active jurisdiction rule requires it;
- campground/jurisdiction compliance rules are configurable without provider lock-in;
- the append-only preference ledger excludes raw message bodies and endpoint values.

This provides technical CASL readiness without treating application configuration as legal certification.


## Build 015 workflow parity implementation

Build 015 makes the channel-parity contract executable rather than advisory:

- a validated workflow registry declares Web/PWA, IVR/DTMF and SMS/MMS support for guest, staff, management and graphical workflow families;
- IVR and SMS adapters call a supplied canonical domain command rather than duplicating business rules;
- protected or unavoidable visual steps use a provider-neutral secure-link handoff;
- unsafe or unsuitable telephone automation uses a provider-neutral staff-transfer fallback;
- graphical-only tasks such as polygon drawing are explicitly marked instead of being represented as fake keypad equivalents;
- raw payment-card collection remains outside the custom iCamp IVR/SMS conversation;
- automated proof compares key guest and staff workflows across IVR and SMS and fails if the registry becomes accidentally Web-only.

Future product builds must extend the parity matrix whenever they add a user-visible operational workflow.
