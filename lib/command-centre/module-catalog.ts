import type { CampgroundModule } from "@/components/management-module-finder";

const reservationPermissions = ["reservation.read", "reservation.create", "reservation.modify", "reservation.cancel"];
const maintenancePermissions = ["maintenance.read", "maintenance.create", "maintenance.assign", "maintenance.complete"];

export function modulesForPermissions(permissions: string[]): CampgroundModule[] {
  const allowed = (keys: string[]) =>
    keys.some((key) => permissions.includes(key));
  const modules: (CampgroundModule & { permission: string[] })[] = [
    {
      title: "Capacity & occupancy",
      subtitle: "14-day booking coverage and operable inventory trends",
      category: "Analytics",
      href: "/workspaces/management/command/capacity",
      icon: "▥",
      permission: ["reports.read", "reservation.read", "accommodation.read"],
    },
    {
      title: "Seasonal site utilization",
      subtitle: "Six months of booked and seasonal site-night trends",
      category: "Analytics",
      href: "/workspaces/management/command/seasonal",
      icon: "▤",
      permission: ["reports.read", "reservation.read", "accommodation.read"],
    },
    {
      title: "Accommodation segment comparisons",
      subtitle: "Campsite, cottage and permanent unit booking coverage",
      category: "Analytics",
      href: "/workspaces/management/command/segments",
      icon: "▥",
      permission: ["reports.read", "reservation.read", "accommodation.read"],
    },
    {
      title: "Seasonal capacity forecast variance",
      subtitle:
        "Month-to-date actuals against a three-month historical baseline",
      category: "Analytics",
      href: "/workspaces/management/command/forecast",
      icon: "▤",
      permission: ["reports.read", "reservation.read", "accommodation.read"],
    },
    {
      title: "Camper assistance board",
      subtitle: "Case stages, urgency and staff ownership",
      category: "Guest services",
      href: "/workspaces/management/command/assistance",
      icon: "◈",
      permission: [
        "reports.read",
        "assistance.triage",
        "assistance.escalate",
        "assistance.communicate",
        "assistance.close",
        "campground.operations.manage",
      ],
    },
    {
      title: "Camper resolution timeline",
      subtitle: "Case history, closure evidence and resolution times",
      category: "Guest services",
      href: "/workspaces/management/command/resolutions",
      icon: "◷",
      permission: [
        "reports.read",
        "assistance.triage",
        "assistance.escalate",
        "assistance.communicate",
        "assistance.close",
        "campground.operations.manage",
      ],
    },
    {
      title: "Camper escalation aging",
      subtitle: "24/72-hour attention, acknowledgment and follow-up",
      category: "Guest services",
      href: "/workspaces/management/command/escalations",
      icon: "◷",
      permission: [
        "reports.read",
        "assistance.triage",
        "assistance.escalate",
        "assistance.communicate",
        "assistance.close",
        "campground.operations.manage",
      ],
    },
    {
      title: "Standard theme owner review",
      subtitle: "Inspect screens, collect visual acceptance feedback",
      category: "Administration",
      href: "/settings/themes/acceptance",
      icon: "✧",
      permission: ["reports.read"],
    },
    {
      title: "Reservation desk",
      subtitle: "Booking edits, check-in flow and guest arrivals",
      category: "Bookings",
      href: "/workspaces/management/campgrounds/reservations",
      icon: "▣",
      permission: reservationPermissions,
    },
    {
      title: "Accommodation inventory",
      subtitle: "Site types, operating state and inventory",
      category: "Bookings",
      href: "/workspaces/management/campgrounds/accommodations",
      icon: "⌂",
      permission: ["accommodation.read", "accommodation.manage"],
    },
    {
      title: "Availability calendar",
      subtitle: "Open and closed dates by accommodation",
      category: "Bookings",
      href: "/workspaces/management/campgrounds/availability",
      icon: "▦",
      permission: [
        "reservation.read",
        "reservation.create",
        "reservation.modify",
        "accommodation.read",
        "campground.operations.manage",
      ],
    },
    {
      title: "Guest assistance",
      subtitle: "Case triage, staff ownership and escalation",
      category: "Guest services",
      href: "/workspaces/management/campgrounds/assistance",
      icon: "♧",
      permission: [
        "assistance.triage",
        "assistance.escalate",
        "assistance.communicate",
        "assistance.close",
        "campground.operations.manage",
      ],
    },
    {
      title: "Maintenance work orders",
      subtitle: "Open repairs, blockers and technician follow-up",
      category: "Property",
      href: "/workspaces/maintenance/work-orders",
      icon: "⚒",
      permission: maintenancePermissions,
    },
    {
      title: "Gate and security status",
      subtitle: "Access events, passes and gate health",
      category: "Property",
      href: "/workspaces/security/dashboard",
      icon: "⬡",
      permission: [
        "gate.state.read",
        "access.events.read",
        "access.credential.issue",
        "access.credential.revoke",
      ],
    },
    {
      title: "Campground settings",
      subtitle: "Property sections, policies and operations",
      category: "Administration",
      href: "/workspaces/management/campgrounds",
      icon: "⚙",
      permission: ["campground.configuration"],
    },
    {
      title: "Payment operations",
      subtitle: "Campground financial and payment records",
      category: "Administration",
      href: "/workspaces/management/campgrounds/payments",
      icon: "◇",
      permission: ["campground.configuration"],
    },
    {
      title: "Seasonal owner readiness",
      subtitle: "Renewal intentions, winter and spring evidence, owner follow-ups",
      category: "Property",
      href: "/workspaces/management/campgrounds/seasonal/owner-queue",
      icon: "❄",
      permission: ["seasonal.owner.read","seasonal.owner.record","seasonal.owner.review"],
    },
    {
      title: "Staff shifts and handoffs",
      subtitle: "Qualification, scheduling and staff handoff records",
      category: "Administration",
      href: "/workspaces/management/campgrounds/staff-shifts",
      icon: "◷",
      permission: ["staff.shift.self","schedule.manage","staff.manage"],
    },
    {
      title: "Vendor requests and SLAs",
      subtitle: "Vendor evidence, contract dates and follow-up",
      category: "Property",
      href: "/workspaces/management/campgrounds/vendors",
      icon: "⚒",
      permission: ["vendor.read","vendor.manage","vendor.invoice.review"],
    },
    {
      title: "Store stock and register",
      subtitle: "Reconciliation, inventory and unsettled POS records",
      category: "Administration",
      href: "/workspaces/management/campgrounds/store/operations",
      icon: "▤",
      permission: ["inventory.read","inventory.manage","inventory.audit"],
    },
    {
      title: "Accommodation and asset status",
      subtitle: "Source state history and property restrictions",
      category: "Property",
      href: "/workspaces/management/campgrounds/status",
      icon: "◈",
      permission: ["accommodation.read","accommodation.manage","asset.read","asset.manage","equipment.read","equipment.manage","campground.operations.manage"],
    },
    {
      title: "System status and readiness",
      subtitle: "Application health readback and service status",
      category: "Administration",
      href: "/status",
      icon: "◎",
      permission: ["reports.read"],
    },
  ];
  return modules
    .filter((module) => {
      if (module.href === "/workspaces/security/dashboard") {
        return (
          permissions.includes("gate.state.read") &&
          permissions.includes("access.events.read") &&
          allowed(["access.credential.issue", "access.credential.revoke"])
        );
      }
      if (
        [
          "/workspaces/management/command/capacity",
          "/workspaces/management/command/seasonal",
          "/workspaces/management/command/segments",
          "/workspaces/management/command/forecast",
        ].includes(module.href)
      ) {
        return ["reports.read", "reservation.read", "accommodation.read"].every(
          (key) => permissions.includes(key),
        );
      }
      if (
        [
          "/workspaces/management/command/assistance",
          "/workspaces/management/command/resolutions",
          "/workspaces/management/command/escalations",
        ].includes(module.href)
      ) {
        return (
          permissions.includes("reports.read") &&
          allowed([
            "assistance.triage",
            "assistance.escalate",
            "assistance.communicate",
            "assistance.close",
            "campground.operations.manage",
          ])
        );
      }
      return allowed(module.permission);
    })
    .map(({ title, subtitle, category, icon, href }) => ({
      title,
      subtitle,
      category,
      icon,
      href,
    }));
}

