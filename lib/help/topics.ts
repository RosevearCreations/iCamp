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
