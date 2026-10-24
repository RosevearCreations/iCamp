export type HelpAudience = "public" | "operational" | "privileged";

export interface HelpTopic {
  id: string;
  slug: string;
  title: string;
  summary: string;
  details: readonly string[];
  audience: HelpAudience;
  related?: readonly string[];
}

export const helpTopics = {
  "emergency.notices": {
    id: "emergency.notices",
    slug: "emergency-communication-manual-approval-handoff",
    title: "Emergency Communications & Safety Guardrails",
    summary:
      "Draft a campground, section, site or staff notice; record independent management approval and separately attest any manual communication handoff.",
    details: [
      "Choose one audience: the full campground, one active section, one active site/accommodation or assigned campground staff. The audience is a targeting label; saving a draft does not select individual recipients or expose personal contact data.",
      "The author may not approve or reject their own draft. A different owner or campground manager with explicit emergency broadcast permission must review the exact immutable message and on-site instructions; they must acknowledge that approval does not contact emergency services and that they checked the physical emergency plan.",
      "Approval alone does not send an SMS, push, email, IVR call or public notice. An active campground's authorized on-site staff may record a real, separate public-address announcement, sign posting, staff briefing or door-to-door handoff with a source reference. This is operator-attested evidence, not proof that anyone received or understood the message.",
      "Independent management can reject an unapproved draft or cancel an approved notice. Events are append-only, auditable, scoped to one campground and cannot modify the original audience or content.",
      "Inactive demonstration campgrounds such as Camp Rosevear can practice drafting and approval but cannot record a real-world handoff. A genuine emergency always requires contacting appropriate emergency services directly, coordinating trained personnel, physical evacuation and accessible instructions under the campground's local plan.",
      "The software never places emergency calls, triggers rescue, opens physical gates, operates sirens, overrides life-safety procedures or guarantees notification delivery. Future provider integrations require separate approval, consent and delivery evidence controls.",
    ],
    audience: "operational",
    related: ["waterfront.swim", "pool.supervision", "safety.enforcement"],
  },
  "waterfront.swim": {
    id: "waterfront.swim",
    slug: "beach-waterfront-swim-zones-safety",
    title: "Beach Swimming Zones, Hazards & Closures",
    summary:
      "Publish beach swimming zones with locally approved hours and guest rules; document training checks, hazards, entry decisions and independently reviewed reopenings.",
    details: [
      "Only active registered beach facilities appear here. A campground manager publishes immutable zone versions with physical boundaries, local time-zone operating days/hours, maximum swimmers, unaccompanied-swimmer age, minimum supervisor age and adult-to-child ratio. Staff must verify local laws and environmental operating requirements before adopting limits.",
      "Select the exact current published waterfront guest-rule version. A guest's account-linked confirmed or checked-in reservation must have acknowledged that version before a positive admission when acknowledgement is required. A newer rule needs a new zone version and guest acceptance.",
      "Management independently verifies assigned waterfront staff training records and future expiry; an operator cannot verify their own training. Monitoring permission does not establish qualification. Incident reporting and emergency closures remain available to authorized monitors even before training verification.",
      "For each admission, trained staff check the latest zone version, local operating hours, canonical beach operational state, absence of a swimming closure, actual observed weather/water-current/water-quality hazard state, guest rules, counted swimmers and adult supervision, and age verification. Never treat software as a sensor, lifeguard or confirmation that water is safe.",
      "Warnings and removals record observations about one active guest reservation. Use the separate enforcement register for formal guest suspensions. Incident entries describe observed hazards; operators must independently place an immediate swimming closure and follow emergency procedures when unsafe.",
      "A monitor can close swimming at once or request reopening after corrective work. Independent campground management reviews a reopening request with source evidence; the approving person cannot be the closer or the requester. The underlying beach must separately be canonically operational before swimming reopens.",
      "History is append-only, scoped to the assigned campground and restricted by staff permissions. A swim-zone closure does not physically barricade a beach, post warnings, shut down gate equipment, dispatch emergency services or change inspected facility status. Operators must complete those real-world actions separately.",
    ],
    audience: "operational",
    related: ["campground.rules", "pool.supervision", "safety.enforcement"],
  },
  "pool.supervision": {
    id: "pool.supervision",
    slug: "lifeguarded-swimming-safety-register",
    title: "Pool Supervision, Admissions & Safety Holds",
    summary:
      "Manage versioned pool operating rules, independently checked lifeguard credentials, guest admission observations and swimming holds.",
    details: [
      "A manager publishes each pool's capacity, unaccompanied-swimmer age, minimum supervisor age, maximum children-per-supervisor ratio and minimum on-duty lifeguard count. These are local operating choices, not built-in legislative limits. Validate them with the applicable public health authority before use.",
      "Pool policy references an exact currently published pool-rule version from the campground rules register. When those rules change, publish a new supervision policy. Guests acknowledge the rule version in My Stay; positive admission decisions require the matching reservation's acknowledgement.",
      "A campground manager must verify each lifeguard's genuine current credentials and expiry independently, using a source record. Lifeguard role assignment by itself does not prove qualifications. The same manager cannot verify their own credentials; credential revocation is retained in immutable history.",
      "The lifeguard records real-time swimmer, child, supervisor and staff counts. For a positive admission, the pool must be canonically operational, have no active swimming hold, satisfy local limits, and the lifeguard must attest that unaccompanied swimmers' and supervisors' ages were checked on site. No software assertion replaces physical observation or an emergency plan.",
      "Warnings and removals are supervised-swimming records for an active guest reservation, not formal campground suspensions or gate changes. For broader restrictions use the separately reviewed Warnings & Suspensions register.",
      "A verified lifeguard can initiate an immediate swimming hold and request release. Admission remains blocked until independent management approval. The manager approving release cannot be either the hold originator or the release requestor, and the canonical pool must already have returned to operational status through the existing signed-inspection workflow.",
      "Every policy, qualification decision and supervision event is append-only, scoped to one campground, and permission checked. A swimming hold is not a physical closure or emergency-service dispatch. The on-site operator must still close the actual pool and follow their current jurisdiction's rules and emergency procedures.",
    ],
    audience: "operational",
    related: ["campground.rules", "safety.enforcement"],
  },
  "safety.enforcement": {
    id: "safety.enforcement",
    slug: "staff-warnings-suspension-review-reinstatement",
    title: "Warnings, Suspensions & Reinstatement",
    summary:
      "Issue accountable staff warnings, request limited-access suspensions, and require an independent management decision before approval.",
    details: [
      "Authorized security staff or campground management can record a warning or request a suspension for an account-linked confirmed or checked-in reservation. Every record names the guest's reservation and a campground, named facility, access zone or feature category.",
      "Warnings are recorded immediately but do not revoke access. A suspension request starts as pending review; it cannot become active until a campground manager or owner reviews it. The requester cannot approve or deny their own request, even if they also hold a management role.",
      "A manager must enter a reason to approve, deny or reinstate. The case has a conflict-checked revision; refresh if another operator has acted. Denied requests, recorded warnings and reinstated cases are terminal. A new incident requires a new case.",
      "Every transition is logged automatically in an immutable event history with the actor, time and explanation. Initial reasons are visible to the affected guest if the suspension is approved; management decision notes remain internal.",
      "The guest's My Stay portal displays approved active restrictions for their own stay only. This module does not automatically change gate passes, revoke credentials, cancel reservations, close facilities, call emergency services or adjudicate physical safety. Follow the appropriate separately authorized on-site workflow.",
      "Use neutral fact-based descriptions, document follow-up using existing incident or guest-contact channels, and seek management review when restrictions affect access or safety.",
    ],
    audience: "operational",
    related: ["campground.rules", "access.rules", "shell.channels"],
  },
  "campground.rules": {
    id: "campground.rules",
    slug: "versioned-campground-facility-rules",
    title: "Published Campground & Facility Rules",
    summary:
      "Publish immutable versions of campground and facility rules, and record exactly which version each confirmed guest accepted.",
    details: [
      "Authorized management registers a stable rule code and a category: campground, pool, waterfront, sports, playground, event or access. A category may optionally target a single registered facility.",
      "Publish a complete new text each time rules change. Each publication has an immutable version number, author and timestamp; editing the previously published version is deliberately forbidden.",
      "If guest acknowledgement is required, a signed-in guest with a confirmed or checked-in reservation reads the current version through My Stay and explicitly accepts that exact version. Publishing a newer version leaves earlier evidence intact but requires a fresh acknowledgement.",
      "The former booking rules snapshot remains separate; Build 082 does not retroactively change booking contracts, remove access, suspend a guest, close a facility, make lifeguard safety decisions or create enforcement actions.",
      "Phone and SMS channels may provide staff-assisted rule lookup and a secure My Stay handoff. A bare SMS reply or unverified phone call must not create acknowledgement evidence.",
      "Keep safety language up to date and reviewed by the campground owner; publication is not proof of statutory compliance or staff certification.",
    ],
    audience: "public",
    related: ["shell.channels", "campground.structure"],
  },
  "garbage.collections": {
    id: "garbage.collections",
    slug: "garbage-collection-reconciliation",
    title: "Garbage Collection & Receipt Reconciliation",
    summary:
      "Create route manifests, attest collection outcomes and independently review paid-tag receipts.",
    details: [
      "Create a route for one campground, service date and waste stream. This records a dispatch manifest, not an automatic GPS optimized route or recurring schedule.",
      "For each stop, select an existing pickup in the same waste stream, record the observed outcome and explain it. Collected pickups require at least one bag and a pickup already in progress or completed; skipped pickups require zero bags.",
      "The collection ledger is append-only and guards against declaring one pickup collected twice, even across routes. It never silently changes the canonical pickup's status. Update that status separately in Garbage Services.",
      "The optional evidence reference identifies an existing photo/media record or other external evidence; this workflow does not upload a file or claim photo verification by itself.",
      "Finance reviewers compare a tag's issued amount and exact receipt reference against independently inspected POS records. A matched decision must contain the same amount as the issued tag. Follow-up and dispute reviews preserve the history without silently posting a charge, refund or tax invoice.",
      "Owners and campground managers can reconcile; authorized maintenance field roles can record collections. Neither role may view records outside its campground permissions.",
    ],
    audience: "operational",
    related: ["garbage.services", "garbage.tags"],
  },
  "garbage.tags": {
    id: "garbage.tags",
    slug: "paid-garbage-tags",
    title: "Paid Garbage Tags & Pickup Redemption",
    summary:
      "Record verified receipt evidence for serialized garbage tags, then redeem each tag once for a matching paid pickup.",
    details: [
      "Confirm the actual payment in the campground's POS or external payment service before issuing a tag. Enter the exact receipt reference; this screen does not charge cards, verify a payment provider or issue tax receipts.",
      "Each issued tag receives a unique GT-code suitable for printing as text or encoding in a barcode/QR label. Keep the code private until pickup.",
      "Optional reservation links require an active checked-in stay at the selected site. Redemption requires the same campground, waste stream, site and reservation as the pending paid on-demand pickup.",
      "A redeemed tag cannot be transferred, redeemed again on a different pickup or erased. A repeated submission for the same pickup returns the existing redemption.",
      "Tag redemption authorizes operational pickup, but does not change the separate checkout status of the original pickup or synthesize a payment-provider confirmation. Reconcile receipts with finance independently.",
    ],
    audience: "operational",
    related: ["garbage.services"],
  },
  "garbage.services": {
    id: "garbage.services",
    slug: "garbage-service-models",
    title: "Garbage, Recycling & Organics",
    summary:
      "Configure which waste streams and pickup methods are available at each campground, then dispatch and track site pickups.",
    details: [
      "Each stream can use central self-service bins, included site pickup, scheduled site pickup or paid on-demand pickup. Enable only methods actually offered at this campground.",
      "Scheduled pickup requires a weekday. Central-bin instructions should give a clear bin location. Paid on-demand fees are entered in Canadian cents.",
      "A pickup request snapshots the fee when created. A paid request is marked pending checkout; recording or completing service never means money was collected.",
      "Staff progress requests from requested to scheduled, in progress and completed; cancellation is available before completion. Completed or cancelled records cannot be reopened.",
      "Use the canonical booking, payment and maintenance systems for reservations, receipts and work orders. Waste service operations do not replace them.",
    ],
    audience: "operational",
  },
  "shell.overview": {
    id: "shell.overview",
    slug: "application-overview",
    title: "Using iCamp",
    summary:
      "iCamp groups campground work into role-specific workspaces while keeping one shared operating system behind them.",
    details: [
      "Choose the workspace that matches what you are trying to do.",
      "Use the information icon beside a section heading for quick guidance.",
      "Open the full help article when you need examples or more detail.",
    ],
    audience: "public",
  },
  "shell.workspaces": {
    id: "shell.workspaces",
    slug: "workspaces",
    title: "iCamp workspaces",
    summary:
      "Workspaces organize the same campground data into views for guests, front desk, maintenance, security, store, management, finance and I.T.",
    details: [
      "A workspace does not create a separate copy of campground data.",
      "Permissions will later determine which workspaces and records a user can access.",
      "New workspaces can be added without replacing the core application shell.",
    ],
    audience: "public",
  },
  "shell.channels": {
    id: "shell.channels",
    slug: "web-phone-text-channels",
    title: "Web, telephone and text access",
    summary:
      "iCamp is designed so suitable workflows can be used through Web/PWA, telephone keypad/voice and SMS.",
    details: [
      "Graphical tasks such as drawing a map remain visual.",
      "Telephone and SMS use guided equivalents or secure links when a visual step is required.",
      "All channels use the same authoritative business rules.",
    ],
    audience: "public",
  },
  "admin.refresh": {
    id: "admin.refresh",
    slug: "admin-data-refresh-and-freshness",
    title: "Admin data refresh and freshness",
    summary:
      "Refresh controls show when administrative information was rendered and whether a refresh is currently running.",
    details: [
      "Use Refresh data when you need the latest server-rendered information.",
      "Freshness metadata will later include the last successful/failed refresh and upstream source watermark.",
      "A refresh status is operational metadata; it does not duplicate sensitive client data.",
    ],
    audience: "public",
  },
  "it.analysis": {
    id: "it.analysis",
    slug: "it-analysis-and-system-health",
    title: "I.T. & Analysis",
    summary:
      "The I.T. workspace helps authorized operators understand system health, releases and troubleshooting references.",
    details: [
      "Detailed diagnostics remain protected until authentication and permissions are available.",
      "Public health information is deliberately limited.",
      "An external watchdog is required to detect a completely non-responsive application.",
      "Queue, media and communications health are shown only as sanitized aggregate operational signals.",
    ],
    audience: "public",
  },
  "auth.login": {
    id: "auth.login",
    slug: "sign-in-and-account-security",
    title: "Signing in securely",
    summary:
      "iCamp uses a server-managed session after your email and password are verified.",
    details: [
      "Your browser receives an opaque session cookie; the raw session token is not stored in the database.",
      "Repeated failed sign-in attempts can temporarily lock an account.",
      "Campground roles and permissions are separate from authentication and are applied in the authorization layer.",
    ],
    audience: "public",
  },
  "auth.register": {
    id: "auth.register",
    slug: "creating-a-guest-account",
    title: "Creating a guest account",
    summary:
      "Guest accounts use an email address plus a long password or passphrase.",
    details: [
      "Use at least 12 characters and avoid reusing a password from another service.",
      "iCamp deliberately avoids revealing whether an address was already registered.",
      "Staff accounts are not created through the public guest-registration page.",
    ],
    audience: "public",
  },
  "auth.recovery": {
    id: "auth.recovery",
    slug: "password-recovery",
    title: "Password recovery",
    summary:
      "Recovery tokens are single-use, expire quickly, and are stored only as hashes.",
    details: [
      "The recovery request response is identical whether or not the email address exists.",
      "Changing a password revokes the account's existing sessions.",
      "Recovery delivery remains behind a replaceable communications adapter.",
    ],
    audience: "public",
  },
  "auth.sessions": {
    id: "auth.sessions",
    slug: "sessions-and-account-access",
    title: "Sessions and account access",
    summary:
      "A signed-in browser uses an HTTP-only same-site session cookie with server-side revocation.",
    details: [
      "Signing out revokes the server session and clears the browser cookie.",
      "Management, finance, security and other privileged operations can later require stronger authentication.",
      "MFA readiness is built into the account model; enrollment workflows arrive in later security builds.",
    ],
    audience: "public",
  },
  "auth.authorization": {
    id: "auth.authorization",
    slug: "roles-permissions-and-campground-access",
    title: "Roles, permissions and campground access",
    summary:
      "Signing in identifies you; campground assignments and explicit permissions determine what operational areas and records you may use.",
    details: [
      "Staff access is deny-by-default until an active campground assignment and role grant the required permission.",
      "Role templates provide common starting points, while organization-specific custom roles can grant a smaller approved permission set.",
      "Database row-level security adds a second boundary so an assigned user cannot read or change another campground merely by changing a URL or request.",
    ],
    audience: "public",
  },
  "campground.map.coordinates": {
    id: "campground.map.coordinates",
    slug: "campground-map-coordinate-engine",
    title: "Campground map coordinate engine",
    summary:
      "The coordinate engine keeps map pixels, normalized coordinates, zoom, pan, overlays and pointer hit-testing aligned through one shared transform.",
    details: [
      "Future geometry stores original-image pixels plus normalized 0–1 coordinates so editing stays precise and drift can be detected.",
      "Zooming is anchored to the cursor or viewport centre, so the same source point stays under the chosen focal point.",
      "The same affine matrix is used for the image and overlay layers; hit-testing uses its inverse instead of separate scaling formulas.",
      "High-DPI rendering uses a device-pixel matrix derived from the CSS transform without changing source coordinates.",
      "Build 020 consumes this coordinate contract for polygon plotting; later map objects continue to use the same transform.",
    ],
    audience: "privileged",
  },
  "campground.map.polygons": {
    id: "campground.map.polygons",
    slug: "campground-map-polygon-plotter",
    title: "Campground map polygon plotter",
    summary:
      "Authorized managers can draw, validate, edit and save irregular polygons against the exact active overhead image version.",
    details: [
      "Choose New polygon, then click the image to add vertices in order around the shape; Build 021 keeps up to 50 geometry steps available for undo/redo during the current edit session.",
      "Close shape becomes available only when at least three vertices form a valid non-self-intersecting polygon.",
      "Select a vertex for precise movement or choose Whole polygon to move the entire shape. The precision step can be 0.25, 1, 5 or 10 source-image pixels and Snap aligns the current selection.",
      "Lock prevents geometry and label edits until explicitly unlocked. Hide suppresses normal map rendering without deleting data. Archive is recoverable and keeps the polygon available to management history.",
      "Duplicate creates a new active, visible and unlocked polygon while retaining provenance to the source polygon.",
      "Every saved vertex stores source-image pixels plus normalized 0–1 coordinates, and the polygon remains bound to the exact image version used for editing.",
      "Drawing and precision geometry are graphical-only. Telephone and SMS workflows use a secure visual handoff or staff-assisted fallback rather than pretending keypad geometry entry is equivalent.",
    ],
    audience: "privileged",
  },
  "campground.map.layers": {
    id: "campground.map.layers",
    slug: "campground-map-layers-labels-icons",
    title: "Campground map layers, labels and icons",
    summary:
      "Authorized staff see only map layers permitted by their campground role, while managers can configure persistent layer order, names, icons and visibility requirements.",
    details: [
      "Build 022 provides Booking, Maintenance, Security, Utilities, Amenities and Management layer families without prematurely binding polygons to canonical objects; that binding arrives in Build 023.",
      "Layer visibility is enforced on the server before layer or polygon data reaches the browser. The checkbox beside a visible layer only controls the current visual composition and cannot bypass authorization.",
      "A polygon has an administrative label plus a separate map-facing label. Its optional icon can override the layer icon, or it can inherit the layer icon.",
      "Layer order is persisted and controls overlay composition. Users with campground.configuration can move layers up or down and change the curated permission required to see a layer.",
      "Disabling a layer turns it off by default without deleting geometry or history.",
      "Layer composition is graphical-only. Telephone and SMS workflows use secure visual handoff or staff-assisted fallback instead of pretending keypad or text interaction is equivalent.",
    ],
    audience: "privileged",
  },
  "campground.map.objects": {
    id: "campground.map.objects",
    slug: "campground-map-object-binding",
    title: "Canonical campground map objects",
    summary:
      "Build 023 gives each mapped site, cottage or facility one stable canonical identity and allows exactly one polygon or point binding.",
    details: [
      "Create a canonical map identity with a short unique code and one of the supported kinds: site, cottage, permanent unit, pool, washroom, gate, dock, road, building or asset.",
      "Bind an unbound canonical object to one saved polygon, or move the pointer over the active overhead image and bind it as an exact point.",
      "A canonical object cannot be bound twice, and one polygon cannot represent two canonical objects. Database foreign keys also prevent bindings to missing or cross-campground records.",
      "Point geometry uses the Build 019 source-pixel plus normalized 0–1 coordinate contract. Polygon bindings inherit the polygon image version and layer at the database boundary.",
      "The inspector is permission filtered on the server using the bound layer's visibility permission. Unbound identities are visible only to users who can configure the campground.",
      "Builds 024–030 add accommodation, cottage, asset and status details to these identities rather than creating duplicate map identities.",
      "Map placement remains graphical-only for telephone and SMS. Non-visual channels can identify objects by code and use secure visual handoff or staff assistance for geometry.",
    ],
    audience: "privileged",
  },
  "asset.inventory": {
    id: "asset.inventory",
    slug: "operational-assets-equipment-and-fleet",
    title: "Operational assets, equipment and fleet",
    summary:
      "Build 029 keeps campground facilities, infrastructure, equipment and fleet in one map-aware canonical operations inventory.",
    details: [
      "Facilities include pools, water parks, washrooms, fields, playgrounds, halls, beaches, docks, launches, roads, parking, gates, buildings, garbage/septic areas, utilities and similar operational assets.",
      "Facility records require a Build 023 canonical map identity. iCamp can reuse an unclaimed compatible identity or create one automatically when the facility is registered.",
      "Equipment and fleet include tractors, mowers, maintenance vehicles, carts, trailers, power equipment and watercraft. Mobile equipment does not require a map position, but can use an asset map identity when useful.",
      "Equipment records support make, model, serial number, ownership, current meter kind/value and storage or home location.",
      "The current operating state and status revision are Build 029 integration hooks. Build 030 owns authoritative status history and transition rules.",
      "Public candidate marks publication readiness only. It never makes an operational record public, indexable or accessible without a later public publishing workflow.",
      "Authenticated Web/PWA is the full management channel. Voice/SMS can later identify assets by code, report concise status facts or route staff, while map placement stays graphical.",
    ],
    audience: "privileged",
  },
  "accommodation.inventory": {
    id: "accommodation.inventory",
    slug: "unified-accommodation-inventory",
    title: "Unified accommodation inventory",
    summary:
      "Build 024 gives campsites, rental cottages and permanent units one shared canonical parent while preserving subtype-specific expansion points.",
    details: [
      "Every accommodation has one code, name, campground section, optional subsection, lifecycle state and canonical Build 023 map identity.",
      "Campsites, rental cottages and permanent units each receive exactly one matching subtype linkage. Database deferred constraints reject missing, mismatched or duplicate subtype structures.",
      "Build 030 now turns the shared status revision into authoritative current state, PostgreSQL transition rules and durable history. Booking availability still arrives in later booking builds.",
      "Changing lifecycle state advances both hook revisions so later engines and caches can detect a shared-inventory change.",
      "Build 025 adds campsite types, utilities, dimensions and physical-fit detail; Build 026 adds cottage-specific facilities and occupancy; Build 028 adds public galleries.",
      "Accommodation administration requires accommodation.manage. Read-only inventory access uses accommodation.read.",
      "Telephone and SMS can reference accommodation codes in later workflows, but structural administration remains authenticated Web/PWA or staff-assisted.",
    ],
    audience: "privileged",
  },
  "campsite.services": {
    id: "campsite.services",
    slug: "campsite-types-utilities-and-fit",
    title: "Campsite types, utilities and physical fit",
    summary:
      "Build 025 records the physical campsite facts later booking and compatibility workflows can safely consume.",
    details: [
      "Classify a site as tent, RV or mixed, then use service level as a simple campground-facing summary while the individual utility fields remain authoritative.",
      "Electrical amperage supports none, 15A, 20A, 30A and 50A. Water, wastewater and Wi-Fi are recorded separately so a partially serviced site is not ambiguous.",
      "Use transient, seasonal, yearly or walk-up as the site's normal operating profile. Long-term assignment records themselves remain in Build 047.",
      "Store site dimensions and RV length, width and height limits only when known. Build 034 later applies these facts to reservation compatibility.",
      "Waterfront, pull-through, surface, shade, fire ring and picnic table describe physical characteristics; they do not replace later policy or pricing rules.",
      "Changing campsite fit or service detail advances the parent accommodation availability revision so later systems can detect the change.",
      "Configuration is an authenticated Web/PWA management task. Telephone and SMS can later read concise site facts or hand off to staff, but cannot edit structural campsite configuration.",
    ],
    audience: "privileged",
    related: ["accommodation.inventory"],
  },
  "cottage.facilities": {
    id: "cottage.facilities",
    slug: "rental-cottage-facilities-and-occupancy",
    title: "Rental cottage facilities and occupancy",
    summary:
      "Build 026 keeps each rental cottage's sleeping capacity, facilities, appliances, accessibility and view attached to the canonical accommodation record.",
    details: [
      "Classify the cottage as rustic or serviced, then record bedrooms, beds and maximum advertised sleeping occupancy as physical facts.",
      "Kitchen supports none, kitchenette or full kitchen. Washroom and shower are tracked independently as none, shared or private.",
      "Heating and cooling describe the installed cottage systems. Refrigerator, cooktop, oven and microwave are separate appliance facts rather than assumptions based on cottage style.",
      "Step-free access and accessible washroom are recorded independently so later compatibility and public-description workflows can make precise decisions.",
      "View describes the advertised physical setting and does not replace Build 028 gallery media.",
      "Any cottage detail change advances the parent accommodation availability revision so later capacity, compatibility and availability systems can detect the change.",
      "Build 033 later owns configurable guest-capacity rules and Build 034 owns booking compatibility. This build records the underlying physical facts only.",
      "Configuration is an authenticated Web/PWA management task. IVR/DTMF and SMS/MMS may later read concise cottage facts or hand off to staff, but structural edits remain in the authenticated interface.",
    ],
    audience: "privileged",
    related: ["accommodation.inventory"],
  },
  "cottage.housekeeping": {
    id: "cottage.housekeeping",
    slug: "cottage-turnover-housekeeping-readiness",
    title: "Cottage turnover and housekeeping readiness",
    summary:
      "Build 027 turns cottage departure cleaning into reusable templates, snapshotted inventory checks and auditable damage/security readiness evidence.",
    details: [
      "Create reusable turnover templates for normal departures, deep cleans, seasonal opening/closing or maintenance resets. Linen and housekeeping instructions stay with the template.",
      "Inventory checklist items are categorized and ordered. Starting a turnover snapshots the current checklist so later template edits cannot rewrite historical evidence.",
      "Each live turnover records item checks and item-level issues. The first check advances a scheduled turnover into active work.",
      "The readiness inspection records linen completion, housekeeping completion, inventory completion, damage and security issues. A clean complete inspection marks the turnover ready; unresolved work leaves it blocked.",
      "Turnover lifecycle changes advance the shared accommodation availability and status revision hooks so later engines can detect readiness changes.",
      "Build 030 owns the full accommodation status state machine and durable transition history. Build 034 remains authoritative for booking compatibility and reservation decisions.",
      "Web/PWA provides the full workflow. IVR/DTMF and SMS/MMS may later read concise readiness facts or route staff, but detailed checklist editing and inspection notes remain authenticated Web/PWA or staff-assisted.",
    ],
    audience: "privileged",
    related: ["cottage.facilities", "accommodation.inventory"],
  },

  "accommodation.gallery": {
    id: "accommodation.gallery",
    slug: "accommodation-public-gallery",
    title: "Public site and cottage gallery",
    summary:
      "Build 028 curates up to ten guest-facing campsite or cottage images without mixing public photography with internal operational evidence.",
    details: [
      "Each campsite or rental cottage may have at most ten active public gallery images. The first image becomes the hero automatically, and managers can choose a different hero later.",
      "Alternative text is required for every image. Captions are optional, and sort order controls the public sequence independently of upload time.",
      "Each gallery image keeps a validated source plus a smaller thumbnail and optimized WebP variant. The common variants are prepared before upload so the free development path does not depend on a paid image-transformation service.",
      "Gallery objects reuse the Build 008 public-media storage boundary. Internal maintenance, housekeeping, damage and security media remain separate and are never exposed by gallery membership.",
      "Build 038 later consumes the same curated records for the public campsite/cottage detail and booking experience instead of creating a second image library.",
      "Web/PWA provides the full visual workflow. IVR/DTMF can describe concise gallery facts or transfer to staff; SMS/MMS can use a secure visual handoff. Neither channel pretends image editing is non-visual.",
    ],
    audience: "privileged",
    related: ["accommodation.inventory", "cottage.facilities"],
  },

  "status.engine": {
    id: "status.engine",
    slug: "accommodation-asset-status-engine",
    title: "Accommodation and asset status engine",
    summary:
      "Build 030 keeps current accommodation and operational-asset state in one server-authoritative engine with validated transitions and durable history.",
    details: [
      "Accommodation states cover available, held, reserved, arriving, occupied, departing, inspection, maintenance, winterized and closed.",
      "Facility, equipment and fleet states cover unknown, operational, limited, inspection, maintenance, unavailable, seasonal, winterized and closed.",
      "PostgreSQL owns the allowed transition edges. The interface requests a change; it cannot bypass a transition that the database rejects.",
      "Every real state change advances the subject status revision and appends history with the actor, timestamp and optional operations reason. Accommodation state changes also advance the availability revision.",
      "Build 031 deliberately owns dated closures, bulk holds, section blocks and map-publication overrides; Build 030 does not pretend a current-state value is a scheduling system.",
      "Web/PWA is the full management surface. Later IVR/SMS workflows can read or request concise status changes through the same canonical server commands rather than creating channel-specific state.",
    ],
    audience: "privileged",
    related: ["accommodation.inventory", "asset.inventory"],
  },

  "campground.map.images": {
    id: "campground.map.images",
    slug: "campground-overhead-image-library",
    title: "Campground overhead image library",
    summary:
      "Authorized managers can upload sanitized overhead/drone/site-plan images, keep a version history, select the active editing image and deliberately publish a chosen version.",
    details: [
      "Use JPEG, PNG or WebP source images; animated imagery is intentionally rejected.",
      "Common EXIF/XMP/text metadata is removed before storage, while original pixel dimensions and a checksum are recorded for map-coordinate stability.",
      "Making a version active changes the image used for map editing; publishing is a separate audited privileged action.",
      "Build 018 stores image versions only. Polygon geometry, layers and public interactive map behavior arrive in later map builds.",
    ],
    audience: "privileged",
  },
  "campground.structure": {
    id: "campground.structure",
    slug: "campground-sections-and-subsections",
    title: "Campground sections and subsections",
    summary:
      "Authorized managers can organize a campground into ordered sections and subsections while keeping every change inside the selected property boundary.",
    details: [
      "Use sort order to control the stable administrative sequence instead of relying on names.",
      "Inactive records remain available for history but are clearly separated from active operating structure.",
      "Section operating settings are bounded administrative metadata and do not replace later booking, access-control or map rules.",
      "If another manager changes the same record first, refresh before saving again so their newer change is not overwritten.",
    ],
    audience: "privileged",
  },
  "vehicle.registration": {
    id: "vehicle.registration",
    slug: "road-vehicle-registration",
    title: "Road vehicle registration",
    summary:
      "Build 053 records formal campground road-vehicle plate, jurisdiction, owner/driver, host accommodation, validity and revocation evidence.",
    details: [
      "Saved guest vehicle descriptions from Build 048 may be linked for continuity, but formal plate and jurisdiction data stays in the registration record.",
      "A stay-linked registration must use the reservation's current host accommodation and remain inside the reservation date window.",
      "Registration status is active or revoked; an active record becomes effectively expired after its valid-until date without rewriting historical evidence.",
      "Build 054 now provides non-stay day/week passes, extra-vehicle fees and parking/access rule snapshots. Build 056/063 owns access credential issuance and lifecycle.",
      "Web/PWA provides the full desk. Verified IVR/DTMF and SMS/MMS use the existing vehicle.register canonical workflow with secure/staff handoff when protected visual review is required.",
    ],
    audience: "privileged",
  },

  "vehicle.passes": {
    id: "vehicle.passes",
    slug: "day-week-vehicle-passes-extra-vehicle-fees",
    title: "Day/week vehicle passes and extra-vehicle fees",
    summary:
      "Build 054 issues non-stay day/week road-vehicle passes and stay-linked extra-vehicle passes using canonical fees plus immutable parking/access rule snapshots.",
    details: [
      "Day and week fees, plus the extra-vehicle fee, are selected from the Build 040 canonical charge catalogue; leaving a fee unselected makes that pass type free.",
      "A paid pass remains pending until the provider-neutral payment flow reports capture. Raw card numbers, CVV values and other payment credentials are never stored in the vehicle-pass domain.",
      "Extra-vehicle passes attach only to active Build 053 stay registrations beyond the campground's configured included-vehicle count.",
      "Every issued pass snapshots its fee, currency, parking rule and access rule so later campground policy edits cannot rewrite historical evidence.",
      "Build 056 owns access credential issuance and Build 060 owns enforceable access zones and schedules; Build 054 records the human-readable rule in force when the pass was issued.",
      "Web/PWA provides the full desk. Verified IVR/DTMF uses staff/provider handoff for protected payment steps, while SMS/MMS uses a secure link; raw payment credentials are never requested through either custom channel.",
    ],
    audience: "privileged",
    related: ["vehicle.registration"],
  },

  "visitor.registration": {
    id: "visitor.registration",
    slug: "visitor-registration-site-specific-limits",
    title: "Visitor registration and site-specific limits",
    summary:
      "Build 055 registers reservation-hosted visitors, enforces the effective Build 033 site visitor limit, and preserves identity/contact, fee and visit-policy evidence.",
    details: [
      "Every visitor is linked to an active pending, confirmed or checked-in host reservation and its exact accommodation.",
      "The visitor maximum is resolved from the most specific matching Build 033 campground, accommodation-type, section or accommodation rule, including eligible campsite size bands.",
      "Overlapping open visitor registrations are serialized with a site advisory lock so simultaneous submissions cannot exceed the effective visitor limit.",
      "Day/week fees reuse the Build 040 canonical pass catalogue and the Build 042 provider-neutral payment adapter. Raw payment credentials are never stored in the visitor domain.",
      "Identity verification stores the configured method and completion evidence only. Build 055 does not store government-ID numbers or images.",
      "Build 056 owns access credentials, Build 062 owns wristband/QR/pass validation, Build 063 owns credential lifecycle at arrival/departure and Build 060 owns enforceable access zones/schedules.",
      "Web/PWA provides the full desk. IVR/DTMF uses verified staff/provider handoff for protected identity/payment steps; SMS/MMS uses secure links and never requests government-ID or payment credentials.",
    ],
    audience: "privileged",
  },

  "access.credentials": {
    id: "access.credentials",
    slug: "access-credential-abstraction",
    title: "Access credentials",
    summary:
      "Build 056 provides one provider-neutral credential record for key cards, fobs, keypad PINs, QR/printed passes, wristbands and external access-provider references.",
    details: [
      "Raw keypad PINs and QR payloads are never stored; digital credentials keep only a one-way fingerprint plus an optional masked display hint.",
      "Credential validity is independent from physical gate control: Build 057+ owns device mapping and Build 060 owns enforceable access zones and schedules.",
      "A credential may be scheduled, active, expired by time, or explicitly revoked. Revoked credentials cannot be silently reactivated.",
      "Provider integrations store bounded provider identifiers and credential references, never provider API secrets.",
      "Build 062 owns pass validation and Build 063 owns replacement, return and checkout lifecycle.",
    ],
    audience: "privileged",
    related: ["visitor.registration", "vehicle.registration"],
  },
  "access.device.registry": {
    id: "access.device.registry",
    slug: "access-device-registry",
    title: "Gate, barrier and access devices",
    summary:
      "Build 057 registers campground gates, doors, vehicle barriers, controllers, readers, keypads and related access hardware without binding iCamp to one vendor.",
    details: [
      "Use the registry for physical-device identity, location, controller topology, hardware details, provider mapping, capabilities and the latest health snapshot.",
      "Provider mappings store only provider/device identifiers. API tokens, passwords, controller secrets and raw access credentials do not belong in this registry.",
      "The zone reference in Build 057 is an administrative location label only. Build 060 owns enforceable access zones, schedules and subject rules.",
      "Build 058 owns open/closed observations plus access and device event history. Build 059 owns manual open/close commands and provider outcomes.",
      "Web/PWA is the full management surface; telephone and SMS use verified summaries, secure links or staff-assisted handoff instead of collecting hardware/provider configuration through unsafe text or keypad flows.",
    ],
    audience: "privileged",
    related: ["access.credentials"],
  },
  "access.events": {
    id: "access.events",
    slug: "access-device-event-ledger",
    title: "Access and device event monitoring",
    summary:
      "Build 058 keeps append-only evidence for gate/device observations and access attempts without turning monitoring into a control channel.",
    details: [
      "Open, closed and unknown gate-state observations are recorded as history and the latest state is derived from that history rather than overwriting prior evidence.",
      "Access attempts can link the Build 056 credential plus canonical guest, visitor, staff and road-vehicle records when known; unknown attempts remain representable without inventing identity.",
      "Denied access requires an explicit reason. Granted, error and unknown outcomes cannot carry a denial reason.",
      "Provider event references support duplicate-safe ingestion, while direct anonymous and authenticated Data API access remains denied.",
      "Build 059 owns manual open/close commands and command outcomes. Build 060 owns enforceable zones, schedules and access rules.",
    ],
    audience: "privileged",
    related: ["access.credentials", "access.device.registry"],
  },
  "security.access.dashboard": {
    id: "security.access.dashboard",
    slug: "security-access-operations-dashboard",
    title: "Security and access operations dashboard",
    summary:
      "Build 063 brings device state, credentials, denied access, overrides, expiring passes and recent security signals into one protected campground view.",
    details: [
      "The dashboard is read-only aggregation over the existing Build 056-062 access domains; it does not create a second authorization or device-control system.",
      "Gate/device state comes from the registry plus append-only device observations. Denied access and override outcomes remain their canonical ledger evidence.",
      "Active credentials and expiring passes never expose raw PINs, QR bearer tokens, fingerprints, provider credentials or controller secrets.",
      "Recent security signals are derived from device faults, denied access and unsuccessful overrides. They are not fabricated incident cases.",
      "Manual gate commands remain the separate high-risk Build 059 path with permission, reason, recent re-authentication, rate limiting and audit.",
      "Web/PWA is the full dashboard. IVR and SMS use verified concise summaries or secure/staff handoff for visual review.",
    ],
    audience: "privileged",
    related: [
      "access.device.registry",
      "access.events",
      "gate.override",
      "access.credential.lifecycle",
      "access.passes",
    ],
  },
  "access.credential.lifecycle": {
    id: "access.credential.lifecycle",
    slug: "credential-lifecycle-check-in-check-out",
    title: "Credential lifecycle at check-in and check-out",
    summary:
      "Build 062 keeps reservation access credentials aligned with arrival, stay dates, departure, cancellation and lost/replacement events.",
    details: [
      "Reservation credentials are provisioned only after canonical front-desk check-in and remain linked to the reservation and check-in evidence.",
      "Campground-local checkout time plus a bounded grace period determines stay-managed credential expiry.",
      "Checked-in stay extensions and shortenings automatically synchronize active managed credential validity and append lifecycle evidence.",
      "Checkout and cancellation revoke active managed reservation credentials in the same canonical workflow.",
      "Lost/replacement revokes the single lost credential, links the replacement assignment and never reuses the old credential secret.",
      "Raw QR/PIN bearer material remains one-time output only and is never stored or written to audit metadata.",
    ],
    audience: "privileged",
    related: ["access.passes"],
  },
  "access.passes": {
    id: "access.passes",
    slug: "passes-wristbands-qr-codes",
    title: "Passes, wristbands and QR codes",
    summary:
      "Build 061 issues and validates secure QR, printed and wristband bearer presentations over the canonical Build 056 access credential.",
    details: [
      "The raw bearer validation token is generated with secure randomness, returned only during first issuance and never stored in PostgreSQL or audit metadata.",
      "QR presentations use the versioned icamp-pass:v1 payload. Printed passes and wristbands use the same server validation contract without weakening token entropy.",
      "Visitor-linked passes require an active Build 055 registration, and vehicle-linked access presentations require an active Build 054 vehicle pass. Their validity must stay inside the source validity window.",
      "Event and day-use links remain bounded provider-neutral references until those later canonical domains arrive.",
      "Validation fails closed for unknown, early, expired, revoked or source-inactive passes. A valid pass still requires the Build 060 zone/schedule/rule decision before physical access.",
      "Web/PWA is the full issuance/revocation surface. IVR and SMS use verified staff, secure-link or visual handoff because bearer secrets and QR graphics must not be casually echoed.",
    ],
    audience: "privileged",
    related: ["access.rules", "visitor.registration", "vehicle.passes"],
  },
  "access.rules": {
    id: "access.rules",
    slug: "access-zones-schedules-rules",
    title: "Access zones, schedules and rules",
    summary:
      "Build 060 defines enforceable zone, time and subject access policy for guests, visitors, staff, contractors, campers and events.",
    details: [
      "Access policy fails closed: an inactive zone, unmet camper/event requirement or absence of a matching allow rule results in denial.",
      "Rules can target guest, visitor, staff, contractor, camper, event or any subject context and may require an active stay or a specific event reference.",
      "Reusable schedules support weekday restrictions, optional date windows, ordinary daytime windows and overnight windows in campground-local time.",
      "A device may belong to multiple enforceable zones. Every bound zone must allow access for the aggregate device decision to allow.",
      "Build 057 zone_reference remains a descriptive hardware location label; Build 060 access zones are the enforceable authorization model.",
      "Web/PWA is the full management surface. Telephone/SMS may provide verified summaries or secure handoff but do not bypass the canonical rule evaluator.",
    ],
    audience: "privileged",
    related: ["access.device.registry", "access.events", "gate.override"],
  },
  "gate.override": {
    id: "gate.override",
    slug: "manual-gate-open-close-override",
    title: "Manual gate open/close override",
    summary:
      "Build 059 provides a high-risk, auditable server command for authorized staff to manually open or close a capable access device.",
    details: [
      "Open and close use separate high-risk permissions and always require an explicit operational reason plus recent re-authentication.",
      "The target device must be active and declare the corresponding remote_open or remote_close capability before a request is accepted.",
      "Manual requests are rate limited to three accepted commands per actor/device in sixty seconds, and duplicate request IDs are not intentionally reissued.",
      "Every accepted request and normalized provider result is preserved as append-only evidence alongside the privileged audit trail.",
      "iCamp never bypasses fire/life-safety egress, physical emergency releases, legally required manual controls or hardware safety interlocks.",
      "Web/PWA is the full privileged surface. IVR/SMS must use strong staff verification and the same canonical server command, or hand off securely.",
    ],
    audience: "privileged",
    related: ["access.device.registry", "access.events"],
  },
  "camper.assistance.request": {
    id: "camper.assistance.request",
    slug: "camper-assistance-request",
    title: "Camper assistance requests",
    summary:
      "Build 077 creates a stay-linked campground assistance request with category, operational priority, contact preference and optional validated internal media.",
    details: [
      "Requests are accepted only for a checked-in reservation owned by the signed-in guest, and the server derives the campground and accommodation from that canonical stay.",
      "Choose maintenance, garbage, septic, electrical, water, Wi-Fi, noise, security, rental, store or other. Routine, soon and urgent describe campground response priority; urgent is not emergency dispatch.",
      "Optional images and PDFs reuse the Build 008 secure-media validator and internal storage boundary. A request can have up to five attachments.",
      "Build 077 records immutable intake evidence. Build 078 now tracks operational classification, assignment, escalation, guest-visible updates and closure without rewriting the original report.",
      "Web/PWA provides the full intake. Verified IVR/DTMF and SMS/MMS use the same canonical request command, with secure-link or staff-assisted handoff for visual evidence when needed.",
    ],
    audience: "public",
    related: ["customer.input"],
  },

  "camper.assistance.triage": {
    id: "camper.assistance.triage",
    slug: "camper-assistance-triage-management",
    title: "Assistance triage and escalation",
    summary:
      "Build 078 gives authorized campground staff one operational queue for reclassification, assignment, management escalation, guest-visible updates and outcome-based closure.",
    details: [
      "The camper's Build 077 category, priority, text and media remain immutable intake evidence. Operational reclassification is stored separately.",
      "Triage can change the operational category/priority and assign an active staff member at the same campground. Every change uses optimistic row-version checks and append-only event evidence.",
      "Management escalation is explicit and campground-scoped. An escalation may be acknowledged and resolved, but it never means emergency services were contacted.",
      "Guest communication records an in-app update or a staff contact record for email, SMS or phone. Build 078 does not claim provider delivery unless a later canonical provider workflow actually performs it.",
      "Closing requires assistance.close authority, a final outcome code and a guest-visible summary. Active management escalation must be resolved first.",
      "Web/PWA is the full visual console. Verified staff IVR/DTMF or SMS can use the same canonical commands only when the existing identity, authorization and input limits can safely represent the action.",
    ],
    audience: "privileged",
    related: ["camper.assistance.request", "shell.channels"],
  },

  "customer.input": {
    id: "customer.input",
    slug: "customer-input-guidance",
    title: "Customer input guidance",
    summary:
      "Customer-facing and staff-entered forms should explain what belongs in each section and why it is needed.",
    details: [
      "Enter only information relevant to the campground workflow.",
      "Sensitive information should never be requested merely because a form has space for it.",
      "Use section help for examples and common mistakes before submitting.",
    ],
    audience: "public",
  },
} as const satisfies Record<string, HelpTopic>;

export type HelpTopicId = keyof typeof helpTopics;

export function getHelpTopicById(id: string): HelpTopic | undefined {
  return helpTopics[id as HelpTopicId];
}

export function getHelpTopicBySlug(slug: string): HelpTopic | undefined {
  return Object.values(helpTopics).find((topic) => topic.slug === slug);
}
