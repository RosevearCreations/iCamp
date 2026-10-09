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
      "Choose New polygon, then click the image to add vertices in order around the shape.",
      "Close shape becomes available only when at least three vertices form a valid non-self-intersecting polygon.",
      "In edit mode, select and drag a vertex to move it; Add vertex inserts a midpoint after the selected vertex and Delete vertex removes it while preserving at least three vertices.",
      "Every saved vertex stores source-image pixels plus normalized 0–1 coordinates, and the polygon remains bound to the exact image version used for editing.",
      "Drawing is graphical-only. Telephone and SMS workflows use a secure visual handoff or staff-assisted fallback rather than pretending keypad geometry entry is equivalent.",
    ],
    audience: "privileged",
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
