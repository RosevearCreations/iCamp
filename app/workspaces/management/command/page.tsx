import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ManagementModuleFinder,
} from "@/components/management-module-finder";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { buildManagementSnapshot } from "@/lib/command-centre/management.mjs";
import { getCommandViews } from "@/lib/command-centre/layout-postgres.mjs";
import { modulesForPermissions } from "@/lib/command-centre/module-catalog";
import { getMaintenanceWorkOrderBoard } from "@/lib/maintenance-work-orders/postgres.mjs";
import { listReservationManagementConsole } from "@/lib/reservation-management/postgres.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campground Operations Command · iCamp",
  description:
    "Tenant-scoped live campground management, arrivals, site readiness and maintenance queues in the Standard theme.",
};

const reservationPermissions = [
  "reservation.read",
  "reservation.create",
  "reservation.modify",
  "reservation.cancel",
];
const maintenancePermissions = [
  "maintenance.read",
  "maintenance.create",
  "maintenance.assign",
  "maintenance.complete",
];


function count(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-CA");
}

function availabilityMessage(
  permitted: boolean,
  failed: boolean,
  available: boolean,
) {
  if (!permitted) return "Requires additional campground access";
  if (failed) return "Source temporarily unavailable";
  return available ? "From your campground records" : "No source data returned";
}

export default async function ManagementCommandPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; view?: string; commandNotice?: string }>;
}>) {
  const path = "/workspaces/management/command";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const permitted = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return authorization?.permissions.includes("reports.read")
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!permitted.length) redirect("/auth/not-authorized");

  const selected =
    permitted.find((item) => item.campgroundId === params.campground) ??
    permitted[0];
  const access = selected.authorization.permissions;
  const mayReadReservations = reservationPermissions.some((key) =>
    access.includes(key),
  );
  const mayReadMaintenance = maintenancePermissions.some((key) =>
    access.includes(key),
  );
  // Each service repeats its own tenant authorization check. Failure never
  // falls back to another campground or makes up a zero metric.
  const [reservationsResult, maintenanceResult] = await Promise.allSettled([
    mayReadReservations
      ? listReservationManagementConsole({
          userId: session.user.id,
          campgroundId: selected.campgroundId,
        })
      : Promise.resolve(null),
    mayReadMaintenance
      ? getMaintenanceWorkOrderBoard(session.user.id, selected.campgroundId)
      : Promise.resolve(null),
  ]);
  const reservations =
    reservationsResult.status === "fulfilled" ? reservationsResult.value : null;
  const maintenance =
    maintenanceResult.status === "fulfilled" ? maintenanceResult.value : null;
  const snapshot = buildManagementSnapshot({
    reservations,
    maintenance,
    timezone:
      reservations?.campground?.timezone ?? maintenance?.campground?.timezone,
  });
  const reservationError = reservationsResult.status === "rejected";
  const maintenanceError = maintenanceResult.status === "rejected";
  const base = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  const savedViewResult = await getCommandViews({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  }).then((views) => ({ views, failed: false as const }))
    .catch(() => ({ views: [], failed: true as const }));
  const savedViews = savedViewResult.views;
  const activeView =
    params.view === "reset"
      ? null
      : savedViews.find((view) => view.id === params.view) ??
        savedViews.find((view) => view.isDefault) ??
        null;
  const moduleCatalog = modulesForPermissions(access);

  const kpis = [
    {
      id: "sites",
      label: "Active accommodation sites",
      href: access.includes("accommodation.read") || access.includes("accommodation.manage")
        ? `/workspaces/management/campgrounds/accommodations${base}`
        : mayReadMaintenance ? `/workspaces/maintenance/work-orders${base}` : null,
      source: "Authorized campground accommodation or maintenance inventory",
      value: snapshot.siteCount,
      detail: "All active sites in this property",
      icon: "⌂",
      tone: "green",
    },
    {
      id: "arrivals",
      label: "Arrivals in next 7 days",
      href: mayReadReservations ? `/workspaces/management/campgrounds/reservations${base}` : null,
      source: "Current authorized reservation desk snapshot (up to 250 rows)",
      value: snapshot.arrivalsThisWeek,
      detail: "From visible reservation rows (up to 250)",
      icon: "▦",
      tone: "blue",
    },
    {
      id: "work_orders",
      label: "Open work orders",
      href: mayReadMaintenance ? `/workspaces/maintenance/work-orders${base}` : null,
      source: "Current authorized maintenance work-order records",
      value: snapshot.openWorkOrders,
      detail: "Property maintenance queue",
      icon: "⚒",
      tone: "amber",
    },
    {
      id: "financial",
      label: "Financial review flags",
      href: mayReadReservations ? `/workspaces/management/campgrounds/reservations${base}` : null,
      source: "Reservation review indicators only; no payment action",
      value: snapshot.financialReviews,
      detail: "From visible reservation rows (up to 250)",
      icon: "◇",
      tone: "blue",
    },
  ];
  const metricPositions = new Map(
    (activeView?.kpiOrder ?? ["sites", "arrivals", "work_orders", "financial"])
      .map((key, index) => [key, index]),
  );
  const orderedKpis = [...kpis].sort(
    (a, b) => (metricPositions.get(a.id) ?? 99) - (metricPositions.get(b.id) ?? 99),
  );

  return (
    <AppShell>
      <div className={`page-stack camp-command command194-dashboard ${activeView?.density === "compact" ? "command194-dashboard--compact" : ""}`}>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management">Management</Link>
          <span aria-hidden="true">/</span>
          <span>Operations Command</span>
        </nav>

        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 194 · Personalized Operations Command</p>
          <h1>Campground Operations Command</h1>
          <p className="hero-panel__lead">
            Role-aware management, I.T., status and statistics with saved layout preferences.
            Every source metric is recalculated from the selected campground.
          </p>
          <div className="camp-command__hero-actions">
            <Link className="primary-link" href={`/booking/map${base}`}>
              View site map ↗
            </Link>
            <Link className="secondary-link" href="/settings/themes">
              Standard theme settings
            </Link>
          </div>
        </section>

        <section
          className="camp-command__scope"
          aria-label="Campground selection"
        >
          <form method="get" className="camp-command__scope-form">
            <label htmlFor="command-campground">Viewing campground</label>
            <select
              name="campground"
              id="command-campground"
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
            Read-only source snapshot · {snapshot.today}
          </span>
        </section>

        {params.commandNotice ? (
          <p className="ops-inline-note" role="status">{params.commandNotice}</p>
        ) : null}
        {savedViewResult.failed ? (
          <p className="ops-inline-note" role="alert">
            Layout storage is temporarily unavailable. The live campground cards below are read-only and remain permission-gated.
          </p>
        ) : null}
        {(reservationError || maintenanceError) ? (
          <p className="ops-inline-note" role="alert">
            One or more authorized source services could not be read. Missing values are shown as unavailable, not as zero.
          </p>
        ) : null}
        <section
          className="camp-command__kpis"
          aria-label="Campground overview"
        >
          {orderedKpis.map((item) => (
            <article
              className={`camp-command__kpi camp-command__kpi--${item.tone}`}
              key={item.label}
            >
              <span className="camp-command__kpi-icon" aria-hidden="true">
                {item.icon}
              </span>
              <div>
                <span>{item.label}</span>
                <strong>{count(item.value)}</strong>
                <small>
                  {item.value === null
                    ? "Source restricted or currently unavailable — not zero"
                    : item.detail}
                </small>
                <details className="command194-dashboard__inspector">
                  <summary>ⓘ Inspect source and drilldown</summary>
                  <p>{item.source}</p>
                  <p>Read at {snapshot.asOf} · {snapshot.reservationRowsCapped ? "Reservation preview bounded at 250 rows" : "Current authorized preview"}</p>
                  {item.href ? (
                    <Link href={item.href}>Open authorized source records ↗</Link>
                  ) : (
                    <span>Direct source access requires an additional campground role.</span>
                  )}
                </details>
              </div>
              <span className="camp-command__spark" aria-hidden="true" />
            </article>
          ))}
        </section>

        <div className="camp-command__columns">
          <section className="content-panel ops-detail-card">
            <div className="ops-section-heading">
              <div>
                <p className="eyebrow">Front desk / next seven days</p>
                <h2>Upcoming arrivals</h2>
              </div>
              {mayReadReservations ? (
                <Link
                  href={`/workspaces/management/campgrounds/reservations${base}`}
                >
                  Open reservations ↗
                </Link>
              ) : null}
            </div>
            {snapshot.recentArrivals.length ? (
              <ul className="camp-command__queue">
                {snapshot.recentArrivals.map((item) => (
                  <li key={item.id}>
                    <span className="camp-command__queue-icon">⌂</span>
                    <span>
                      <strong>
                        {item.site} · {item.label}
                      </strong>
                      <small>
                        {item.date} · {item.status.replaceAll("_", " ")}
                      </small>
                    </span>
                    <span className="camp-command__status camp-command__status--green">
                      Scheduled
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="camp-command__empty">
                {snapshot.reservationAvailable
                  ? "No arrivals in the next seven days within the visible reservation rows."
                  : availabilityMessage(
                      mayReadReservations,
                      reservationError,
                      snapshot.reservationAvailable,
                    )}
              </p>
            )}
            {snapshot.reservationRowsCapped ? (
              <p className="ops-inline-note">
                This read-only preview uses the first 250 reservation records,
                not an all-time booking total.
              </p>
            ) : null}
          </section>

          <section className="content-panel ops-detail-card">
            <div className="ops-section-heading">
              <div>
                <p className="eyebrow">Property / action queue</p>
                <h2>Maintenance attention</h2>
              </div>
              {mayReadMaintenance ? (
                <Link href={`/workspaces/maintenance/work-orders${base}`}>
                  All work orders ↗
                </Link>
              ) : null}
            </div>
            {snapshot.workOrderQueue.length ? (
              <ul className="camp-command__queue">
                {snapshot.workOrderQueue.map((item) => (
                  <li key={item.id}>
                    <span className="camp-command__queue-icon camp-command__queue-icon--amber">
                      ⚒
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.priority} priority</small>
                    </span>
                    <span
                      className={`camp-command__status ${item.status === "blocked" ? "camp-command__status--amber" : ""}`}
                    >
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="camp-command__empty">
                {snapshot.maintenanceAvailable
                  ? "There are no open maintenance work orders for this campground."
                  : availabilityMessage(
                      mayReadMaintenance,
                      maintenanceError,
                      snapshot.maintenanceAvailable,
                    )}
              </p>
            )}
            {snapshot.maintenanceAvailable ? (
              <div className="camp-command__progress">
                <span>Blocked / open maintenance work</span>
                <strong>
                  {snapshot.blockedWorkOrders} / {snapshot.openWorkOrders}
                </strong>
                <div
                  className="ops-progress-track"
                  role="progressbar"
                  aria-label="Blocked share of open work orders"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    snapshot.openWorkOrders
                      ? Math.round(
                          (100 * (snapshot.blockedWorkOrders ?? 0)) /
                            snapshot.openWorkOrders,
                        )
                      : 0
                  }
                >
                  <span
                    style={{
                      width: `${snapshot.openWorkOrders ? (100 * (snapshot.blockedWorkOrders ?? 0)) / snapshot.openWorkOrders : 0}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <ManagementModuleFinder
          modules={moduleCatalog}
          campgroundId={selected.campgroundId}
          savedViews={savedViews}
          activeView={activeView}
          preferencesAvailable={!savedViewResult.failed}
          sourceAsOf={snapshot.asOf}
        />

        <section className="content-panel ops-detail-card camp-command__safety">
          <div>
            <p className="eyebrow">I.T., billing & connection status</p>
            <h2>Safe release controls</h2>
            <p>
              Management metrics are property-scoped. Subscriber billing,
              subscriber agreement activation, and the independent Omnichannel
              gateway remain disabled until their separate evidence and
              owner-approval gates pass.
            </p>
          </div>
          <div className="camp-command__safety-list">
            <div>
              <span>Standard theme</span>
              <strong className="camp-command__status--green">Active</strong>
            </div>
            <div>
              <span>Subscription billing</span>
              <strong className="ops-text-hold">HELD · No charges</strong>
            </div>
            <div>
              <span>Subscriber agreement</span>
              <strong className="ops-text-hold">Not live-approved</strong>
            </div>
            <div>
              <span>Omnichannel connection</span>
              <strong className="ops-text-hold">DISCONNECTED / HOLD</strong>
            </div>
          </div>
          <div className="camp-command__safety-links">
            <Link href="/launch/subscriptions">
              Review subscriber readiness ↗
            </Link>
            <Link href="/integration/comms-hub">
              Review connection evidence ↗
            </Link>
            <Link href="/status">System health ↗</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
