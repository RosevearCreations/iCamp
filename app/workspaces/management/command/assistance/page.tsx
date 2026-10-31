import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CamperAssistanceBoard } from "@/components/camper-assistance-board";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listAssistanceQueue } from "@/lib/camper-assistance-triage/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Camper Assistance Command · iCamp",
  description:
    "Real case status board, source-linked actions, and campground-specific support escalation.",
};
const casePermissions = [
  "assistance.triage",
  "assistance.escalate",
  "assistance.communicate",
  "assistance.close",
  "campground.operations.manage",
];

export default async function AssistanceCommandPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/management/command/assistance";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return auth?.permissions.includes("reports.read") &&
          casePermissions.some((key) => auth.permissions.includes(key))
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const result = await listAssistanceQueue(
    session.user.id,
    selected.campgroundId,
  )
    .then((queue) => ({ queue, failed: false as const }))
    .catch(() => ({ queue: null, failed: true as const }));
  const cases = result.queue?.cases ?? [];
  const open = cases.filter((item) => item.caseState !== "closed");
  const kpis = [
    {
      label: "Open assistance cases",
      value: open.length,
      icon: "◈",
      tone: "blue",
    },
    {
      label: "Urgent open",
      value: open.filter((item) => item.severity === "urgent").length,
      icon: "!",
      tone: "amber",
    },
    {
      label: "Escalated",
      value: open.filter((item) => item.caseState === "escalated").length,
      icon: "↗",
      tone: "amber",
    },
    {
      label: "Unassigned open",
      value: open.filter((item) => !item.assignedToUserId).length,
      icon: "♧",
      tone: "green",
    },
  ];
  return (
    <AppShell>
      <div className="page-stack camp-command">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Camper Assistance</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 162 · Standard / Guest Experience</p>
          <h1>Camper Assistance Command</h1>
          <p className="hero-panel__lead">
            See every case stage, ownership gap and urgent camper need in one
            glance, with all real actions preserved in the existing triage desk.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="secondary-link"
              href={`/workspaces/management/command/resolutions?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Case resolution timeline ↗
            </Link>
            <Link
              className="primary-link"
              href={`/workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Open action desk ↗
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
            <label htmlFor="assistance-command-property">Campground</label>
            <select
              id="assistance-command-property"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {authorized.map((item) => (
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
            No automatic messaging · Scoped to {selected.campgroundName}
          </span>
        </section>
        {result.queue ? (
          <>
            <div className="camp-command__kpis">
              {kpis.map((item) => (
                <article
                  className={`camp-command__kpi camp-command__kpi--${item.tone}`}
                  key={item.label}
                >
                  <span className="camp-command__kpi-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>Authorized campground case records</small>
                  </div>
                  <span className="camp-command__spark" aria-hidden="true" />
                </article>
              ))}
            </div>
            <CamperAssistanceBoard
              campgroundId={selected.campgroundId}
              cases={cases.map((item) => ({
                id: item.id,
                summary: item.summary,
                caseState: item.caseState,
                category: item.category,
                severity: item.severity,
                accommodationCode: item.accommodationCode,
                submittedAt: item.submittedAt,
                assignedToLabel: item.assignedToLabel,
                activeEscalationLevel: item.activeEscalationLevel,
                mediaCount: item.mediaCount,
              }))}
            />
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Assistance queue unavailable</h2>
            <p>
              We could not safely retrieve this campground&apos;s cases. No
              status totals were substituted with invented numbers.
            </p>
            <Link href="/workspaces/management/command">
              Return to Management Command ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
