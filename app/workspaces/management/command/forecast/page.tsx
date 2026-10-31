import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { summarizeCapacityForecastVariance } from "@/lib/command-centre/capacity-forecast-core.mjs";
import { getCampgroundSegmentComparison } from "@/lib/command-centre/segment-comparison-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seasonal Capacity Forecast Variance · iCamp",
  description:
    "Campground-scoped month-to-date booking coverage scenarios grounded in recorded historical rates.",
};

const names: Record<string, string> = {
  campsite: "Campsites",
  rental_cottage: "Rental cottages",
  permanent_unit: "Permanent units",
};

export default async function CapacityForecastPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    window?: string;
    scenario?: string;
  }>;
}>) {
  const path = "/workspaces/management/command/forecast";
  const session = await requireStaff(path);
  const params = await searchParams;
  const lookbackMonths: 2 | 3 | 5 =
    params.window === "2" ? 2 : params.window === "5" ? 5 : 3;
  const scenario: "low" | "weighted" | "high" =
    params.scenario === "low" || params.scenario === "high"
      ? params.scenario
      : "weighted";
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return ["reports.read", "reservation.read", "accommodation.read"].every(
          (key) => auth?.permissions.includes(key),
        )
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const base = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  const variance = await getCampgroundSegmentComparison({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  })
    .then((data) =>
      summarizeCapacityForecastVariance(data, { lookbackMonths, scenario }),
    )
    .catch(() => null);

  return (
    <AppShell>
      <div className="page-stack camp-command camp-forecast-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Capacity forecast variance</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 166 · Standard / Scenario Planning</p>
          <h1>Seasonal Capacity Forecast Variance</h1>
          <p className="hero-panel__lead">
            Explore low, typical and high historical booking-rate comparisons
            across two, three or five completed months of campground records.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="primary-link"
              href={`/workspaces/management/command/segments${base}`}
            >
              Segment comparisons ↗
            </Link>
            <Link
              className="secondary-link"
              href="/workspaces/management/command"
            >
              Management Command
            </Link>
          </div>
        </section>
        <section
          className="camp-command__scope"
          aria-label="Campground selection"
        >
          <form method="get" className="camp-command__scope-form">
            <input type="hidden" name="window" value={lookbackMonths} />
            <input type="hidden" name="scenario" value={scenario} />
            <label htmlFor="forecast-campground">Campground</label>
            <select
              id="forecast-campground"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {authorized.map((item) => (
                <option key={item.campgroundId} value={item.campgroundId}>
                  {item.campgroundName}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary-button">
              Apply
            </button>
          </form>
          <span className="ops-pill">Read-only · Not a booking prediction</span>
        </section>
        <section
          className="content-panel ops-detail-card camp-forecast__scenarios"
          aria-labelledby="scenario-heading"
        >
          <div className="ops-section-heading">
            <div>
              <p className="eyebrow">
                Recorded historical rates · No invented demand
              </p>
              <h2 id="scenario-heading">Compare planning scenarios</h2>
            </div>
          </div>
          <form method="get" className="camp-forecast__scenario-form">
            <input
              type="hidden"
              name="campground"
              value={selected.campgroundId}
            />
            <label htmlFor="forecast-window">
              Historical window
              <select
                id="forecast-window"
                name="window"
                defaultValue={lookbackMonths}
              >
                <option value="2">Previous 2 completed months</option>
                <option value="3">Previous 3 completed months</option>
                <option value="5">Previous 5 completed months</option>
              </select>
            </label>
            <label htmlFor="forecast-scenario">
              Historical scenario
              <select
                id="forecast-scenario"
                name="scenario"
                defaultValue={scenario}
              >
                <option value="low">
                  Low — smallest observed monthly share
                </option>
                <option value="weighted">
                  Typical — weighted historical share
                </option>
                <option value="high">
                  High — largest observed monthly share
                </option>
              </select>
            </label>
            <button type="submit" className="secondary-button">
              Apply scenario
            </button>
          </form>
          <p className="ops-inline-note">
            These are sensitivity comparisons from real booking records. Low and
            high use the smallest and largest recorded monthly booked share
            within the chosen window; typical weights recorded booked site
            nights by available site nights. They are not forecasts of future
            demand, guaranteed capacity or booking recommendations.
          </p>
        </section>
        {variance ? (
          <>
            <section
              className="content-panel ops-detail-card"
              aria-labelledby="forecast-heading"
            >
              <div className="ops-section-heading">
                <div>
                  <p className="eyebrow">
                    {variance.scenario} historical scenario ·{" "}
                    {variance.lookbackMonths} months
                  </p>
                  <h2 id="forecast-heading">
                    {variance.currentMonth.slice(0, 7)} month-to-date
                  </h2>
                </div>
                <span className="ops-pill">
                  {variance.total.comparableKinds} of 3 types comparable
                </span>
              </div>
              <p className="ops-inline-note">
                Baseline: {variance.baselineMonths[0].slice(0, 7)} through{" "}
                {variance.baselineMonths.at(-1)?.slice(0, 7)}. For each
                accommodation type, the selected observed historical rate is
                applied to current month-to-date site nights. Categories with no
                historical inventory remain unavailable. This is a planning
                comparison, not a prediction of future demand or final
                occupancy.
              </p>
              {variance.total.comparableKinds ? (
                <div className="camp-forecast__summary" role="status">
                  <div>
                    <span>Actual booked site nights</span>
                    <strong>
                      {variance.total.actualBookedNights.toLocaleString(
                        "en-CA",
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Historical-rate estimate</span>
                    <strong>
                      {variance.total.expectedNights.toLocaleString("en-CA")}
                    </strong>
                  </div>
                  <div>
                    <span>Variance (actual − estimate)</span>
                    <strong>
                      {variance.total.varianceNights > 0 ? "+" : ""}
                      {variance.total.varianceNights.toLocaleString("en-CA")}
                    </strong>
                  </div>
                </div>
              ) : (
                <p role="status">
                  No accommodation types have both current inventory and a
                  historical comparison baseline.
                </p>
              )}
              {variance.total.excludedKinds ? (
                <p className="ops-inline-note" role="status">
                  {variance.total.excludedKinds} accommodation type(s) are
                  excluded from the comparable total because the required
                  inventory baseline is unavailable.
                </p>
              ) : null}
              <div className="camp-occupancy__table-scroll">
                <table className="camp-occupancy__table camp-forecast__table">
                  <caption>
                    Exact type-by-type actual and historical-rate estimates;
                    site nights, not guest counts
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Accommodation</th>
                      <th scope="col">Current site nights</th>
                      <th scope="col">Actual booked</th>
                      <th scope="col">Selected historical rate</th>
                      <th scope="col">Estimate</th>
                      <th scope="col">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variance.rows.map((row) => (
                      <tr key={row.kind}>
                        <th scope="row">{names[row.kind]}</th>
                        <td>{row.currentSiteNights.toLocaleString("en-CA")}</td>
                        <td>
                          {row.actualBookedNights.toLocaleString("en-CA")}
                        </td>
                        <td>
                          {row.baselinePercent === null
                            ? "Unavailable"
                            : `${row.baselinePercent}% (${row.observedMonths} observed months)`}
                        </td>
                        <td>
                          {row.expectedNights === null
                            ? "—"
                            : row.expectedNights.toLocaleString("en-CA")}
                        </td>
                        <td>
                          {row.varianceNights === null
                            ? row.reason === "no_current_inventory"
                              ? "No active inventory"
                              : "No historical inventory"
                            : `${row.varianceNights > 0 ? "+" : ""}${row.varianceNights.toLocaleString("en-CA")} nights (${row.variancePoints! > 0 ? "+" : ""}${row.variancePoints} pp)`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="content-panel ops-detail-card">
              <h2>How to use this carefully</h2>
              <p className="ops-inline-note">
                Seasonal demand, holidays and weather can change bookings
                sharply. Today&apos;s active inventory is used for historical
                denominators; records may have changed. The current month is
                incomplete, and overlapping seasonal/reservation nights are
                counted once. Do not use this comparison to approve
                availability, prices or staffing automatically. Billing /
                Omnichannel remain HELD / DISCONNECTED.
              </p>
            </section>
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Forecast comparison unavailable</h2>
            <p>
              The authorized record source could not be read or reconciled. No
              estimate was invented.
            </p>
            <Link href={`/workspaces/management/command/segments${base}`}>
              Review source segments ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
