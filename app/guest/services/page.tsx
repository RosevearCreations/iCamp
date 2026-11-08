import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireSignedIn } from "@/lib/auth/current-session";
import {
  buildGuestServiceDirectory,
  guestServiceKindLabels,
} from "@/lib/guest-services/directory.mjs";
import { getMyStayDetail, listMyStays } from "@/lib/my-stay/postgres.mjs";
import { getPublicBookingMapSnapshot } from "@/lib/public-booking-map/postgres.mjs";

import styles from "./services.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campground services & wayfinding · iCamp",
  description:
    "Guest-only directory of staff-reviewed published campground amenity locations, with honest availability and accessibility guidance.",
  robots: { index: false, follow: false },
};

function unavailable(title: string, message: string) {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel" role="status">
          <h1>{title}</h1>
          <p>{message}</p>
          <p>
            <Link href="/guest/hub">Back to My Stay hub</Link> ·{" "}
            <Link href="/auth/account">Account</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}

export default async function GuestServicesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    reservation?: string;
    kind?: string;
    q?: string;
  }>;
}>) {
  if (!process.env.DATABASE_URL?.trim()) {
    return unavailable(
      "Campground directory is temporarily unavailable",
      "The live campground source is not connected. No facilities or operating status can be verified; contact the campground office for current information.",
    );
  }

  const session = await requireSignedIn("/guest/services");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  let stays;
  try {
    stays = await listMyStays({ userId: session.user.id });
  } catch {
    return unavailable(
      "Your stays could not be verified",
      "We could not read the live reservation source. Please retry later or contact the campground office.",
    );
  }

  const selected =
    stays.find((stay) => stay.id === params.reservation) ??
    stays.find((stay) => stay.status === "checked_in") ??
    stays.find((stay) => stay.status === "confirmed") ??
    stays[0] ??
    null;
  if (!selected) {
    return unavailable(
      "No guest reservation is linked to this account",
      "Choose a campground stay first. Facility details are not assumed for an account without a reservation.",
    );
  }

  let stay;
  try {
    stay = await getMyStayDetail({
      userId: session.user.id,
      reservationId: selected.id,
    });
  } catch {
    return unavailable(
      "Reservation details could not be verified",
      "We could not verify which campground this reservation belongs to. No facility records are shown.",
    );
  }
  if (!stay) {
    return unavailable(
      "Reservation is no longer available",
      "This reservation is not linked to your active guest account. No campground details were disclosed.",
    );
  }

  let snapshot = null;
  try {
    const published = await getPublicBookingMapSnapshot({
      campgroundSlug: stay.reservation.campground.slug,
      arrivalDate: stay.reservation.arrivalDate,
      departureDate: stay.reservation.departureDate,
      kind: "all",
      availability: "all",
    });
    // The guest-owned reservation determines the campground; a different map
    // identity must never be substituted just because it has public amenities.
    if (published.campground.id === stay.reservation.campground.id) {
      snapshot = published;
    }
  } catch {
    // Missing publication, offline source or temporary query failure is unknown,
    // never an empty authoritative list or permission to use a facility.
  }

  const directory = snapshot
    ? buildGuestServiceDirectory({
        wayfinding: snapshot.wayfinding,
        campgroundSlug: snapshot.campground.slug,
        arrivalDate: snapshot.arrivalDate,
        departureDate: snapshot.departureDate,
        filters: { kind: params.kind, query: params.q },
      })
    : null;
  const scoped = (path: string) =>
    `${path}?reservation=${encodeURIComponent(stay.reservation.id)}`;
  const canRequestAssistance = Boolean(
    stay.reservation.status === "checked_in" &&
    stay.checkIn?.checkedInAt &&
    !stay.checkOut?.checkedOutAt,
  );

  return (
    <AppShell>
      <div className={`page-stack ${styles.directory}`}>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href={scoped("/guest/hub")}>My Stay hub</Link>
          <span>/</span>
          <span>Campground services</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 227 · Campground services</p>
          <h1>Find campground facilities</h1>
          <p className="hero-panel__lead">
            Browse amenities that staff published on the campground map. These
            are location descriptions, not live opening hours, operating
            clearance, accessibility-route certification or entry permission.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href={scoped("/guest/stay")}>
              My Stay details
            </Link>
            <Link className="secondary-link" href={scoped("/guest/assistance")}>
              Assistance and existing cases
            </Link>
          </div>
        </section>

        <section className="content-panel">
          <div className={styles.context}>
            <div>
              <h2>{stay.reservation.campground.name}</h2>
              <p>
                {stay.reservation.accommodation.code} · stay from{" "}
                {stay.reservation.arrivalDate} to{" "}
                {stay.reservation.departureDate}
              </p>
            </div>
            <Link href={scoped("/guest/arrival-planner")}>
              Arrival instructions →
            </Link>
          </div>
          {stays.length > 1 ? (
            <nav aria-label="Choose a different reservation">
              <p>Other stays:</p>
              <ul>
                {stays.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/guest/services?reservation=${encodeURIComponent(item.id)}`}
                    >
                      {item.campgroundName} · {item.arrivalDate}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </section>

        {!directory ? (
          <section className="content-panel" role="status">
            <h2>Published facilities could not be verified</h2>
            <p>
              The current map and reviewed facility points are unavailable or
              not published for this campground. No facility is assumed open.
              Contact the office for current services, directions and accessible
              routes.
            </p>
          </section>
        ) : (
          <>
            <section className="content-panel">
              <div className={styles.context}>
                <div>
                  <h2>Published service directory</h2>
                  <p>
                    {directory.totalPublished} staff-reviewed location(s) on
                    published map version{" "}
                    {snapshot?.map.versionNumber ?? "unknown"}.
                  </p>
                </div>
                <Link href={directory.mapHref}>Open campground map →</Link>
              </div>
              <form method="get" className={styles.filters} role="search">
                <input
                  type="hidden"
                  name="reservation"
                  value={stay.reservation.id}
                />
                <label>
                  Search services or landmark notes
                  <input
                    name="q"
                    type="search"
                    maxLength={80}
                    defaultValue={directory.query}
                    placeholder="Pool, washroom, office…"
                  />
                </label>
                <label>
                  Amenity type
                  <select name="kind" defaultValue={directory.kind}>
                    <option value="all">All published types</option>
                    {Object.entries(guestServiceKindLabels).map(
                      ([kind, label]) => (
                        <option key={kind} value={kind}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button type="submit">Search</button>
              </form>
              <p className={styles.caution} role="status">
                Opening hours, closures, capacity and step-free routes are not
                certified by these map points. Check with the office before
                visiting a facility.
              </p>
            </section>

            {directory.items.length ? (
              <ul
                className={styles.cards}
                aria-label="Published campground amenities"
              >
                {directory.items.map((item) => (
                  <li className={styles.service} key={item.id}>
                    <span className={styles.kind}>{item.kindLabel}</span>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <p>
                      <strong>Accessibility details:</strong>{" "}
                      {item.accessibilityNote ??
                        "No accessibility information is published for this location."}
                    </p>
                    {item.landmarkHint ? (
                      <p>
                        <strong>Landmark note:</strong> {item.landmarkHint}
                      </p>
                    ) : null}
                    <p className={styles.unknown}>{item.availabilityLabel}</p>
                    <Link href={item.mapHref}>
                      Find this point on the map →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <section className="content-panel" role="status">
                <h2>No matching published services</h2>
                <p>
                  {directory.totalPublished === 0
                    ? "No staff-reviewed amenity points have been published for this campground map yet. Ask the office for current locations and facilities."
                    : "No published service matches this search. Clear the search or choose another amenity type."}
                </p>
              </section>
            )}
          </>
        )}

        <section className="content-panel">
          <h2>Need help on site?</h2>
          <p>
            {canRequestAssistance
              ? "Your check-in receipt is recorded. Use the guest assistance area for in-app requests and existing case updates; urgent requests are not emergency dispatch."
              : "New in-app assistance requests require a checked-in stay. Before check-in, ask the campground office for help with access, directions or availability."}
          </p>
          <div className={styles.footerLinks}>
            <Link href={scoped("/guest/assistance")}>Guest assistance →</Link>
            <Link href="/guest/rentals">
              Separately published rental offers →
            </Link>
            <Link href={scoped("/guest/stay")}>Rules and stay details →</Link>
          </div>
          <p>
            Rental offers are separate from this map directory; seeing a
            facility here does not create a rental hold, booking or access pass.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
