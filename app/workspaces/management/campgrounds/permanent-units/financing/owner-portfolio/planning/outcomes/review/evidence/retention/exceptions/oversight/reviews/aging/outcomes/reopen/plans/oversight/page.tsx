import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerReopenPlans } from "@/lib/permanent-unit-owner-retention/plans-postgres.mjs";
import {
  normalizeHoldAgingFilter,
  summarizeHoldAging,
} from "@/lib/permanent-unit-owner-retention/hold-aging-core.mjs";
const previous =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Hold aging and recurrence oversight · iCamp",
  robots: { index: false, follow: false },
};
export default async function HoldAgingPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; target?: string; stage?: string }>;
}) {
  const session = await requireStaff(`${previous}/oversight`),
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
  const filter = normalizeHoldAgingFilter(params.stage),
    summary = summarizeHoldAging(
      report.plans,
      report.resolutions,
      report.reviews,
    );
  const rows =
    filter === "all"
      ? summary.rows
      : summary.rows.filter((r) => r.stage === filter);
  return (
    <AppShell>
      <main className="page-stack">
        <p>
          <Link
            href={`${previous}/oversight/decisions?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Build 115 — owner recurrence decisions
          </Link>
        </p>
        <p>
          <Link
            href={`${previous}?source=${encodeURIComponent(params.source)}&target=${encodeURIComponent(params.target)}`}
          >
            Back to owner action plans
          </Link>
        </p>
        <h1>Hold resolution follow-up aging &amp; recurrence oversight</h1>
        <p>
          Owner-only read-only audit. The current stage is calculated from
          immutable Build 113 records; it does not close, reopen, schedule,
          notify, or alter source cases.
        </p>
        {report.limited && (
          <p role="status">
            History is bounded to 100 reviews and 150 plans/resolutions. Counts
            below refer to this displayed sample only, not the entire portfolio.
          </p>
        )}
        <section>
          <h2>Follow-up stages</h2>
          <ul>
            {Object.entries(summary.counts).map(([stage, count]) => (
              <li key={stage}>
                {stage.replaceAll("_", " ")}: {count}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Filtered follow-up ledger</h2>
          <form method="get">
            <input type="hidden" name="source" value={params.source} />
            <input type="hidden" name="target" value={params.target} />
            <label>
              Stage{" "}
              <select name="stage" defaultValue={filter}>
                <option value="all">All stages</option>
                <option value="overdue">Overdue</option>
                <option value="due_week">Due in 7 days</option>
                <option value="due_month">Due in 30 days</option>
                <option value="later">Later</option>
                <option value="resolved">Independently resolved</option>
                <option value="continued_hold">Continued hold</option>
              </select>
            </label>
            <button type="submit">Apply filter</button>
          </form>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                {row.stage.replaceAll("_", " ")} · Plan {row.id} · Due{" "}
                {new Date(row.next_due_at).toLocaleDateString("en-CA", {
                  timeZone: "UTC",
                })}{" "}
                · Acceptance{" "}
                {row.acceptanceId ?? "Outside bounded review history"}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Potential recurring follow-ups</h2>
          <p>
            Repeat plans or continued holds by original acceptance, for owner
            review only.
          </p>
          <ul>
            {summary.recurrence.map((r) => (
              <li key={r.acceptanceId}>
                Acceptance {r.acceptanceId}: {r.plans} plans, {r.continuedHolds}{" "}
                continued holds, {r.overdue} overdue
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
