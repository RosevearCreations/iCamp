import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerReopenPlans } from "@/lib/permanent-unit-owner-retention/plans-postgres.mjs";
import {
  saveReopenPlanAction,
  saveIndependentResolutionAction,
} from "./actions";
const previous =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner action plans & independent hold resolution · iCamp",
  robots: { index: false, follow: false },
};
export default async function OwnerReopenPlansPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const session = await requireStaff(`${previous}/plans`),
    params = await searchParams;
  if (!params.source || !params.target) redirect(previous);
  let report;
  try {
    report = await getOwnerReopenPlans(
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
            href={`${previous}/plans/oversight?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Build 114 — follow-up aging &amp; recurrence oversight
          </Link>
        </p>
        <p>
          <Link
            href={`${previous}?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Back to exception monitoring
          </Link>
        </p>
        <h1>Owner action plans &amp; independent hold resolution</h1>
        <p>
          Plans and independent decisions are immutable. Resolution requires
          separately accepted source evidence and never changes the original
          audit or cases.
        </p>
        {params.saved && <p role="status">{params.saved}</p>}
        {params.error && <p role="alert">{params.error}</p>}
        {report.limited && (
          <p role="status">
            Lists are bounded; complete evidence is preserved in the private
            audit database.
          </p>
        )}
        <section>
          <h2>Record owner action plan</h2>
          <form action={saveReopenPlanAction}>
            {pair}
            <label>
              Exception review{" "}
              <select name="exceptionReviewId" required>
                {report.reviews.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.review_kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Action{" "}
              <select name="actionKind">
                <option value="gather_evidence">Gather evidence</option>
                <option value="investigate_source">Investigate source</option>
                <option value="independent_recheck">Independent recheck</option>
              </select>
            </label>
            <label>
              Next review date (UTC){" "}
              <input type="date" name="nextDueAt" required />
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
              Action note{" "}
              <textarea
                name="actionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.reviews.length}>
              Record immutable plan
            </button>
          </form>
        </section>
        <section>
          <h2>Independent resolution or continued hold</h2>
          <form action={saveIndependentResolutionAction}>
            {pair}
            <label>
              Action plan{" "}
              <select name="actionPlanId" required>
                {report.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.action_kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision{" "}
              <select name="resolutionKind">
                <option value="continue_hold">Continue hold</option>
                <option value="independently_resolved">
                  Independently resolved
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
              Resolution note{" "}
              <textarea
                name="resolutionNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.plans.length}>
              Record independent decision
            </button>
          </form>
        </section>
        <section>
          <h2>Audit history</h2>
          <h3>Plans</h3>
          <ul>
            {report.plans.map((p) => (
              <li key={p.id}>
                {p.action_kind} · {p.id} — {p.action_note}
              </li>
            ))}
          </ul>
          <h3>Independent decisions</h3>
          <ul>
            {report.resolutions.map((r) => (
              <li key={r.id}>
                {r.resolution_kind} · {r.action_plan_id} ·{" "}
                {r.observed_unclosed_cases} unresolved — {r.resolution_note}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
