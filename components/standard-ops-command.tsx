import Link from "next/link";

import { getSafeItSnapshot } from "@/lib/observability/health";
import { runSandboxLifecycleFixture } from "@/lib/tenant-subscription/sandbox-lifecycle.mjs";

type CommandArea = "management" | "it-analysis";

const managementLinks = [
  {
    label: "Operations Command",
    detail: "Live arrivals, site metrics and work queues",
    href: "/workspaces/management/command",
    icon: "✧",
  },
  {
    label: "Campground structure",
    detail: "Sections, operating rules and property settings",
    href: "/workspaces/management/campgrounds",
    icon: "▦",
  },
  {
    label: "Guest assistance",
    detail: "Staff triage, ownership and escalations",
    href: "/workspaces/management/campgrounds/assistance",
    icon: "✦",
  },
  {
    label: "Bookings & site map",
    detail: "View the real date-aware booking map",
    href: "/booking/map",
    icon: "▤",
  },
  {
    label: "Theme management",
    detail: "Standard: fresh meadow and evergreen",
    href: "/settings/themes",
    icon: "♧",
  },
];

const itLinks = [
  {
    label: "System status",
    detail: "Public-safe live check and deployment version",
    href: "/status",
    icon: "◉",
  },
  {
    label: "Subscriptions & evidence",
    detail: "Sandbox replay and legal review gates",
    href: "/launch/subscriptions",
    icon: "▣",
  },
  {
    label: "Comms Hub connections",
    detail: "Independent proof intake — no external GETs",
    href: "/integration/comms-hub",
    icon: "↔",
  },
  {
    label: "Launch checklist",
    detail: "Readiness receipts without activating services",
    href: "/launch/readiness",
    icon: "☑",
  },
];

export function StandardOpsCommand({ area }: { area: CommandArea }) {
  const isIt = area === "it-analysis";
  const health = getSafeItSnapshot();
  const sandbox = runSandboxLifecycleFixture();
  const links = isIt ? itLinks : managementLinks;
  const cards = isIt
    ? [
        {
          title: "Runtime configuration",
          value:
            health.readiness.configuration === "ok"
              ? "CHECK PASSED"
              : "CHECK FAILED",
          detail: `Environment: ${health.environment}`,
          tone: health.readiness.configuration === "ok" ? "good" : "hold",
          icon: "◈",
        },
        {
          title: "Billing activation",
          value: "OFF",
          detail: "Sandbox replay only · no charges",
          tone: "hold",
          icon: "▣",
        },
        {
          title: "Omnichannel gateway",
          value: "DISCONNECTED",
          detail: "Independent proof still required",
          tone: "hold",
          icon: "↔",
        },
        {
          title: "Build / release",
          value: health.releaseId,
          detail: `Application ${health.version}`,
          tone: "info",
          icon: "⌁",
        },
      ]
    : [
        {
          title: "Campground workspace",
          value: "ACCESS VERIFIED",
          detail: "Based on your current permission",
          tone: "good",
          icon: "♧",
        },
        {
          title: "Operating theme",
          value: "STANDARD",
          detail: "Meadow & evergreen · first theme",
          tone: "info",
          icon: "✦",
        },
        {
          title: "Monthly subscriptions",
          value: "HELD",
          detail: "No approved billing activation",
          tone: "hold",
          icon: "▣",
        },
        {
          title: "Guest communications",
          value: "TEST-ONLY HOLD",
          detail: "No outbound messages or calls",
          tone: "hold",
          icon: "↔",
        },
      ];

  return (
    <div className="standard-command" data-command-area={area}>
      <div className="standard-command__heading">
        <div>
          <p className="eyebrow">Build 164 · Standard command centre</p>
          <h2>
            {isIt
              ? "I.T. & system operations"
              : "Campground management overview"}
          </h2>
          <p>
            {isIt
              ? "Safe diagnostic snapshots, isolated billing test posture and connection evidence."
              : "Quick access to the real workspaces and the operating gates that protect each campground."}
          </p>
        </div>
        <span className="ops-pill">Live view · No fabricated metrics</span>
      </div>
      <div className="standard-command__metrics">
        {cards.map((card) => (
          <article
            className={`standard-command__metric standard-command__metric--${card.tone}`}
            key={card.title}
          >
            <span className="standard-command__metric-icon" aria-hidden="true">
              {card.icon}
            </span>
            <div>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="standard-command__body">
        <section
          className="content-panel ops-detail-card"
          aria-labelledby={`${area}-workspaces-heading`}
        >
          <h3 id={`${area}-workspaces-heading`}>
            {isIt ? "I.T. tools & diagnostics" : "Management workspaces"}
          </h3>
          <div className="standard-command__links">
            {links.map((link) => (
              <Link
                href={link.href}
                className="standard-command__link"
                key={link.href}
              >
                <span aria-hidden="true">{link.icon}</span>
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.detail}</small>
                </span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
          </div>
        </section>
        <section
          className="content-panel ops-detail-card"
          aria-labelledby={`${area}-posture-heading`}
        >
          <h3 id={`${area}-posture-heading`}>
            {isIt
              ? "Integration & billing test posture"
              : "Operating readiness"}
          </h3>
          <div className="ops-status-row">
            <span>Standard visual theme</span>
            <strong>Active</strong>
          </div>
          <div className="ops-status-row">
            <span>Subscriber agreement</span>
            <strong className="ops-text-hold">No live approval</strong>
          </div>
          <div className="ops-status-row">
            <span>Subscription lifecycle replay</span>
            <strong>{sandbox.fixture_events} simulated events</strong>
          </div>
          <div className="ops-status-row">
            <span>Last sandbox fixture result</span>
            <strong>{sandbox.subscription_state}</strong>
          </div>
          <div className="ops-status-row">
            <span>Real provider / external gateway</span>
            <strong className="ops-text-hold">OFF / HELD</strong>
          </div>
          {isIt ? (
            <p className="ops-inline-note">
              This is a server-rendered diagnostic view with local deterministic
              fixture evidence. A sandbox test passing does not grant permission
              to charge or connect tenants.
            </p>
          ) : (
            <p className="ops-inline-note">
              Use Management for campground settings, not platform-wide
              administrator access. Each linked workspace checks its own
              permissions.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
