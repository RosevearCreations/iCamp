import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerFinanceReport } from "@/lib/permanent-unit-owner-report/postgres.mjs";
import { latestByReceipt } from "@/lib/permanent-unit-owner-retention/core.mjs";
import {
  activeExportException,
  exceptionCorrectionReady,
} from "@/lib/permanent-unit-owner-retention/exceptions-core.mjs";
import { getOwnerExportExceptionLedger } from "@/lib/permanent-unit-owner-retention/exceptions-postgres.mjs";
import {
  openExportExceptionAction,
  recordExportExceptionOutcomeAction,
  reviewExportExceptionAction,
} from "./actions";
import styles from "../../../../../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner export retention exception audit · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions";
const retentionPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention";
const displayDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "—";
const labels: Record<string, string> = {
  reconciliation_missing: "CSV export is awaiting independent reconciliation",
  digest_mismatch: "The latest digest or data-row verification mismatched",
  retention_missing:
    "Reconciled export has no controlled-copy retention attestation",
  retention_overdue: "Controlled-copy retention deadline has expired",
};
const hiddenFields = (source: string, target: string) => (
  <>
    <input type="hidden" name="sourceCampgroundId" value={source} />
    <input type="hidden" name="targetCampgroundId" value={target} />
  </>
);

export default async function OwnerExportExceptionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(path);
  const params = await searchParams;
  const portfolio = await getOwnerFinanceReport(session.user.id, 30);
  const camps = portfolio.campgrounds;
  const ids = camps.map((c) => c.campgroundId);
  const source = params.source ?? camps[0]?.campgroundId ?? "";
  const target =
    params.target ??
    camps.find((c) => c.campgroundId !== source)?.campgroundId ??
    "";
  if ((source && !ids.includes(source)) || (target && !ids.includes(target)))
    redirect("/auth/not-authorized");
  const validPair = Boolean(source && target && source !== target);
  const ledger = await getOwnerExportExceptionLedger(
    session.user.id,
    validPair ? source : null,
    validPair ? target : null,
  );
  const recon = latestByReceipt(ledger.reconciliations, "reconciledAt");
  const retention = latestByReceipt(ledger.events, "recordedAt");
  const cases = latestByReceipt(ledger.cases, "openedAt");
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={retentionPath}>Export retention</Link>
          <span>/</span>
          <span>Exception follow-up &amp; closeout</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 107 · Owner evidence integrity</p>
          <h1>Export retention exception follow-up</h1>
          <p className="hero-panel__lead">
            Track missing or mismatched CSV reconciliation and missing or
            overdue copy-retention decisions across an independently authorized
            campground pair. Owners document corrective follow-up; a separate
            owner must review current source evidence before final audit
            closeout.
          </p>
          <p>
            Closeout is an internal audit decision only. It never deletes
            downloaded files or original receipts, changes financing or
            transfers, releases holds, or contacts applicants.
          </p>
          <p>
            <Link href={`${path}/oversight`}>
              Open Build 108 recurrence trends, overdue actions and retention
              oversight across authorized campground pairs
            </Link>
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
            id="export-exception-pair"
            eyebrow="Owner-only audit scope"
            title="Choose campground pair"
            helpTopic="permanent.owner-exception-closeout"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Source campground
              <select name="source" defaultValue={source}>
                {camps.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target campground
              <select name="target" defaultValue={target}>
                {camps.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Review exceptions
            </button>
          </form>
          {!validPair ? (
            <p role="alert">
              Choose two different campground assignments where you hold Owner /
              Administrator finance permission.
            </p>
          ) : null}
          {portfolio.limited ||
          ledger.receiptsLimited ||
          ledger.historyLimited ||
          ledger.casesLimited ||
          ledger.exceptionHistoryLimited ? (
            <p role="alert">
              Only bounded owner evidence is displayed. Incomplete history must
              not be interpreted as an absence of older exceptions, outcomes or
              reviews.
            </p>
          ) : null}
          <p>
            To correct a source condition, first use{" "}
            <Link href={`${retentionPath}?source=${source}&target=${target}`}>
              Build 106 receipt reconciliation and retention controls
            </Link>
            . Return here to record the owner follow-up outcome and request
            review.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="export-exception-cases"
            eyebrow="Append-only owner audit"
            title="Cases, follow-up outcomes &amp; independent acceptance"
            helpTopic="permanent.owner-exception-closeout"
          />
          {!ledger.receipts.length ? (
            <p>No owner export receipts are visible for this pair.</p>
          ) : null}
          {ledger.receipts.map((receipt) => {
            const r = recon.get(receipt.id),
              e = retention.get(receipt.id);
            const issue = activeExportException(r, e);
            const entry = cases.get(receipt.id);
            const outcome = ledger.outcomes.find((o) => o.caseId === entry?.id);
            const review = ledger.reviews.find((v) => v.caseId === entry?.id);
            const closed = review?.reviewKind === "accepted";
            const activeCase = entry && !closed;
            const pendingReview =
              activeCase &&
              outcome?.actionKind === "review_ready" &&
              (!review || review.outcomeId !== outcome.id);
            const canReview =
              pendingReview &&
              session.user.id !== outcome.recordedByUserId &&
              session.user.id !== entry.openedByUserId;
            const correctionReady = entry
              ? exceptionCorrectionReady(entry.issueKind, r, e)
              : false;
            const mayRecordOutcome = activeCase && !pendingReview;
            return (
              <article className="content-panel" key={receipt.id}>
                <h3>
                  Export {receipt.id.slice(0, 8)} ·{" "}
                  {displayDate(receipt.acceptedAt)}
                </h3>
                <p>
                  <strong>Current source condition:</strong>{" "}
                  {issue
                    ? labels[issue]
                    : "No active reconciliation/retention exception"}{" "}
                  · {receipt.exportRowCount} accepted CSV data rows
                </p>
                {entry ? (
                  <>
                    <p>
                      <strong>Case {entry.id.slice(0, 8)}:</strong>{" "}
                      {labels[entry.issueKind]} · Opened{" "}
                      {displayDate(entry.openedAt)} · Next action{" "}
                      {displayDate(entry.actionDueAt)} ·{" "}
                      {closed ? "Independently accepted and closed" : "Open"}
                    </p>
                    <p>
                      Original evidence: {entry.evidenceReference} ·{" "}
                      {entry.issueNote}
                    </p>
                    {outcome ? (
                      <p>
                        Latest follow-up: {outcome.actionKind} ·{" "}
                        {displayDate(outcome.recordedAt)} · {outcome.actionNote}
                      </p>
                    ) : null}
                    {review ? (
                      <p>
                        Latest independent review: {review.reviewKind} ·{" "}
                        {displayDate(review.reviewedAt)} · {review.reviewNote}
                      </p>
                    ) : null}
                    {activeCase &&
                    new Date(outcome?.nextDueAt ?? entry.actionDueAt) <
                      new Date() &&
                    !pendingReview ? (
                      <p role="alert">
                        The owner follow-up deadline has passed. Escalate or
                        record a new evidence-based outcome; no automatic
                        closure occurs.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {issue && !activeCase ? (
                  <form
                    action={openExportExceptionAction}
                    className={styles.formGrid}
                  >
                    {hiddenFields(source, target)}
                    <input
                      type="hidden"
                      name="exportAcceptanceId"
                      value={receipt.id}
                    />
                    <input type="hidden" name="issueKind" value={issue} />
                    <p>
                      Open a case for: <strong>{labels[issue]}</strong>
                    </p>
                    <label>
                      Next owner action due (UTC)
                      <input name="actionDueAt" type="date" required />
                    </label>
                    <label>
                      Internal exception evidence reference
                      <input
                        name="evidenceReference"
                        required
                        minLength={8}
                        maxLength={400}
                      />
                    </label>
                    <label>
                      Exception assessment
                      <textarea
                        name="issueNote"
                        required
                        minLength={12}
                        maxLength={800}
                        placeholder="Describe the control gap without guest or financial identifiers"
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Open owner follow-up case
                    </button>
                  </form>
                ) : null}
                {mayRecordOutcome ? (
                  <form
                    action={recordExportExceptionOutcomeAction}
                    className={styles.formGrid}
                  >
                    {hiddenFields(source, target)}
                    <input type="hidden" name="caseId" value={entry.id} />
                    <p>
                      {correctionReady
                        ? "Corrective source evidence is present. You may request an independent closeout review."
                        : "The source exception still requires a corrective reconciliation or retention record before review-ready status is allowed."}
                    </p>
                    <label>
                      Owner follow-up outcome
                      <select name="actionKind" defaultValue="followup_needed">
                        <option value="followup_needed">
                          Further owner follow-up needed
                        </option>
                        <option value="escalated">
                          Escalate for owner review
                        </option>
                        {correctionReady ? (
                          <option value="review_ready">
                            Corrections verified; ready for independent review
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <label>
                      Next owner action due UTC (blank only for review ready)
                      <input type="date" name="nextDueAt" />
                    </label>
                    <label>
                      Corrective evidence reference
                      <input
                        name="evidenceReference"
                        required
                        minLength={8}
                        maxLength={400}
                      />
                    </label>
                    <label>
                      Owner follow-up assessment
                      <textarea
                        name="actionNote"
                        required
                        minLength={12}
                        maxLength={800}
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Record owner follow-up outcome
                    </button>
                  </form>
                ) : null}
                {canReview ? (
                  <form
                    action={reviewExportExceptionAction}
                    className={styles.formGrid}
                  >
                    {hiddenFields(source, target)}
                    <input type="hidden" name="caseId" value={entry.id} />
                    <input type="hidden" name="outcomeId" value={outcome.id} />
                    <p>
                      You did not open this case or author the review-ready
                      outcome. Review the latest Build 106 source evidence
                      independently before deciding.
                    </p>
                    <label>
                      Independent audit determination
                      <select name="reviewKind" defaultValue="needs_followup">
                        <option value="needs_followup">
                          Return for further documented follow-up
                        </option>
                        {correctionReady ? (
                          <option value="accepted">
                            Accept closeout with current source evidence
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <label>
                      Independent review evidence reference
                      <input
                        name="evidenceReference"
                        required
                        minLength={8}
                        maxLength={400}
                      />
                    </label>
                    <label>
                      Independent review note
                      <textarea
                        name="reviewNote"
                        required
                        minLength={12}
                        maxLength={800}
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Record independent review
                    </button>
                  </form>
                ) : null}
                {pendingReview && !canReview ? (
                  <p>
                    A different authorized owner must review this outcome. The
                    case opener and outcome author cannot independently accept
                    their own closeout.
                  </p>
                ) : null}
                <p>
                  Audit history:{" "}
                  {
                    ledger.cases.filter(
                      (c) => c.exportAcceptanceId === receipt.id,
                    ).length
                  }{" "}
                  cases ·{" "}
                  {
                    ledger.outcomes.filter(
                      (o) => o.exportAcceptanceId === receipt.id,
                    ).length
                  }{" "}
                  outcomes ·{" "}
                  {
                    ledger.reviews.filter(
                      (v) => v.exportAcceptanceId === receipt.id,
                    ).length
                  }{" "}
                  reviews. All entries remain immutable.
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
