import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  getPublicBookingMapSnapshot,
  listPublishedBookingCampgrounds,
} from "@/lib/public-booking-map/postgres.mjs";

import { PublicBookingMap } from "./booking-map";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interactive booking map · iCamp",
  description:
    "Explore published campground accommodation polygons by dates, type and live availability.",
  robots: { index: false, follow: true },
};

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

export default async function PublicBookingMapPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | undefined>>;
}>) {
  const params = await searchParams;
  const campgrounds = await listPublishedBookingCampgrounds();

  if (campgrounds.length === 0) {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="hero-panel">
            <p className="eyebrow">Booking discovery</p>
            <h1>Interactive booking map</h1>
            <p className="hero-panel__lead">
              No campground has a published booking map yet.
            </p>
          </section>
          <section className="content-panel">
            <Link href="/workspaces/public">Return to Public & Visitor</Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const selected =
    campgrounds.find((campground) => campground.slug === params.campground) ??
    campgrounds[0];
  const arrivalDate = params.arrivalDate ?? isoDate(0);
  const departureDate = params.departureDate ?? isoDate(1);
  const kind = params.kind ?? "all";
  const availability = params.availability ?? "all";

  const snapshot = await getPublicBookingMapSnapshot({
    campgroundSlug: selected.slug,
    arrivalDate,
    departureDate,
    kind,
    availability,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/public">Public & Visitor</Link>
          <span>/</span>
          <span>Booking map</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 037 · Live booking discovery</p>
          <h1>Choose your campsite or cottage on the map</h1>
          <p className="hero-panel__lead">
            Search by dates and accommodation type. Colors are derived from the
            same server-authoritative availability used by campground staff.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="booking-filter-title">
          <SectionHeading
            eyebrow="Dates & filters"
            title="Find accommodation"
            id="booking-filter-title"
            helpTopic="shell.overview"
          />
          <form method="get" className="form-grid">
            <label>
              Campground
              <select name="campground" defaultValue={snapshot.campground.slug}>
                {campgrounds.map((campground) => (
                  <option key={campground.id} value={campground.slug}>
                    {campground.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Arrival
              <input
                type="date"
                name="arrivalDate"
                defaultValue={snapshot.arrivalDate}
                required
              />
            </label>
            <label>
              Departure
              <input
                type="date"
                name="departureDate"
                defaultValue={snapshot.departureDate}
                required
              />
            </label>
            <label>
              Accommodation
              <select name="kind" defaultValue={snapshot.kind}>
                <option value="all">All types</option>
                <option value="campsite">Campsites</option>
                <option value="cottage">Cottages</option>
                <option value="permanent_unit">Permanent units</option>
              </select>
            </label>
            <label>
              Availability
              <select name="availability" defaultValue={snapshot.availability}>
                <option value="all">Show all</option>
                <option value="available">Available only</option>
              </select>
            </label>
            <button type="submit">Update booking map</button>
          </form>
          <p>
            <a href="#booking-map-list">Skip map and use the accessible list</a>
          </p>
        </section>

        <section className="content-panel" aria-labelledby="booking-map-title">
          <SectionHeading
            eyebrow={snapshot.campground.name}
            title="Interactive booking map"
            id="booking-map-title"
            helpTopic="shell.overview"
            trailing={
              <span className="build-chip">
                Published map v{snapshot.map.versionNumber}
              </span>
            }
          />
          <PublicBookingMap
            mediaAssetId={snapshot.map.mediaAssetId}
            sourceWidth={snapshot.map.sourceWidth}
            sourceHeight={snapshot.map.sourceHeight}
            items={snapshot.items}
          />
          <p>
            Availability generated <time>{snapshot.generatedAt}</time>. A page
            refresh re-reads reservations, active temporary holds, management
            restrictions, turnover and seasonal assignments.
          </p>
        </section>

        <section
          className="content-panel"
          id="booking-map-list"
          aria-labelledby="booking-list-title"
        >
          <SectionHeading
            eyebrow="Accessible alternative"
            title="Accommodation list"
            id="booking-list-title"
            helpTopic="shell.overview"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Accommodation</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Booking state</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.items.map((item) => (
                  <tr
                    key={item.accommodationId}
                    id={`booking-map-list-${item.accommodationId}`}
                  >
                    <td>
                      {item.code} · {item.displayName}
                    </td>
                    <td>{item.accommodationKind.replaceAll("_", " ")}</td>
                    <td>{item.label}</td>
                    <td>
                      {item.selectable
                        ? "Selectable for these dates"
                        : "Not selectable for these dates"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {snapshot.items.length === 0 ? (
            <p>No published accommodations match the selected filters.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full visual map plus accessible list.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> the map is graphical-only; future booking
            flows read the same authoritative date/type availability and identify
            accommodations by code, with staff transfer when needed.
          </p>
          <p>
            <strong>SMS/MMS:</strong> future guided booking can return matching
            accommodation codes and a secure visual handoff to this map without
            creating a separate availability source.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
