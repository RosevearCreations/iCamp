import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerExportOversightReport } from "@/lib/permanent-unit-owner-retention/oversight-postgres.mjs";
import styles from "../../../../../../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner export exception & retention oversight · iCamp",
  robots: { index: false, follow: false },
};
const exceptionsPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions";
const pagePath = `${exceptionsPath}/oversight`;
const issueNames: Record<string, string> = {
  reconciliation_missing: "Reconciliation missing",
  digest_mismatch: "CSV digest/count mismatch",
  retention_missing: "Retention evidence missing",
  retention_overdue: "Retention deadline overdue",
};
const stages: Record<string, string> = {
  open: "Open",
  overdue: "Overdue owner action",
  escalated: "Escalated",
  returned: "Independent review returned",
  review_pending: "Awaiting independent review",
};
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export default async function OwnerExportOversightPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ days?: string; source?: string; target?: string }>;
}>) {
  const session = await requireStaff(pagePath);
  const params = await searchParams;
  let report;
  try {
    report = await getOwnerExportOversightReport(session.user.id, {
      days: params.days,
      source: params.source,
      target: params.target,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (/owner scope/i.test(error.message) ||
        /choose two different/i.test(error.message) ||
        /owner \/ administrator/i.test(error.message))
    )
      redirect("/auth/not-authorized");
    throw error;
  }
  const name = new Map(report.campgrounds.map((c) => [c.id, c.name]));
  const { summary, receipts } = report;
  const limited =
    report.campgroundsLimited || report.groupsLimited || report.casesLimited;
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={exceptionsPath}>Exception closeout</Link>
          <span>/</span>
          <span>Recurrence &amp; retention oversight</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 108 · Owner-only audit reporting</p>
          <h1>Export exception recurrence &amp; retention oversight</h1>
          <p className="hero-panel__lead">
            Read-only trends from actual export receipts, independent
            reconciliation, retention attestations and append-only exception
            audits. Compare authorized campground pairs and identify recurring
            issues that warrant manual owner follow-up.
          </p>
          <p>
            This is historical operational oversight, not a forecast, automated
            risk score or assurance that a downloaded file was deleted. No
            applicant or lending details are included.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="oversight-filters"
            title="Reporting scope"
            eyebrow="Revalidated private owner permissions"
            helpTopic="permanent.owner-export-oversight"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Window
              <select name="days" defaultValue={report.days}>
                {[30, 90, 180].map((days) => (
                  <option key={days} value={days}>
                    Previous {days} days
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source
              <select name="source" defaultValue={report.selectedSource ?? ""}>
                <option value="">All authorized pairs</option>
                {report.campgrounds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target
              <select name="target" defaultValue={report.selectedTarget ?? ""}>
                <option value="">All authorized pairs</option>
                {report.campgrounds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Refresh owner report
            </button>
          </form>
          <p>
            UTC reporting window: {date(report.start)} through{" "}
            {date(report.asOf)}. Choose both source and target for one directed
            pair, or leave both on “All authorized pairs”. A cross-organization
            pair is included only when your owner permission covers both
            campgrounds.
          </p>
          {limited ? (
            <p role="alert">
              Coverage warning:{" "}
              {report.campgroundsLimited
                ? "Only the first 50 authorized campgrounds are included. "
                : ""}
              {report.groupsLimited
                ? "The breakdown shows the first 100 groups. "
                : ""}
              {report.casesLimited
                ? "The open-case drilldown shows the first 50 cases. "
                : ""}
              Counts are complete only for the selected campground and time
              scope. Narrow filters before treating visible lists as exhaustive.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="oversight-summary"
            eyebrow="Cases first opened in this window"
            title="Exception lifecycle &amp; repeated findings"
            helpTopic="permanent.owner-export-oversight"
          />
          <ul>
            <li>
              {summary.casesOpened} cases opened across{" "}
              {summary.affectedReceipts} distinct receipts
            </li>
            <li>
              {summary.independentlyClosed} independently closed;{" "}
              {summary.notClosed} still without accepted closeout
            </li>
            <li>
              {summary.overdueActions} overdue actions; {summary.awaitingReview}{" "}
              awaiting independent review; {summary.returnedForFollowup}{" "}
              returned for follow-up; {summary.escalated} escalated
            </li>
            <li>
              {summary.receiptsReopened} receipts with multiple cases;{" "}
              {summary.repeatedPairIssueGroups} campground-pair/issue
              combinations with two or more cases
            </li>
          </ul>
          <p>
            “Repeated” means observed case recurrence within this selected
            reporting window. A previous closure does not erase an issue, and a
            recurrence count does not imply wrongdoing.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="oversight-retention"
            eyebrow="Export receipts accepted during this window"
            title="Current reconciliation &amp; copy-retention gaps"
            helpTopic="permanent.owner-export-oversight"
          />
          <ul>
            <li>{receipts.accepted} accepted export receipts</li>
            <li>
              {receipts.missingReconciliation} missing independent
              reconciliation; {receipts.mismatched} latest hash/count mismatches
            </li>
            <li>
              {receipts.missingRetention} matched but missing a retention
              attestation; {receipts.overdueRetention} latest retention
              deadlines expired
            </li>
            <li>
              {receipts.disposalAttested} receipts with a manual copy-disposal
              attestation
            </li>
          </ul>
          <p>
            These are current states of receipts accepted in the window; they
            may change as owners record later evidence. An attestation cannot
            verify that a downloaded local file was actually erased.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="oversight-weeks"
            eyebrow="Events recorded during the window"
            title="UTC weekly exception activity"
            helpTopic="permanent.owner-export-oversight"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Week of (UTC)</th>
                  <th>Opened</th>
                  <th>Accepted closeout</th>
                  <th>Returned</th>
                  <th>Escalations</th>
                </tr>
              </thead>
              <tbody>
                {report.weeks.map((week) => (
                  <tr key={week.week}>
                    <td>{week.week}</td>
                    <td>{week.casesOpened}</td>
                    <td>{week.accepted}</td>
                    <td>{week.returned}</td>
                    <td>{week.escalated}</td>
                  </tr>
                ))}
                {!report.weeks.length ? (
                  <tr>
                    <td colSpan={5}>
                      No recorded exception activity during this window.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p>
            Weekly accepted/returned reviews may refer to cases opened before
            the reporting window.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="oversight-pairs"
            eyebrow="Observed patterns, not inferred risk"
            title="Campground-pair issue breakdown"
            helpTopic="permanent.owner-export-oversight"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Source → target</th>
                  <th>Exception</th>
                  <th>Cases</th>
                  <th>Receipts</th>
                  <th>Closed</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.map((g) => (
                  <tr key={`${g.source}-${g.target}-${g.issueKind}`}>
                    <td>
                      <Link
                        href={`${exceptionsPath}?source=${g.source}&target=${g.target}`}
                      >
                        {name.get(g.source) ?? "Campground"} →{" "}
                        {name.get(g.target) ?? "Campground"}
                      </Link>
                    </td>
                    <td>{issueNames[g.issueKind] ?? g.issueKind}</td>
                    <td>{g.casesOpened}</td>
                    <td>{g.affectedReceipts}</td>
                    <td>{g.independentlyClosed}</td>
                    <td>{g.overdueActions}</td>
                  </tr>
                ))}
                {!report.groups.length ? (
                  <tr>
                    <td colSpan={6}>
                      No owner exception cases were opened during this window.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="oversight-followups"
            eyebrow="Bounded drilldown · action overdue first"
            title="Unclosed owner exception cases"
            helpTopic="permanent.owner-export-oversight"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Campground pair</th>
                  <th>Finding</th>
                  <th>State</th>
                  <th>Due (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {report.cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`${exceptionsPath}?source=${c.source}&target=${c.target}`}
                      >
                        {c.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      {name.get(c.source) ?? "Campground"} →{" "}
                      {name.get(c.target) ?? "Campground"}
                    </td>
                    <td>{issueNames[c.issueKind] ?? c.issueKind}</td>
                    <td>{stages[c.stage] ?? c.stage}</td>
                    <td>{date(c.dueAt)}</td>
                  </tr>
                ))}
                {!report.cases.length ? (
                  <tr>
                    <td colSpan={5}>
                      No unclosed cases were opened in this window.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p>
            Use the linked Build 107 ledger for individual receipt evidence,
            corrective owner action and independent review. This page cannot
            close cases or modify the original audit.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
