import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CamperResolutionTimeline } from "@/components/camper-resolution-timeline";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listAssistanceQueue } from "@/lib/camper-assistance-triage/postgres.mjs";
import { buildCamperResolutionTimeline } from "@/lib/command-centre/resolution-timeline-core.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Camper Case Resolution Timeline · iCamp",
  description:
    "Tenant-scoped guest assistance milestones, escalation and closure evidence with no live messaging actions.",
};
const casePermissions = [
  "assistance.triage",
  "assistance.escalate",
  "assistance.communicate",
  "assistance.close",
  "campground.operations.manage",
];

export default async function ResolutionCommandPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/management/command/resolutions";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions = auth?.permissions ?? [];
        return permissions.includes("reports.read") &&
          casePermissions.some((key) => permissions.includes(key))
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const queue = await listAssistanceQueue(
    session.user.id,
    selected.campgroundId,
  ).catch(() => null);
  const timeline = queue ? buildCamperResolutionTimeline(queue.cases) : null;
  const base = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  return (
    <AppShell>
      <div className="page-stack camp-command">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Camper resolutions</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">
            Build 163 · Standard / Guest Service Evidence
          </p>
          <h1>Camper Resolution Timeline</h1>
          <p className="hero-panel__lead">
            Trace each camper request from intake through staff review,
            escalation and final outcome. Find unresolved and urgent cases
            without losing the original event history.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="primary-link"
              href={`/workspaces/management/command/assistance${base}`}
            >
              Assistance board ↗
            </Link>
            <Link
              className="secondary-link"
              href="/workspaces/management/command"
            >
              Management Command
            </Link>
          </div>
        </section>
        <section
          className="camp-command__scope"
          aria-label="Campground selection"
        >
          <form method="get" className="camp-command__scope-form">
            <label htmlFor="resolution-property">Campground</label>
            <select
              id="resolution-property"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {allowed.map((item) => (
                <option key={item.campgroundId} value={item.campgroundId}>
                  {item.campgroundName}
                </option>
              ))}
            </select>
            <button className="secondary-button" type="submit">
              Apply
            </button>
          </form>
          <span className="ops-pill">
            Read-only · Staff-authorized evidence
          </span>
        </section>
        {timeline ? (
          <>
            <div className="camp-command__kpis">
              {[
                {
                  label: "Unresolved cases",
                  value: timeline.unresolvedCount,
                  caption: "Requires follow-up",
                  tone: "amber",
                  icon: "◷",
                },
                {
                  label: "Urgent open cases",
                  value: timeline.urgentOpenCount,
                  caption: "Priority review",
                  tone: "amber",
                  icon: "!",
                },
                {
                  label: "Closed cases",
                  value: timeline.closedCount,
                  caption: "All case history",
                  tone: "green",
                  icon: "✓",
                },
                {
                  label: "Mean resolution hours",
                  value:
                    timeline.averageResolutionHours == null
                      ? "—"
                      : `${timeline.averageResolutionHours}h`,
                  caption: `${timeline.measuredClosures} timestamped closures`,
                  tone: "blue",
                  icon: "⌁",
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className={`camp-command__kpi camp-command__kpi--${item.tone}`}
                >
                  <span className="camp-command__kpi-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.caption}</small>
                  </div>
                </article>
              ))}
            </div>
            <CamperResolutionTimeline
              summary={timeline}
              campgroundId={selected.campgroundId}
            />
            <section className="content-panel ops-detail-card">
              <h2>Evidence and safety</h2>
              <p className="ops-inline-note">
                Average resolution time is calculated only for cases with valid
                submission and closure timestamps. A dash means no measurable
                closure evidence, not zero hours. The timeline displays the
                latest 60 matching cases while summary counts use the full
                authorized queue. Billing and Omnichannel remain HELD; no
                outbound communication is initiated here.
              </p>
            </section>
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Case history unavailable</h2>
            <p>
              We could not read this campground&apos;s assistance history. No
              open or resolved counts were invented.
            </p>
            <Link href={`/workspaces/management/command/assistance${base}`}>
              Open assistance command ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
