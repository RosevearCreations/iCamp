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
