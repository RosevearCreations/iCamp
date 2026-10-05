import { defineChannelSupport, type ChannelSupport } from "@/lib/channels";
import type { Permission } from "@/lib/authz/permissions";

export interface WorkspaceDefinition {
  slug: string;
  title: string;
  shortTitle: string;
  audience: string;
  summary: string;
  channelSupport: Readonly<ChannelSupport>;
  requiredPermission?: Permission;
}

const operationalChannels = defineChannelSupport({
  web: "full",
  ivr: "guided",
  sms: "guided",
  fallback: "staff-transfer",
});

const staffChannels = defineChannelSupport({
  web: "full",
  ivr: "guided",
  sms: "guided",
  fallback: "staff-transfer",
  note: "Privileged telephone and text actions will require stronger authentication.",
});

export const workspaces: readonly WorkspaceDefinition[] = [
  {
    slug: "public",
    title: "Public & Visitor",
    shortTitle: "Public",
    audience: "Campers, visitors and prospective guests",
    summary:
      "Discover the campground, accommodation, amenities, events and local interests before or during a visit.",
    channelSupport: operationalChannels,
  },
  {
    slug: "guest",
    title: "Guest & My Stay",
    shortTitle: "My Stay",
    audience: "Booked and checked-in guests",
    summary:
      "Manage an active stay, services, visitors, vehicles, assistance, activities and receipts.",
    channelSupport: operationalChannels,
  },
  {
    slug: "front-desk",
    title: "Front Desk & Reservations",
    shortTitle: "Front Desk",
    audience: "Reservation and check-in staff",
    summary:
      "Handle reservations, arrivals, departures, passes, guest records and campground office workflows.",
    channelSupport: staffChannels,
    requiredPermission: "reservation.read",
  },
  {
    slug: "maintenance",
    title: "Maintenance & Housekeeping",
    shortTitle: "Maintenance",
    audience: "Maintenance, housekeeping and grounds teams",
    summary:
      "Run work orders, inspections, recurring upkeep, site turnover and facility maintenance.",
    channelSupport: staffChannels,
    requiredPermission: "maintenance.read",
  },
  {
    slug: "security",
    title: "Security & Access",
    shortTitle: "Security",
    audience: "Security, front gate and authorized management",
    summary:
      "Monitor access, credentials, vehicles, visitors, gates and security incidents.",
    channelSupport: staffChannels,
    requiredPermission: "gate.state.read",
  },
  {
    slug: "store",
    title: "Store & POS",
    shortTitle: "Store / POS",
    audience: "Store, retail and fulfillment staff",
    summary:
      "Operate retail sales, campsite delivery, pickup, service products and inventory workflows.",
    channelSupport: staffChannels,
    requiredPermission: "inventory.read",
  },
  {
    slug: "staff",
    title: "Staff",
    shortTitle: "Staff",
    audience: "Campground employees and contractors",
    summary:
      "See schedules, assignments, notices, training and role-appropriate operational information.",
    channelSupport: staffChannels,
    requiredPermission: "staff.read",
  },
  {
    slug: "foreman",
    title: "Foreman & Supervisor",
    shortTitle: "Foreman",
    audience: "Foremen, supervisors and operational leads",
    summary:
      "Triage work, coordinate teams, approve inspections and escalate operational issues.",
    channelSupport: staffChannels,
    requiredPermission: "maintenance.assign",
  },
  {
    slug: "management",
    title: "Management & Administration",
    shortTitle: "Management",
    audience: "Managers, administrators and owners",
    summary:
      "Control campground configuration, operations, access, pricing, staffing, vendors and reporting.",
    channelSupport: staffChannels,
    requiredPermission: "reports.read",
  },
  {
    slug: "it-analysis",
    title: "I.T. & Analysis",
    shortTitle: "I.T. / Analysis",
    audience: "Authorized I.T., system administration and support staff",
    summary:
      "Review system health, releases, safe diagnostics, integration status and troubleshooting references without exposing client-sensitive information.",
    channelSupport: defineChannelSupport({
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
      fallback: "secure-link",
      note: "Detailed diagnostics require future authenticated I.T. permissions.",
    }),
    requiredPermission: "it.health.read",
  },
  {
    slug: "finance",
    title: "Finance & Accounting",
    shortTitle: "Finance",
    audience: "Authorized accounting and management staff",
    summary:
      "Review payments, expenses, reconciliation, profitability and accounting integrations.",
    channelSupport: defineChannelSupport({
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
      fallback: "secure-link",
      note: "Sensitive financial work defaults to an authenticated visual workflow.",
    }),
    requiredPermission: "finance.read",
  },
] as const;

export function getWorkspace(slug: string): WorkspaceDefinition | undefined {
  return workspaces.find((workspace) => workspace.slug === slug);
}
