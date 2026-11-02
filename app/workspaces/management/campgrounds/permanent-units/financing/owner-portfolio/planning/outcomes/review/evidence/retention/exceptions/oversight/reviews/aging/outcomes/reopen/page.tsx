import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getAcceptanceExceptionReviewReport } from "@/lib/permanent-unit-owner-retention/reopen-postgres.mjs";
import { recordAcceptanceExceptionReviewAction } from "./actions";
const previous =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Post-acceptance exception monitoring · iCamp",
  robots: { index: false, follow: false },
};
export default async function ReopenPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const session = await requireStaff(`${previous}/reopen`),
    params = await searchParams;
  if (!params.source || !params.target) redirect(previous);
  let report;
  try {
    report = await getAcceptanceExceptionReviewReport(
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
  return (
    <AppShell>
      <main className="page-stack">
        <p>
          <Link
            href={`${previous}/reopen/plans?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Build 113 — owner action plans &amp; independent resolution
          </Link>
        </p>
        <p>
          <Link
            href={`${previous}?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Back to independent acceptance
          </Link>
        </p>
        <h1>
          Post-acceptance exception monitoring &amp; evidence reopen review
        </h1>
        <p>
          This private workbench monitors accepted closure evidence for later
          exceptions. Reopening is a recommendation for a fresh independent
          review, never automatic case reopening or approval reversal.
        </p>
        {params.saved && <p role="status">{params.saved}</p>}
        {params.error && <p role="alert">{params.error}</p>}
        {report.limited && (
          <p role="status">
            Audit listing is bounded to 100 accepted cases and 150 reviews. Full
            history remains in the database.
          </p>
        )}
        <section>
          <h2>Record an independent exception review</h2>
          <form action={recordAcceptanceExceptionReviewAction}>
            <input
              type="hidden"
              name="sourceCampgroundId"
              value={params.source}
            />
            <input
              type="hidden"
              name="targetCampgroundId"
              value={params.target}
            />
            <label>
              Accepted evidence{" "}
              <select name="acceptanceId" required>
                {report.candidates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.new_case_count} later cases
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review outcome{" "}
              <select name="reviewKind">
                <option value="monitor">
                  Continue monitoring (no exceptions)
                </option>
                <option value="exception_hold">
                  Hold pending exception review
                </option>
                <option value="reopen_recommended">
                  Recommend independent evidence reopen
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
              Review note{" "}
              <textarea
                name="reviewNote"
                minLength={12}
                maxLength={800}
                required
              />
            </label>
            <button type="submit" disabled={!report.candidates.length}>
              Record immutable independent review
            </button>
          </form>
        </section>
        <section>
          <h2>Recent exception review history</h2>
          <ul>
            {report.reviews.map((r) => (
              <li key={r.id}>
                {r.review_kind} · {r.acceptance_id} · {r.cases_since_acceptance}{" "}
                later cases · {r.observed_unclosed_cases} unresolved —{" "}
                {r.review_note}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
