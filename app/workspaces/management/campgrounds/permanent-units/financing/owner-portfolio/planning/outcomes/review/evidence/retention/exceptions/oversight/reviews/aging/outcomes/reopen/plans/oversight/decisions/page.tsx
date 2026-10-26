import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getRecurrenceLedger } from "@/lib/permanent-unit-owner-retention/recurrence-postgres.mjs";
import {
  recordRecurrenceReviewAction,
  recordRecurrenceDecisionAction,
  recordRecurrenceReassessmentAction,
  recordEvidenceGapAction,
  recordExceptionRecurrenceAction,
  recordIndependentClosureAction,
  recordClosureOwnerDecisionAction,
  recordIndependentClosureFollowupAction,
  recordOwnerIndependentHandoffAction,
} from "./actions";
const previous =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hold recurrence independent owner decision ledger · iCamp",
  robots: { index: false, follow: false },
};
export default async function RecurrenceDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const session = await requireStaff(`${previous}/decisions`),
    params = await searchParams;
  if (!params.source || !params.target) redirect(previous);
  let report;
  try {
    report = await getRecurrenceLedger(
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
  const pair = (
    <>
      <input type="hidden" name="sourceCampgroundId" value={params.source} />
      <input type="hidden" name="targetCampgroundId" value={params.target} />
    </>
  );
  return (
    <AppShell>
      <main className="page-stack">
        <p>
          <Link
            href={`${previous}?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Back to recurrence oversight
          </Link>
        </p>
        <h1>Hold recurrence owner review &amp; independent follow-up ledger</h1>
        <p>
          Private owner records. Recurrence counts are captured by the database;
          an independent owner then decides the follow-up. Nothing here changes
          source cases, approvals, payments or customer records.
        </p>
        {params.saved && <p role="status">{params.saved}</p>}
        {params.error && <p role="alert">{params.error}</p>}
        {report.limited && (
          <p role="status">
            Display limited to 100 accepted records and 150 review/decision
            events. Full history is preserved.
          </p>
        )}
        <section>
          <h2>Record owner recurrence review</h2>
          <form action={recordRecurrenceReviewAction}>
            {pair}
            <label>
              Original acceptance{" "}
              <select name="acceptanceId" required>
                {report.acceptances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Review rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.acceptances.length}>
              Record immutable review
            </button>
          </form>
        </section>
        <section>
          <h2>Independent follow-up decision</h2>
          <form action={recordRecurrenceDecisionAction}>
            {pair}
            <label>
              Owner review{" "}
              <select name="recurrenceReviewId" required>
                {report.reviews.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.observed_plan_count} plans,{" "}
                    {r.observed_continued_holds} holds
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision{" "}
              <select name="decisionKind">
                <option value="continue_monitoring">Continue monitoring</option>
                <option value="request_evidence">Request more evidence</option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="independent_no_action">
                  No further action (if clear)
                </option>
              </select>
            </label>
            <label>
              Next review date (UTC; leave empty for no action){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent rationale{" "}
              <textarea
                name="decisionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.reviews.length}>
              Record independent decision
            </button>
          </form>
        </section>
        <section>
          <h2>Follow-up aging &amp; independent reassessment</h2>
          <p>
            Past-due decisions are marked for review; they do not automatically
            release a hold. A separate owner who neither authored the original
            review nor made its decision must assess the evidence.
          </p>
          <ul>
            {report.decisions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.followup_status} ·{" "}
                {d.next_due_at
                  ? new Date(d.next_due_at).toISOString().slice(0, 10)
                  : "no follow-up due"}
              </li>
            ))}
          </ul>
          <form action={recordRecurrenceReassessmentAction}>
            {pair}
            <label>
              Pending follow-up decision{" "}
              <select name="recurrenceDecisionId" required>
                {report.decisions
                  .filter(
                    (d) =>
                      !d.reassessment_id &&
                      d.decision_kind !== "independent_no_action",
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.followup_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent finding{" "}
              <select name="assessmentKind" required>
                <option value="continue_hold">Continue hold</option>
                <option value="request_new_evidence">
                  Request new evidence
                </option>
                <option value="manual_escalation">Escalate manually</option>
                <option value="confirm_resolution">
                  Confirm resolution (only if clear)
                </option>
              </select>
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent rationale{" "}
              <textarea
                name="assessmentNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.decisions.some(
                  (d) =>
                    !d.reassessment_id &&
                    d.decision_kind !== "independent_no_action",
                )
              }
            >
              Record immutable reassessment
            </button>
          </form>
          <h3>Reassessment history</h3>
          <ul>
            {report.reassessments.map((r) => (
              <li key={r.id}>
                {r.assessment_kind} · {r.recurrence_decision_id} —{" "}
                {r.assessment_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Evidence gap aging &amp; owner action reconciliation</h2>
          <p>
            Track outstanding independent reassessment evidence, including 30+
            day gaps and overdue owner follow-up dates. This private ledger
            records owner actions only; reconciliation never automatically lifts
            a hold or overrides an independent decision.
          </p>
          {report.reassessments.length === 0 && (
            <p>No independent reassessments to reconcile.</p>
          )}
          <ul>
            {report.reassessments.map((r) => (
              <li key={r.id}>
                {r.id} · {r.gap_status} · assessed{" "}
                {new Date(r.assessed_at).toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
          <form action={recordEvidenceGapAction}>
            {pair}
            <label>
              Open independent reassessment{" "}
              <select name="reassessmentId" required>
                {report.reassessments
                  .filter(
                    (r) =>
                      r.assessment_kind !== "confirm_resolution" &&
                      r.gap_status !== "owner_reconciled",
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.gap_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner action{" "}
              <select name="actionKind" required>
                <option value="evidence_requested">Request evidence</option>
                <option value="evidence_submitted">
                  Evidence submitted for review
                </option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="owner_reconciled">
                  Owner reconciliation after evidence submitted
                </option>
              </select>
            </label>
            <label>
              Next due (UTC; required for requests and escalations only){" "}
              <input name="nextDueAt" type="date" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Action rationale{" "}
              <textarea
                name="actionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.reassessments.some(
                  (r) =>
                    r.assessment_kind !== "confirm_resolution" &&
                    r.gap_status !== "owner_reconciled",
                )
              }
            >
              Record immutable owner action
            </button>
          </form>
          <h3>Owner action history</h3>
          {report.limited && (
            <p role="status">
              Recent owner actions are limited to 300 records on this screen.
              Audit history remains in the database.
            </p>
          )}
          <ul>
            {report.ownerActions.map((a) => (
              <li key={a.id}>
                {a.action_kind} · {a.reassessment_id} — {a.action_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Reconciliation exception recurrence &amp; independent closure
            recheck
          </h2>
          <p>
            Owner reviews freeze current pair-wide open, overdue, and recurring
            gaps. A different authorized owner independently rechecks closure.
            This is audit closure only: no automatic release of holds,
            transfers, finance actions, or customer notifications.
          </p>
          <form action={recordExceptionRecurrenceAction}>
            {pair}
            <label>
              Previously reconciled owner action{" "}
              <select name="ownerActionId" required>
                {report.ownerActions
                  .filter(
                    (a) =>
                      a.action_kind === "owner_reconciled" &&
                      !report.exceptionReviews.some(
                        (r) => r.owner_action_id === a.id,
                      ),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner recurrence rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.ownerActions.some(
                  (a) =>
                    a.action_kind === "owner_reconciled" &&
                    !report.exceptionReviews.some(
                      (r) => r.owner_action_id === a.id,
                    ),
                )
              }
            >
              Record exception recurrence review
            </button>
          </form>
          <h3>Frozen exception recurrence reviews</h3>
          <ul>
            {report.exceptionReviews.map((r) => (
              <li key={r.id}>
                {r.id} · {r.observed_open_gaps} open gaps ·{" "}
                {r.observed_overdue_gaps} overdue ·{" "}
                {r.observed_recurrence_count} previous reconciliations —{" "}
                {r.review_note}
              </li>
            ))}
          </ul>
          <form action={recordIndependentClosureAction}>
            {pair}
            <label>
              Exception recurrence review{" "}
              <select name="exceptionReviewId" required>
                {report.exceptionReviews
                  .filter(
                    (r) =>
                      !report.closureRechecks.some(
                        (c) => c.exception_review_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.observed_open_gaps} open gaps
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent closure recheck{" "}
              <select name="recheckKind" required>
                <option value="continue_exception">Continue exception</option>
                <option value="request_new_evidence">
                  Request new evidence
                </option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="independent_audit_closed">
                  Close audit (only if all clear)
                </option>
              </select>
            </label>
            <label>
              Independent evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent rationale{" "}
              <textarea
                name="recheckNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.exceptionReviews.some(
                  (r) =>
                    !report.closureRechecks.some(
                      (c) => c.exception_review_id === r.id,
                    ),
                )
              }
            >
              Record immutable closure recheck
            </button>
          </form>
          <h3>Independent closure recheck history</h3>
          <ul>
            {report.closureRechecks.map((c) => (
              <li key={c.id}>
                {c.recheck_kind} · {c.exception_review_id} — {c.recheck_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Independent closure follow-up &amp; owner decision aging</h2>
          <p>
            Outstanding independent rechecks are flagged after 30 days without
            an owner decision. Pending owner follow-up dates show overdue and
            30+ day overdue status. These indicators do not change any
            operational hold.
          </p>
          <ul>
            {report.closureRechecks.map((c) => (
              <li key={c.id}>
                {c.id} · {c.owner_decision_status} · independent decision{" "}
                {c.recheck_kind}
              </li>
            ))}
          </ul>
          <form action={recordClosureOwnerDecisionAction}>
            {pair}
            <label>
              Independent closure recheck{" "}
              <select name="closureRecheckId" required>
                {report.closureRechecks
                  .filter(
                    (c) =>
                      !report.closureOwnerDecisions.some(
                        (d) => d.closure_recheck_id === c.id,
                      ),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.owner_decision_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner follow-up decision{" "}
              <select name="decisionKind" required>
                <option value="keep_exception_open">Keep exception open</option>
                <option value="request_evidence">
                  Request additional evidence
                </option>
                <option value="manual_escalation">Escalate manually</option>
                <option value="acknowledge_audit_closure">
                  Acknowledge independently closed audit
                </option>
              </select>
            </label>
            <p>
              For open exceptions, select a future UTC follow-up date within 90
              days. Audit-closure acknowledgments must leave the date blank. The
              database enforces agreement with the independent recheck.
            </p>
            <label>
              Follow-up due date (UTC) <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner decision rationale{" "}
              <textarea
                name="decisionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureRechecks.some(
                  (c) =>
                    !report.closureOwnerDecisions.some(
                      (d) => d.closure_recheck_id === c.id,
                    ),
                )
              }
            >
              Record immutable owner decision
            </button>
          </form>
          <h3>Owner decision history</h3>
          <ul>
            {report.closureOwnerDecisions.map((d) => (
              <li key={d.id}>
                {d.decision_kind} · {d.closure_recheck_id} — {d.decision_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Owner closure recurrence, overdue escalation &amp; independent
            follow-up
          </h2>
          <p>
            Pair-wide recurrence, unresolved overdue owner follow-ups, and
            earlier manual escalations are frozen when an independent owner
            reviews a decision. Owner deadlines overdue by 30+ days require
            manual escalation. This is an audit-only record: no live hold,
            transfer, payment, or campground status changes.
          </p>
          <ul>
            {report.closureOwnerDecisions.map((d) => (
              <li key={d.id}>
                {d.id} · {d.independent_followup_status} · {d.decision_kind}
                {d.next_due_at
                  ? ` · owner due ${new Date(d.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · no open owner deadline"}
              </li>
            ))}
          </ul>
          <form action={recordIndependentClosureFollowupAction}>
            {pair}
            <label>
              Owner closure decision{" "}
              <select name="ownerDecisionId" required>
                {report.closureOwnerDecisions
                  .filter(
                    (d) =>
                      !report.closureFollowupReviews.some(
                        (r) => r.owner_decision_id === d.id,
                      ),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.independent_followup_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independent finding{" "}
              <select name="reviewKind" required>
                <option value="continue_exception">
                  Continue exception (not overdue)
                </option>
                <option value="request_new_evidence">
                  Request new evidence
                </option>
                <option value="manual_escalation">Manual escalation</option>
                <option value="confirm_audit_acknowledged">
                  Confirm independently acknowledged audit (only if clear)
                </option>
              </select>
            </label>
            <p>
              Open reviews need a future UTC follow-up within 90 days. Audit
              confirmation must leave the date empty and requires no captured
              overdue or recurring exceptions. The database checks the review
              against the actual owner decision and independent rechecker.
            </p>
            <label>
              Independent follow-up due (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Independent review rationale{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureOwnerDecisions.some(
                  (d) =>
                    !report.closureFollowupReviews.some(
                      (r) => r.owner_decision_id === d.id,
                    ),
                )
              }
            >
              Record immutable independent review
            </button>
          </form>
          <h3>Independent review evidence snapshots</h3>
          <ul>
            {report.closureFollowupReviews.map((r) => (
              <li key={r.id}>
                {r.review_kind} · {r.owner_decision_id} ·{" "}
                {r.observed_recurring_decisions} recurrent ·{" "}
                {r.observed_overdue_decisions} overdue ·{" "}
                {r.observed_escalation_decisions} prior manual escalations ·{" "}
                {r.observed_owner_days_overdue} owner days overdue —{" "}
                {r.review_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>
            Independent outcome aging, owner evidence decisions &amp; escalation
            handoffs
          </h2>
          <p>
            Independent findings awaiting an owner response are tracked by UTC
            due date, including 30+ day overdue handoffs. A different authorized
            owner records the evidence decision or accepts the manual
            escalation. Long-overdue outcomes require an escalation handoff;
            neither an audit acknowledgment nor evidence reconciliation changes
            operational holds.
          </p>
          <ul>
            {report.closureFollowupReviews.map((r) => (
              <li key={r.id}>
                {r.id} · {r.owner_reconciliation_status} · {r.review_kind}
                {r.next_due_at
                  ? ` · independent due ${new Date(r.next_due_at).toISOString().slice(0, 10)} UTC`
                  : " · no open independent deadline"}
              </li>
            ))}
          </ul>
          <form action={recordOwnerIndependentHandoffAction}>
            {pair}
            <label>
              Independent follow-up outcome{" "}
              <select name="independentReviewId" required>
                {report.closureFollowupReviews
                  .filter(
                    (r) =>
                      !report.closureHandoffDecisions.some(
                        (d) => d.independent_review_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {r.owner_reconciliation_status}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner handoff or evidence outcome{" "}
              <select name="actionKind" required>
                <option value="escalation_handoff_accepted">
                  Accept manual escalation handoff
                </option>
                <option value="evidence_requested">Request evidence</option>
                <option value="evidence_reconciled">
                  Reconcile evidence received (if independently requested)
                </option>
                <option value="monitoring_continues">
                  Continue monitoring (if not overdue)
                </option>
                <option value="audit_confirmation_acknowledged">
                  Acknowledge independently confirmed audit
                </option>
              </select>
            </label>
            <p>
              Open actions need a future UTC due date within 90 days. Leave the
              date empty for reconciled evidence or an acknowledged audit. The
              database enforces compatibility with the independent finding,
              including mandatory escalation of outcomes overdue by 30+ days.
            </p>
            <label>
              Owner handoff due date (UTC){" "}
              <input type="date" name="nextDueAt" />
            </label>
            <label>
              Evidence reference{" "}
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Owner evidence decision rationale{" "}
              <textarea
                name="actionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                !report.closureFollowupReviews.some(
                  (r) =>
                    !report.closureHandoffDecisions.some(
                      (d) => d.independent_review_id === r.id,
                    ),
                )
              }
            >
              Record immutable owner evidence decision
            </button>
          </form>
          <h3>Owner reconciliation &amp; escalation handoff evidence</h3>
          <ul>
            {report.closureHandoffDecisions.map((d) => (
              <li key={d.id}>
                {d.action_kind} · {d.independent_review_id} ·{" "}
                {d.observed_review_days_overdue} days overdue ·{" "}
                {d.observed_peer_overdue_reviews} other overdue ·{" "}
                {d.observed_prior_escalation_handoffs} prior escalations —{" "}
                {d.action_note}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Immutable decision history</h2>
          <ul>
            {report.decisions.map((d) => (
              <li key={d.id}>
                {d.decision_kind} · {d.recurrence_review_id} — {d.decision_note}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
