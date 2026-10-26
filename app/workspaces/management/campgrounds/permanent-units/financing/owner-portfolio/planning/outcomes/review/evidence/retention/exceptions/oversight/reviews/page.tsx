import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerOversightDecisionLedger } from "@/lib/permanent-unit-owner-retention/decisions-postgres.mjs";
import {
  createOwnerOversightReviewAction,
  appendOwnerOversightDecisionAction,
} from "./actions";
import styles from "../../../../../../../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner export oversight review decisions · iCamp",
  robots: { index: false, follow: false },
};
const oversightPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight";
const pagePath = `${oversightPath}/reviews`;
const labels: Record<string, string> = {
  all: "All exception kinds",
  reconciliation_missing: "Missing reconciliation",
  digest_mismatch: "Digest/count mismatch",
  retention_missing: "Missing retention controls",
  retention_overdue: "Overdue retention deadline",
  routine_context: "Routine context",
  monitor: "Monitor",
  followup_proposed: "Follow-up proposed",
  followup: "Follow-up",
  escalate: "Manual escalation",
  closed_no_action: "Final: no action needed",
};
function date(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
}
export default async function OwnerOversightReviewsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(pagePath);
  const params = await searchParams;
  if (!params.source || !params.target) redirect(oversightPath);
  let ledger;
  try {
    ledger = await getOwnerOversightDecisionLedger(
      session.user.id,
      params.source,
      params.target,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /owner|campground|scope|different/i.test(error.message)
    )
      redirect("/auth/not-authorized");
    throw error;
  }
  const name = new Map(ledger.campgrounds.map((c) => [c.id, c.name]));
  const closed = new Set(
    ledger.decisions
      .filter((d) => d.decisionKind === "closed_no_action")
      .map((d) => d.reviewId),
  );
  const available = ledger.reviews.filter((r) => !closed.has(r.id));
  const now = new Date(ledger.asOf).getTime();
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={oversightPath}>Owner export oversight</Link>
          <span>/</span>
          <span>Review notes &amp; decisions</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 109 · Private owner-only ledger</p>
          <h1>Owner oversight review notes &amp; follow-up decisions</h1>
          <p className="hero-panel__lead">
            {name.get(ledger.source) ?? "Source campground"} →{" "}
            {name.get(ledger.target) ?? "Target campground"}
          </p>
          <p>
            Snapshot real exception counts at the moment of owner
            interpretation, record evidence-linked decisions and review due
            dates. These append-only notes neither close the source exception
            cases nor erase exported files, change financing, transfer units or
            contact guests.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className="content-panel">
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className="content-panel">
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="owner-oversight-note"
            title="Record an owner interpretation"
            eyebrow="Database-frozen operational snapshot"
            helpTopic="permanent.owner-review-decisions"
          />
          <form
            action={createOwnerOversightReviewAction}
            className={styles.inlineForm}
          >
            <input
              type="hidden"
              name="sourceCampgroundId"
              value={ledger.source}
            />
            <input
              type="hidden"
              name="targetCampgroundId"
              value={ledger.target}
            />
            <label>
              UTC observation window
              <select name="windowDays" defaultValue="90">
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
              </select>
            </label>
            <label>
              Finding category
              <select name="issueKind" defaultValue="all">
                {[
                  "all",
                  "reconciliation_missing",
                  "digest_mismatch",
                  "retention_missing",
                  "retention_overdue",
                ].map((kind) => (
                  <option key={kind} value={kind}>
                    {labels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review context
              <select name="reviewKind" defaultValue="monitor">
                {["routine_context", "monitor", "followup_proposed"].map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {labels[kind]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Next review (UTC, within 90 days)
              <input required name="nextReviewAt" type="date" />
            </label>
            <label>
              Internal evidence reference
              <input
                required
                minLength={8}
                maxLength={400}
                name="evidenceReference"
                placeholder="Audit report or document reference"
              />
            </label>
            <label>
              Owner interpretation
              <textarea
                required
                minLength={12}
                maxLength={800}
                rows={3}
                name="reviewNote"
                placeholder="Interpret observed exceptions without personal or banking details"
              />
            </label>
            <button className="primary-button" type="submit">
              Save immutable review snapshot
            </button>
          </form>
          <p>
            Case totals, still-unclosed cases and recurring export receipts are
            independently calculated in the database at save time; forms cannot
            supply those counts.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-oversight-decision"
            title="Append a follow-up decision"
            eyebrow="Manual owner accountability · no automated side effects"
            helpTopic="permanent.owner-review-decisions"
          />
          <form
            action={appendOwnerOversightDecisionAction}
            className={styles.inlineForm}
          >
            <input
              type="hidden"
              name="sourceCampgroundId"
              value={ledger.source}
            />
            <input
              type="hidden"
              name="targetCampgroundId"
              value={ledger.target}
            />
            <label>
              Review snapshot
              <select required name="reviewId" defaultValue="">
                <option value="" disabled>
                  Choose a review
                </option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {date(r.reviewedAt)} · {labels[r.issueKind]} ·{" "}
                    {r.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner decision
              <select name="decisionKind" defaultValue="monitor">
                {["monitor", "followup", "escalate", "closed_no_action"].map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {labels[kind]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Source exception case (required for escalation)
              <select name="basisCaseId" defaultValue="">
                <option value="">No case cited</option>
                {ledger.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {labels[c.issueKind]} · {date(c.openedAt)} ·{" "}
                    {c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Next action due (UTC; leave empty only for final no-action)
              <input name="nextDueAt" type="date" />
            </label>
            <label>
              Decision evidence reference
              <input
                name="evidenceReference"
                required
                minLength={8}
                maxLength={400}
              />
            </label>
            <label>
              Reason and owner next step
              <textarea
                name="decisionNote"
                required
                minLength={12}
                maxLength={800}
                rows={3}
              />
            </label>
            <button
              className="primary-button"
              disabled={!available.length}
              type="submit"
            >
              Append decision to audit ledger
            </button>
          </form>
          <p>
            Escalation cites an actual case from the frozen review scope. A
            final no-action decision is terminal for that review; create a fresh
            review to revisit later. Pending decisions require a due date within
            90 days.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-oversight-history"
            title="Immutable observation history"
            eyebrow="Point-in-time notes and measured cases"
            helpTopic="permanent.owner-review-decisions"
          />
          {ledger.reviewsLimited ||
          ledger.decisionsLimited ||
          ledger.casesLimited ? (
            <p role="alert">
              Bounded history: first{" "}
              {ledger.reviewsLimited ? "50 reviews" : "reviews"},{" "}
              {ledger.decisionsLimited ? "150 decisions" : "decisions"} and{" "}
              {ledger.casesLimited ? "100 cases" : "cases"} shown; older entries
              may be omitted. Narrow your audit directly in the database before
              interpreting absence as completeness.
            </p>
          ) : null}
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Reviewed (UTC)</th>
                  <th>Scope &amp; context</th>
                  <th>Snapshot cases (open / recurring receipts)</th>
                  <th>Next review</th>
                  <th>Evidence &amp; owner note</th>
                </tr>
              </thead>
              <tbody>
                {ledger.reviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {date(r.reviewedAt)}
                      <p>{r.id.slice(0, 8)}</p>
                    </td>
                    <td>
                      {r.windowDays} days · {labels[r.issueKind]} ·{" "}
                      {labels[r.reviewKind]}
                    </td>
                    <td>
                      {r.casesObserved} ({r.openCasesObserved} /{" "}
                      {r.repeatReceiptsObserved})
                    </td>
                    <td>
                      {date(r.nextReviewAt)}
                      {new Date(r.nextReviewAt).getTime() < now
                        ? " · overdue"
                        : ""}
                    </td>
                    <td>
                      {r.evidenceReference}
                      <p>{r.reviewNote}</p>
                    </td>
                  </tr>
                ))}
                {!ledger.reviews.length ? (
                  <tr>
                    <td colSpan={5}>
                      No owner review snapshots have been recorded for this
                      pair.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-decision-history"
            title="Follow-up decision ledger"
            eyebrow="Newest entries first · source evidence preserved"
            helpTopic="permanent.owner-review-decisions"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Decided (UTC)</th>
                  <th>Review / source case</th>
                  <th>Decision</th>
                  <th>Due (UTC)</th>
                  <th>Evidence &amp; decision note</th>
                </tr>
              </thead>
              <tbody>
                {ledger.decisions.map((d) => (
                  <tr key={d.id}>
                    <td>{date(d.decidedAt)}</td>
                    <td>
                      {d.reviewId.slice(0, 8)} /{" "}
                      {d.basisCaseId?.slice(0, 8) ?? "—"}
                    </td>
                    <td>{labels[d.decisionKind]}</td>
                    <td>
                      {date(d.nextDueAt)}
                      {d.nextDueAt && new Date(d.nextDueAt).getTime() < now
                        ? " · overdue"
                        : ""}
                    </td>
                    <td>
                      {d.evidenceReference}
                      <p>{d.decisionNote}</p>
                    </td>
                  </tr>
                ))}
                {!ledger.decisions.length ? (
                  <tr>
                    <td colSpan={5}>
                      No owner follow-up decisions recorded for this campground
                      pair.
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
