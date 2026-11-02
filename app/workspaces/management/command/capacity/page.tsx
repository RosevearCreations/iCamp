import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { OccupancyCapacityChart } from "@/components/occupancy-capacity-chart";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { getCampgroundOccupancySummary } from "@/lib/command-centre/occupancy-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Capacity & Occupancy · iCamp",
  description:
    "Real 14-day campsite capacity, booked-night coverage, temporary holds, and maintenance pauses for authorized campground management.",
};

export default async function CapacityPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/management/command/capacity";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const permitted = (
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
  if (!permitted.length) redirect("/auth/not-authorized");
  const selected =
    permitted.find((item) => item.campgroundId === params.campground) ??
    permitted[0];
  const base = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  const result = await getCampgroundOccupancySummary({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  })
    .then((summary) => ({ summary, failed: false as const }))
    .catch(() => ({ summary: null, failed: true as const }));
  const summary = result.summary;

  return (
    <AppShell>
      <div className="page-stack camp-command camp-occupancy">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Capacity & Occupancy</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 162 · Standard / Management Analytics</p>
          <h1>Capacity & Occupancy</h1>
          <p className="hero-panel__lead">
            Follow upcoming bookings, seasonal occupancy, temporary holds and
            out-of-service inventory through clear, property-specific views.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="secondary-link"
              href={`/workspaces/management/command/seasonal?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Six-month utilization ↗
            </Link>
            <Link
              className="primary-link"
              href={`/workspaces/management/campgrounds/availability${base}`}
            >
              Live booking availability ↗
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
            <label htmlFor="capacity-property">Campground</label>
            <select
              id="capacity-property"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {permitted.map((item) => (
                <option key={item.campgroundId} value={item.campgroundId}>
                  {item.campgroundName}
                </option>
              ))}
            </select>
            <button className="secondary-button" type="submit">
              Apply
            </button>
          </form>
          <span className="ops-pill">
            Read-only · 14 campground-local nights
          </span>
        </section>
        {summary ? (
          <>
            <div className="camp-command__kpis">
              {[
                {
                  label: "Active accommodation sites",
                  value: summary.totalSites,
                  caption: "Selected campground inventory",
                  tone: "green",
                  icon: "⌂",
                },
                {
                  label: "Average booked coverage",
                  value: `${summary.averageBookedPercent}%`,
                  caption: "Next 14 nights · denominator: active sites",
                  tone: "blue",
                  icon: "▥",
                },
                {
                  label: "Booked site nights",
                  value: summary.bookedSiteNights,
                  caption: "Confirmed, checked-in or seasonal",
                  tone: "green",
                  icon: "▦",
                },
                {
                  label: "Out-of-service site nights",
                  value: summary.pausedSiteNights,
                  caption: "Closed, maintenance, inspection or winterized",
                  tone: "amber",
                  icon: "⚒",
                },
              ].map((item) => (
                <article
                  className={`camp-command__kpi camp-command__kpi--${item.tone}`}
                  key={item.label}
                >
                  <span className="camp-command__kpi-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.caption}</small>
                  </div>
                  <span className="camp-command__spark" aria-hidden="true" />
                </article>
              ))}
            </div>
            <OccupancyCapacityChart summary={summary} />
            <section className="content-panel ops-detail-card camp-occupancy__readout">
              <h2>Operational interpretation</h2>
              <div className="camp-command__safety-list">
                <div>
                  <span>Temporary hold nights</span>
                  <strong>{summary.heldSiteNights}</strong>
                </div>
                <div>
                  <span>Data refreshed</span>
                  <strong>{summary.generatedAt}</strong>
                </div>
                <div>
                  <span>Reservation source</span>
                  <strong>
                    Entire authorized campground · not a 250-row preview
                  </strong>
                </div>
                <div>
                  <span>Real-time bookability</span>
                  <strong>Open the live availability screen</strong>
                </div>
                <div>
                  <span>Tenant billing & Omnichannel</span>
                  <strong className="ops-text-hold">HELD / DISCONNECTED</strong>
                </div>
              </div>
              <p className="ops-inline-note">
                A booked site night means a confirmed/checked-in reservation or
                active seasonal assignment covers that date. It is not a
                physical headcount or a revenue forecast. Holds and pending
                bookings are separate and may overlap; site closures may also
                overlap reservations. Use the live availability engine for
                actual booking decisions.
              </p>
            </section>
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Capacity snapshot unavailable</h2>
            <p>
              We could not retrieve the authorized campground data right now. No
              totals have been guessed or replaced with zero.
            </p>
            <Link
              href={`/workspaces/management/campgrounds/availability${base}`}
            >
              Open live availability ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
