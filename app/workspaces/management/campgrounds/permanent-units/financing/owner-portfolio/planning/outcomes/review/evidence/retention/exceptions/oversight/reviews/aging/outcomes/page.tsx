import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerReassessmentOutcomes } from "@/lib/permanent-unit-owner-retention/outcomes-postgres.mjs";
import { recordOutcomeAction, acceptOutcomeAction } from "./actions";
const previous =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner follow-up outcomes & independent acceptance · iCamp",
  robots: { index: false, follow: false },
};
export default async function OutcomePage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const session = await requireStaff(`${previous}/outcomes`),
    params = await searchParams;
  if (!params.source || !params.target) redirect(previous);
  let report;
  try {
    report = await getOwnerReassessmentOutcomes(
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
  const hidden = (
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
            href={`${previous}/outcomes/reopen?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Build 112 — post-acceptance exception monitoring
          </Link>
        </p>
        <p>
          <Link
            href={`${previous}?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Back to independent reassessment
          </Link>
        </p>
        <h1>Owner follow-up outcomes & independent closure acceptance</h1>
        <p>
          Private, append-only review. Outcome evidence and final audit
          acceptance require different authorized owners. Acceptance does not
          close cases, delete records, notify applicants, or authorize lending
          or transfers.
        </p>
        {params.saved && <p role="status">{params.saved}</p>}
        {params.error && <p role="alert">{params.error}</p>}
        {report.limited && (
          <p role="status">
            Audit lists are limited to 100 reassessments and 150 events each.
            Older rows remain preserved in the database.
          </p>
        )}
        <section aria-labelledby="outcome-heading">
          <h2 id="outcome-heading">Record accountable follow-up outcome</h2>
          <form action={recordOutcomeAction}>
            {hidden}
            <label>
              Reassessment{" "}
              <select name="reassessmentId" required>
                {report.reassessments.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.assessment_kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Outcome{" "}
              <select name="outcomeKind">
                <option value="monitoring_completed">
                  Monitoring completed
                </option>
                <option value="evidence_pending">Evidence still pending</option>
                <option value="escalated">Escalated manually</option>
                <option value="closure_evidence_ready">
                  Closure evidence ready
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
              Owner outcome note{" "}
              <textarea
                name="outcomeNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.reassessments.length}>
              Record immutable outcome
            </button>
          </form>
        </section>
        <section aria-labelledby="accept-heading">
          <h2 id="accept-heading">Independent final audit decision</h2>
          <p>
            Only current, supported closure evidence can be accepted. Use a hold
            when verification is incomplete. The database rechecks source
            exceptions at the instant of acceptance.
          </p>
          <form action={acceptOutcomeAction}>
            {hidden}
            <label>
              Owner outcome{" "}
              <select name="outcomeId" required>
                {report.outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.outcome_kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision{" "}
              <select name="acceptanceKind">
                <option value="held">Hold for independent review</option>
                <option value="accepted">
                  Accept final audit closure evidence
                </option>
              </select>
            </label>
            <label>
              Independent audit note{" "}
              <textarea
                name="auditNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.outcomes.length}>
              Record independent decision
            </button>
          </form>
        </section>
        <section>
          <h2>Audit history</h2>
          <h3>Recorded outcomes</h3>
          <ul>
            {report.outcomes.map((o) => (
              <li key={o.id}>
                {o.outcome_kind} · {o.id} · {o.evidence_reference} —{" "}
                {o.outcome_note}
              </li>
            ))}
          </ul>
          <h3>Independent decisions</h3>
          <ul>
            {report.acceptances.map((a) => (
              <li key={a.id}>
                {a.acceptance_kind} · {a.outcome_id} — {a.audit_note}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
