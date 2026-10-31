import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SeasonalUtilizationChart } from "@/components/seasonal-utilization-chart";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { getCampgroundSeasonalTrends } from "@/lib/command-centre/occupancy-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seasonal Site Utilization · iCamp",
  description:
    "Six months of tenant-scoped campground site-night bookings, seasonal assignments and trend evidence.",
};

export default async function SeasonalUtilizationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/management/command/seasonal";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
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
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const query = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  const summary = await getCampgroundSeasonalTrends({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  }).catch(() => null);

  return (
    <AppShell>
      <div className="page-stack camp-command camp-seasonal-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Seasonal utilization</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 163 · Standard / Seasonal Analytics</p>
          <h1>Seasonal Site Utilization</h1>
          <p className="hero-panel__lead">
            Understand historical booked nights and seasonal assignments without
            confusing reserved inventory, occupied guests, or current-day
            availability.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="primary-link"
              href={`/workspaces/management/command/capacity${query}`}
            >
              Upcoming capacity ↗
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
            <label htmlFor="seasonal-property">Campground</label>
            <select
              id="seasonal-property"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {allowed.map((item) => (
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
            Read-only · Six campground-local months
          </span>
        </section>
        {summary ? (
          <>
            <div className="camp-command__kpis">
              {[
                {
                  label: "Booked site nights",
                  value: summary.bookedNights.toLocaleString("en-CA"),
                  detail: "Six months, excluding cancelled",
                  icon: "▥",
                  tone: "green",
                },
                {
                  label: "Seasonally assigned nights",
                  value: summary.seasonalNights.toLocaleString("en-CA"),
                  detail: "Subset of booked site nights",
                  icon: "⌂",
                  tone: "amber",
                },
                {
                  label: "Overall booked coverage",
                  value: `${summary.averageBookedPercent}%`,
                  detail: "Site-night weighted average",
                  icon: "▦",
                  tone: "blue",
                },
                {
                  label: "Inventory site nights",
                  value: summary.siteNights.toLocaleString("en-CA"),
                  detail: "Current active site count × past days",
                  icon: "◈",
                  tone: "green",
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className={`camp-command__kpi camp-command__kpi--${item.tone}`}
                >
                  <span className="camp-command__kpi-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.detail}</small>
                  </div>
                </article>
              ))}
            </div>
            <SeasonalUtilizationChart summary={summary} />
            <section className="content-panel ops-detail-card">
              <h2>How to use these trends</h2>
              <p className="ops-inline-note">
                These are site-night booking records, not a physical camper
                headcount, income statement, or point-in-time historical audit.
                Because the denominator uses currently active accommodations and
                booking records may be revised, earlier percentages are
                retrospective planning estimates. The current month only
                includes nights through today. For live booking decisions, use
                the availability calendar.
              </p>
              <p className="ops-inline-note">
                Tenant billing and Omnichannel integrations remain HELD /
                DISCONNECTED.
              </p>
            </section>
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Seasonal trends unavailable</h2>
            <p>
              This campground&apos;s history cannot be confirmed right now; no
              zero or estimated record totals have been substituted.
            </p>
            <Link href={`/workspaces/management/command/capacity${query}`}>
              Open upcoming capacity ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
