import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { listAccommodations } from "@/lib/accommodations/postgres.mjs";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listCampgroundFulfillment } from "@/lib/booking-charges/fulfillment-postgres.mjs";
import { summarizeSiteWork285 } from "@/lib/build285/site-work.mjs";
import { listAssistanceQueue } from "@/lib/camper-assistance-triage/postgres.mjs";
import { getPublicBookingMapSnapshot } from "@/lib/public-booking-map/postgres.mjs";

import { SiteWorkMap } from "./site-work-map";
import { SiteWorkRefresh } from "./site-work-refresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campsite service monitor · iCamp",
  robots: { index: false, follow: false },
};

const path = "/workspaces/management/campgrounds/site-work";

export default async function SiteWorkPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ campground?: string }> }>) {
  const session = await requireStaff(path);
  const { campground } = await searchParams;
  if (!campground) redirect("/campground");
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campground,
  );
  const permissions = authorization?.permissions ?? [];
  if (
    !permissions.includes("campground.operations.manage") ||
    !permissions.includes("reservation.modify") ||
    !permissions.some((value) =>
      ["accommodation.read", "accommodation.manage"].includes(value),
    )
  )
    redirect("/auth/not-authorized");

  const assigned = await listAssignedCampgrounds(session.user.id);
  const selected = assigned.find((item) => item.campgroundId === campground);
  if (!selected) redirect("/auth/not-authorized");
  // Dates are needed by the existing public geometry source. Its booking
  // presentation is not used for this current-state work monitor.
  const arrivalDate = new Date().toISOString().slice(0, 10);
  const departureDate = new Date(Date.now() + 86400000)
    .toISOString()
    .slice(0, 10);
  const [sites, assistance, fulfillment, publication] =
    await Promise.allSettled([
      listAccommodations(session.user.id, campground),
      listAssistanceQueue(session.user.id, campground),
      listCampgroundFulfillment({
        userId: session.user.id,
        campgroundId: campground,
      }),
      getPublicBookingMapSnapshot({
        campgroundSlug: selected.campgroundSlug,
        arrivalDate,
        departureDate,
        kind: "all",
        availability: "all",
      }),
    ]);
  const jobs =
    fulfillment.status === "fulfilled" && !fulfillment.value.truncated
      ? fulfillment.value.jobs
      : null;
  const cases =
    assistance.status === "fulfilled" ? assistance.value.cases : null;
  const rows =
    sites.status === "fulfilled"
      ? summarizeSiteWork285(
          sites.value.filter((site) => site.lifecycleState === "active"),
          cases,
          jobs,
        )
      : null;
  const map =
    publication.status === "fulfilled" &&
    publication.value.campground.id === campground
      ? publication.value
      : null;
  const scoped = (route: string) =>
    `${route}?campground=${encodeURIComponent(campground)}`;
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel">
          <h1>{selected.campgroundName} · Campsite service monitor</h1>
          <p>
            Current authorized site list. Operating state, assistance and add-on
            work are independent; a completed job does not close a site or clear
            unrelated requests. This is not payment settlement or future-date
            booking availability. Review delivery location after a site move;
            this view does not reassign deliveries.
          </p>
          <p role="status">
            Server view rendered at {new Date().toISOString()}. Automatic
            refresh is a fallback, not a real-time delivery guarantee.
            Unavailable or truncated sources are unknown, never zero.
          </p>
          <SiteWorkRefresh />
          <AdminRefreshControl
            renderedAt={new Date().toISOString()}
            sectionKey="management.site-work285"
          />
          <p>
            <Link href={scoped("/workspaces/management/campgrounds/maps")}>
              Map publication
            </Link>
            {" · "}
            <Link href={scoped("/workspaces/management/campgrounds/status")}>
              Operating state and closures
            </Link>
          </p>
        </section>
        <section className="content-panel" aria-labelledby="map285">
          <h2 id="map285">Published campsite map</h2>
          {map && rows ? (
            <SiteWorkMap
              key={map.map.id}
              map={map.map}
              items={map.items}
              rows={rows}
            />
          ) : (
            <p role="status">
              A matching published map or site inventory is unavailable. Use the
              authorized list below; no geography is invented.
            </p>
          )}
        </section>
        <section className="content-panel" aria-labelledby="site-list285">
          <h2 id="site-list285">Campsites and accommodation</h2>
          {rows === null ? (
            <p role="alert">Site inventory unavailable. Refresh to retry.</p>
          ) : rows.length === 0 ? (
            <p>No active accommodations were returned for this campground.</p>
          ) : (
            <div className="account-directory286">
              {rows.map((site) => (
                <article
                  className="content-panel"
                  key={site.id}
                  id={`site-work-${site.id}`}
                >
                  <h3>
                    {site.code} · {site.name}
                  </h3>
                  <p>Operating state: {site.operatingState}</p>
                  <p>
                    <strong style={{ color: "#dc8d42" }}>
                      Open assistance: {site.assistance ?? "Unknown"}
                    </strong>
                  </p>
                  <p>
                    <strong style={{ color: "#b79be5" }}>
                      Open add-on work at reservation site:{" "}
                      {site.fulfillment ?? "Unknown"}
                    </strong>
                  </p>
                  <p>
                    <Link
                      href={scoped(
                        "/workspaces/management/campgrounds/assistance",
                      )}
                    >
                      Assistance queue
                    </Link>
                    {" · "}
                    <Link
                      href={scoped(
                        "/workspaces/management/campgrounds/service-fulfillment",
                      )}
                    >
                      Add-on fulfillment queue
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
