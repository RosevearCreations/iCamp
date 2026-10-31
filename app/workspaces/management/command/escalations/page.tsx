import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CamperEscalationAgingBoard } from "@/components/camper-escalation-aging-board";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listAssistanceQueue } from "@/lib/camper-assistance-triage/postgres.mjs";
import { summarizeEscalationAging } from "@/lib/command-centre/escalation-aging-core.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Camper Escalation Aging · iCamp",
  description:
    "Authorized source-linked camper escalation age, ownership and triage attention bands.",
};
const casePermissions = [
  "assistance.triage",
  "assistance.escalate",
  "assistance.communicate",
  "assistance.close",
  "campground.operations.manage",
];

export default async function EscalationAgingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/management/command/escalations";
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
        const permissions = auth?.permissions ?? [];
        return permissions.includes("reports.read") &&
          casePermissions.some((key) => permissions.includes(key))
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const base = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  const queue = await listAssistanceQueue(
    session.user.id,
    selected.campgroundId,
  ).catch(() => null);
  const summary = queue ? summarizeEscalationAging(queue.cases) : null;
  return (
    <AppShell>
      <div className="page-stack camp-command camp-aging-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Escalation aging</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 164 · Standard / Camper Care</p>
          <h1>Camper Escalation Aging</h1>
          <p className="hero-panel__lead">
            See the unresolved camper escalations that need attention, who owns
            them, and how long each has been waiting—without altering the source
            record.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="primary-link"
              href={`/workspaces/management/command/resolutions${base}`}
            >
              Camper resolution history ↗
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
            <label htmlFor="aging-campground">Campground</label>
            <select
              id="aging-campground"
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
          <span className="ops-pill">Read-only · Source event timestamps</span>
        </section>
        {summary ? (
          <>
            <div className="camp-command__kpis">
              {[
                {
                  label: "Active escalations",
                  value: summary.activeCount,
                  detail: "Open or acknowledged",
                  tone: "blue",
                  icon: "◈",
                },
                {
                  label: "Awaiting acknowledgment",
                  value: summary.awaitingAcknowledgement,
                  detail: "Not yet acknowledged",
                  tone: "amber",
                  icon: "◷",
                },
                {
                  label: "24+ hours",
                  value: summary.over24Hours,
                  detail: "Attention band, not SLA",
                  tone: "amber",
                  icon: "⌁",
                },
                {
                  label: "72+ hours",
                  value: summary.over72Hours,
                  detail: "Oldest unresolved cases",
                  tone: "green",
                  icon: "!",
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
                    <small>{item.detail}</small>
                  </div>
                </article>
              ))}
            </div>
            <CamperEscalationAgingBoard
              summary={summary}
              campgroundId={selected.campgroundId}
            />
            <section className="content-panel ops-detail-card">
              <h2>Source completeness</h2>
              <p className="ops-inline-note">
                {summary.unknownAge} active escalation(s) have unknown age;{" "}
                {summary.multipleActive} case(s) have multiple active records.
                Neither is silently counted as zero hours. Escalation age is
                time since raised, regardless of acknowledgment. Billing and
                Omnichannel remain HELD.
              </p>
            </section>
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Escalation history unavailable</h2>
            <p>
              The authorized case history could not be retrieved. No totals or
              aging values were invented.
            </p>
            <Link href={`/workspaces/management/command/resolutions${base}`}>
              Open camper history ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
