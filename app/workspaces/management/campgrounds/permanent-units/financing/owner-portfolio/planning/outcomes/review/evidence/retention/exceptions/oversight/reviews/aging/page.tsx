import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerDecisionAgingReport } from "@/lib/permanent-unit-owner-retention/aging-postgres.mjs";
import { reassessOwnerDecisionAction } from "./actions";
import styles from "@/app/workspaces/management/campgrounds/reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner export follow-up aging & independent reassessment · iCamp",
  robots: { index: false, follow: false },
};
const reviewsPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews";
const pagePath = `${reviewsPath}/aging`;
const names: Record<string, string> = {
  all: "All decision stages",
  overdue: "Overdue action",
  due_week: "Due within 7 days",
  due_month: "Due within 30 days",
  later: "Due later",
  closure_recommended: "Closure recommendation only",
  closed_no_action: "Build 109 final no-action",
  continue_monitoring: "Continue monitoring",
  evidence_needed: "Further evidence needed",
  escalation_recommended: "Recommend manual escalation",
  reconciliation_missing: "Missing reconciliation",
  digest_mismatch: "Digest/count mismatch",
  retention_missing: "Missing retention evidence",
  retention_overdue: "Overdue retention deadline",
};
const fmt = (raw: string | null) =>
  raw
    ? new Date(raw).toLocaleDateString("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export default async function OwnerDecisionAgingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    source?: string;
    target?: string;
    stage?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(pagePath);
  const params = await searchParams;
  if (!params.source || !params.target) redirect(`${reviewsPath}`);
  let report;
  try {
    report = await getOwnerDecisionAgingReport(
      session.user.id,
      params.source,
      params.target,
      { filter: params.stage },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /owner|campground|scope|different/i.test(error.message)
    )
      redirect("/auth/not-authorized");
    throw error;
  }
  const camp = new Map(report.campgrounds.map((c) => [c.id, c.name]));
  const latestEligible = report.items.filter(
    (d) =>
      d.decisionKind !== "closed_no_action" &&
      d.decidedByUserId !== session.user.id,
  );
  const summary = report.summary;
  return (
    <AppShell>
      <div className="page-stack">
        <p>
          <Link
            href={`${pagePath}/outcomes?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Build 111 — owner follow-up outcomes &amp; independent acceptance
          </Link>
        </p>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link
            href={`${reviewsPath}?source=${report.source}&target=${report.target}`}
          >
            Owner decision ledger
          </Link>
          <span>/</span>
          <span>Follow-up aging &amp; reassessment</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 110 · Independent owner follow-up audit
          </p>
          <h1>Owner export follow-up aging &amp; decision reassessment</h1>
          <p className="hero-panel__lead">
            {camp.get(report.source) ?? "Source campground"} →{" "}
            {camp.get(report.target) ?? "Target campground"}
          </p>
          <p>
            Review the latest pending decision for each original owner review.
            Aging includes historic decisions without a time cutoff. Independent
            reassessments retain the old deadline and record an evidence-backed
            new due date or closure recommendation; neither action closes Build
            107 cases.
          </p>
          <p>
            No guest notifications, applicant records, financing authorizations,
            ownership transfers or downloaded-file deletions result from this
            page.
          </p>
        </section>
        {params.saved ? (
          <p className="content-panel" role="status">
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p className="content-panel" role="alert">
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="aging-summary"
            title="Current decision-aging position"
            eyebrow="Complete counts for this authorized directed pair"
            helpTopic="permanent.owner-followup-aging"
          />
          <ul>
            <li>
              {summary.decisions} latest owner decisions across their original
              review records; {summary.independentlyReassessed} independently
              reassessed
            </li>
            <li>
              {summary.overdue} currently overdue, including{" "}
              {summary.overdueOver30} overdue by more than 30 days
            </li>
            <li>
              {summary.dueWeek} due in the next seven days, {summary.dueMonth}{" "}
              due in days 8–30, {summary.later} due later
            </li>
            <li>
              {summary.closureRecommended} closure recommendations pending owner
              judgment; {summary.closedNoAction} original terminal no-action
              decisions
            </li>
          </ul>
          <p>
            These totals use the latest Build 109 decision per review and most
            recent independent reassessment as of {fmt(report.asOf)} UTC.
            “Closure recommended” is advisory: it does not mark any case or
            owner decision closed.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="aging-filter"
            title="Review the outstanding owner queue"
            eyebrow="Aging and due dates reflect preserved audit history"
            helpTopic="permanent.owner-followup-aging"
          />
          <form method="get" className={styles.inlineForm}>
            <input type="hidden" name="source" value={report.source} />
            <input type="hidden" name="target" value={report.target} />
            <label>
              Decision stage
              <select name="stage" defaultValue={report.filter}>
                {[
                  "all",
                  "overdue",
                  "due_week",
                  "due_month",
                  "later",
                  "closure_recommended",
                  "closed_no_action",
                ].map((stage) => (
                  <option key={stage} value={stage}>
                    {names[stage]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Apply aging filter
            </button>
          </form>
          {report.itemsLimited ||
          report.historyLimited ||
          report.casesLimited ||
          report.campgroundsLimited ? (
            <p role="alert">
              Coverage warning: the queue shows at most 100 entries, independent
              reassessment history 150 and case choices 100. Authorized
              campgrounds beyond the first 50 are excluded. Counts cover all
              matching decisions, but visible rows may be incomplete.
            </p>
          ) : null}
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Review / decision</th>
                  <th>Issue</th>
                  <th>Age</th>
                  <th>Decision stage</th>
                  <th>Original due</th>
                  <th>Current due</th>
                  <th>Latest independent review</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.reviewId.slice(0, 8)} / {d.id.slice(0, 8)}
                    </td>
                    <td>{names[d.issueKind] ?? d.issueKind}</td>
                    <td>
                      {d.ageDays} days
                      {d.stage === "overdue"
                        ? ` · ${d.overdueDays} overdue`
                        : ""}
                    </td>
                    <td>{names[d.stage] ?? d.stage}</td>
                    <td>{fmt(d.originalDueAt)}</td>
                    <td>{fmt(d.effectiveDueAt)}</td>
                    <td>
                      {d.reassessmentId ? (
                        <>
                          {names[d.assessmentKind ?? ""] ?? d.assessmentKind} ·{" "}
                          {fmt(d.latestReassessedAt)}
                          <p>
                            {d.observedUnclosedCases} unclosed cases /{" "}
                            {d.newCasesSinceReview} newly opened
                          </p>
                        </>
                      ) : (
                        "Not independently reassessed"
                      )}
                    </td>
                  </tr>
                ))}
                {!report.items.length ? (
                  <tr>
                    <td colSpan={7}>
                      No owner decisions match this stage for the authorized
                      directed pair.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="independent-reassessment"
            title="Record an independent reassessment"
            eyebrow="Original decision-maker cannot reassess their own entry"
            helpTopic="permanent.owner-followup-aging"
          />
          <form
            action={reassessOwnerDecisionAction}
            className={styles.inlineForm}
          >
            <input
              type="hidden"
              name="sourceCampgroundId"
              value={report.source}
            />
            <input
              type="hidden"
              name="targetCampgroundId"
              value={report.target}
            />
            <label>
              Latest review/decision (choose independently)
              <select name="decisionId" defaultValue="" required>
                <option value="" disabled>
                  Choose a pending decision
                </option>
                {latestEligible.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.reviewId.slice(0, 8)} / {d.id.slice(0, 8)} ·{" "}
                    {names[d.stage]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Independent reassessment
              <select name="assessmentKind" defaultValue="continue_monitoring">
                {[
                  "continue_monitoring",
                  "evidence_needed",
                  "escalation_recommended",
                  "closure_recommended",
                ].map((kind) => (
                  <option key={kind} value={kind}>
                    {names[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source exception case (required for escalation recommendation)
              <select name="basisCaseId" defaultValue="">
                <option value="">No source exception cited</option>
                {report.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {names[c.issueKind]} · {fmt(c.openedAt)} ·{" "}
                    {c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Next action due (UTC; leave empty only for closure recommendation)
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Internal evidence reference
              <input
                required
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                placeholder="Independent internal case/evidence reference"
              />
            </label>
            <label>
              Independent review findings and next step
              <textarea
                required
                name="reassessmentNote"
                minLength={12}
                maxLength={800}
                rows={3}
                placeholder="Explain supporting evidence, remaining gap or manual review need"
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={!latestEligible.length}
            >
              Append independent reassessment
            </button>
          </form>
          <p>
            The original review is derived from the selected decision in the
            database, so you cannot accidentally assign the reassessment to a
            different review. Stale pairs, self-review, invalid dates and
            unsupported closure recommendations are rejected. A closure
            recommendation requires no unresolved or newly opened source cases
            in the scoped audit period; it does not itself close anything.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="reassessment-history"
            title="Immutable independent reassessment history"
            eyebrow="Evidence snapshots and due dates are preserved"
            helpTopic="permanent.owner-followup-aging"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Recorded (UTC)</th>
                  <th>Decision/case</th>
                  <th>Assessment</th>
                  <th>Cases still open / new</th>
                  <th>Due</th>
                  <th>Evidence &amp; rationale</th>
                </tr>
              </thead>
              <tbody>
                {report.reassessments.map((r) => (
                  <tr key={r.id}>
                    <td>{fmt(r.reassessedAt)}</td>
                    <td>
                      {r.decisionId.slice(0, 8)} /{" "}
                      {r.basisCaseId?.slice(0, 8) ?? "—"}
                    </td>
                    <td>{names[r.assessmentKind]}</td>
                    <td>
                      {r.observedUnclosedCases} / {r.newCasesSinceReview}
                    </td>
                    <td>{fmt(r.nextDueAt)}</td>
                    <td>
                      {r.evidenceReference}
                      <p>{r.reassessmentNote}</p>
                    </td>
                  </tr>
                ))}
                {!report.reassessments.length ? (
                  <tr>
                    <td colSpan={6}>
                      No independent reassessments recorded for this pair.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
