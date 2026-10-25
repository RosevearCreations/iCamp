import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import { getOwnerFinanceReport } from "@/lib/permanent-unit-owner-report/postgres.mjs";
import {
  aggregateWeeklyActivity,
  normalizeWindow,
  summarizeOwnerPortfolio,
} from "@/lib/permanent-unit-owner-report/core.mjs";
import styles from "../../../reservations/reservations.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cross-campground finance operations · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio";
const terms: Record<number, string> = {
  7: "7 days",
  30: "30 days",
  90: "90 days",
};
export default async function OwnerPortfolioPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ days?: string; organization?: string }>;
}>) {
  const session = await requireStaff(path),
    params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const owner = await Promise.all(
    assigned
      .filter((c) => c.roleCodes.includes("owner_admin"))
      .map(async (c) =>
        hasCampgroundPermission(
          session.user.id,
          c.campgroundId,
          "permanent_unit.transfer",
        ),
      ),
  );
  if (!owner.some(Boolean)) redirect("/auth/not-authorized");
  const report = await getOwnerFinanceReport(
    session.user.id,
    normalizeWindow(params.days),
  );
  const organizations = [
    ...new Set(report.campgrounds.map((c) => c.organizationId)),
  ];
  const organization = organizations.includes(params.organization ?? "")
    ? (params.organization ?? "")
    : "all";
  const campgrounds = report.campgrounds.filter(
    (c) => organization === "all" || c.organizationId === organization,
  );
  const totals = summarizeOwnerPortfolio(campgrounds);
  const weeks = report.campgrounds[0]?.weeks.map((w) => w.week) ?? [];
  const weekly = aggregateWeeklyActivity(campgrounds, weeks);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/portfolio">
            Property finance portfolio
          </Link>
          <span>/</span>
          <span>Owner overview</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 101 · Owner-only operational reporting
          </p>
          <h1>Cross-campground finance follow-up</h1>
          <p className="hero-panel__lead">
            A portfolio overview across only the campgrounds where you hold an
            active Owner / Administrator assignment and finance-operations
            permission.
          </p>
          <p>
            <strong>Operational activity, not applicant credit risk.</strong>{" "}
            Figures count workflow events and follow-up tasks, not customer
            scores, financing eligibility, statutory compliance, revenue, or
            lending performance. This screen makes no changes to finance or
            consent records.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-portfolio-scope"
            eyebrow="Private access boundary"
            title="Owner report filters"
            helpTopic="permanent.owner-report"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Activity window
              <select name="days" defaultValue={report.days}>
                {[7, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    {terms[d]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Organization
              <select name="organization" defaultValue={organization}>
                <option value="all">All my authorized organizations</option>
                {organizations.map((o) => (
                  <option key={o} value={o}>
                    Organization {o.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Refresh report
            </button>
          </form>
          <p>
            Snapshot:{" "}
            {new Date(report.generatedAt).toLocaleString("en-CA", {
              timeZone: "UTC",
            })}{" "}
            UTC · Activity in the past {report.days} days · {campgrounds.length}{" "}
            authorized campgrounds selected.
          </p>
          {report.limited ? (
            <p role="alert">
              More than 50 properties are assigned. This report includes only
              the first 50 authorized campgrounds; do not treat totals as
              complete across all assignments.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-portfolio-totals"
            eyebrow="Risk-neutral activity"
            title="Portfolio summary"
            helpTopic="permanent.owner-report"
          />
          <div className={styles.formGrid}>
            <p>
              <strong>Current exception holds:</strong> {totals.currentHolds}
            </p>
            <p>
              <strong>Open owner tasks:</strong> {totals.openTasks}
            </p>
            <p>
              <strong>Overdue owner tasks:</strong> {totals.overdueTasks}
            </p>
            <p>
              <strong>Consents with repeated hold reasons:</strong>{" "}
              {totals.recurrentConsents}
            </p>
            <p>
              <strong>New delivery consents:</strong> {totals.newConsents}
            </p>
            <p>
              <strong>Hold events recorded:</strong> {totals.newHolds}
            </p>
            <p>
              <strong>Hold clear events:</strong> {totals.clearedHolds}
            </p>
            <p>
              <strong>Owner tasks created:</strong> {totals.createdTasks}
            </p>
            <p>
              <strong>Administrative tasks closed:</strong> {totals.closedTasks}
            </p>
            <p>
              <strong>Recurrence reviews logged:</strong>{" "}
              {totals.recurrenceReviews}
            </p>
          </div>
          <p>
            Current holds and outstanding tasks are independent statuses. A
            completed administrative task does not release a delivery exception
            hold.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-portfolio-trends"
            eyebrow="Last 12 UTC weeks"
            title="Event volume by week"
            helpTopic="permanent.owner-report"
          />
          <p>
            This trend always spans the last 12 UTC calendar weeks, including
            the current partial week. It is separate from the activity-window
            selector above. These are counts of recorded events, not rates or
            rankings.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Week starting (UTC)</th>
                  <th scope="col">Consents</th>
                  <th scope="col">Hold events</th>
                  <th scope="col">Clear events</th>
                  <th scope="col">Tasks created</th>
                  <th scope="col">Tasks closed</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr key={w.week}>
                    <th scope="row">{w.week}</th>
                    <td>{w.consents}</td>
                    <td>{w.holds}</td>
                    <td>{w.clears}</td>
                    <td>{w.createdTasks}</td>
                    <td>{w.closedTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-portfolio-properties"
            eyebrow="Only active owner assignments"
            title="Campground operating snapshots"
            helpTopic="permanent.owner-report"
          />
          {campgrounds.length === 0 ? (
            <p>No eligible campgrounds match this organization filter.</p>
          ) : null}
          {campgrounds.map((c) => (
            <article key={c.campgroundId} className="content-panel">
              <h3>{c.name}</h3>
              <p>
                <strong>Current holds:</strong> {c.currentHolds} ·{" "}
                <strong>Owner tasks open:</strong> {c.openTasks} ·{" "}
                <strong>Past due:</strong> {c.overdueTasks} ·{" "}
                <strong>Recurring consent patterns:</strong>{" "}
                {c.recurrentConsents}
              </p>
              <p>
                Past {report.days} days: {c.newConsents} consent(s) ·{" "}
                {c.newHolds} hold event(s) · {c.clearedHolds} clear event(s) ·{" "}
                {c.createdTasks} owner task(s) opened · {c.closedTasks}{" "}
                administrative task(s) closed.
              </p>
              <p>
                <Link
                  href={`/workspaces/management/campgrounds/permanent-units/financing/portfolio?campground=${encodeURIComponent(c.campgroundId)}`}
                >
                  Open this campground&apos;s private finance portfolio
                </Link>
              </p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
