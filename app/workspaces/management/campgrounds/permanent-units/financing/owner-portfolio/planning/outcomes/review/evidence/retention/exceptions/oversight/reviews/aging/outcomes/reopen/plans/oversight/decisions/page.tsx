import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getRecurrenceLedger } from "@/lib/permanent-unit-owner-retention/recurrence-postgres.mjs";
import {
  recordRecurrenceReviewAction,
  recordRecurrenceDecisionAction,
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
