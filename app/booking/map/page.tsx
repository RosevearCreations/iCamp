import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { BookingJourney } from "@/components/booking-journey";
import { SectionHeading } from "@/components/section-heading";
import { filterPublicDiscoveryItems } from "@/lib/public-booking-map/discovery.mjs";
import {
  getPublicBookingMapSnapshot,
  listPublishedBookingCampgrounds,
} from "@/lib/public-booking-map/postgres.mjs";
import { parsePublicBookingSearch } from "@/lib/public-booking-map/search.mjs";

import { DiscoveryResults } from "./discovery-results";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accessible campsite and cottage discovery · iCamp",
  description:
    "Explore live availability, accessibility, pet and RV fit, amenities, photos and saved three-way accommodation comparisons.",
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
  // Deployment may intentionally lack private DB credentials. Never guess availability.
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="hero-panel" role="status" aria-live="polite">
            <p className="eyebrow">Build 173 · Live source unavailable</p>
            <h1>Booking discovery is temporarily unavailable</h1>
            <p className="hero-panel__lead">
              We cannot verify campsite or cottage availability right now. No
              accommodations will be shown as available, and no comparison, hold
              or booking has been created.
            </p>
          </section>
          <section className="content-panel">
            <h2>What you can do</h2>
            <p>
              Please contact the campground office for current dates, site fit,
              accessibility arrangements and pet or vehicle restrictions. Return
              here later to search live inventory and compare stays.
            </p>
            <Link href="/workspaces/public">
              Return to Public &amp; Visitor
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }
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
  const search = parsePublicBookingSearch(params, {
    arrivalDate: isoDate(0),
    departureDate: isoDate(1),
  });

  if (!search.ok) {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="hero-panel">
            <p className="eyebrow">Accommodation search</p>
            <h1>Let’s fix your search</h1>
            <p className="hero-panel__lead" role="alert">
              {search.message} No availability lookup or reservation was made.
            </p>
          </section>
          <section
            className="content-panel"
            aria-labelledby="retry-dates-title"
          >
            <h2 id="retry-dates-title">Try different dates</h2>
            <form method="get" className="form-grid">
              <input type="hidden" name="campground" value={selected.slug} />
              <label>
                Arrival date
                <input
                  type="date"
                  name="arrivalDate"
                  defaultValue={isoDate(0)}
                  required
                />
              </label>
              <label>
                Departure date
                <input
                  type="date"
                  name="departureDate"
                  defaultValue={isoDate(1)}
                  required
                />
              </label>
              <button type="submit">Search available stays</button>
            </form>
            <p>
              Advanced filters have been reset. We will check availability only
              after the dates are valid.
            </p>
            <Link href="/workspaces/public">
              Back to campground exploration
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const { mapFilters, discoveryFilters } = search;
  const { arrivalDate, departureDate, availability } = mapFilters;

  const snapshot = await getPublicBookingMapSnapshot({
    campgroundSlug: selected.slug,
    arrivalDate,
    departureDate,
    kind: "all",
    availability: "all",
  });
  const discoveryMatches = filterPublicDiscoveryItems(
    snapshot.items,
    discoveryFilters,
  ).filter(
    (item) =>
      mapFilters.kind === "all" || item.accommodationKind === mapFilters.kind,
  );
  const visibleItems =
    mapFilters.availability === "available"
      ? discoveryMatches.filter((item) => item.selectable)
      : discoveryMatches;

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
          <p className="eyebrow">
            Build 180 · Accessible discovery, wayfinding and comparison
          </p>
          <h1>Find and compare your campsite or cottage</h1>
          <p className="hero-panel__lead">
            Search published accommodations by date, fit, campground-advertised
            accessibility, amenities and photos. Compare up to three side by
            side, using the same live availability as campground staff. Browse
            reviewed amenity points and landmark notes without assuming a
            verified route or step-free path.
          </p>
        </section>

        <BookingJourney current="discover" mapHref="/booking/map" />

        <section
          className="content-panel"
          aria-labelledby="booking-filter-title"
        >
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
                <option value="rental_cottage">Cottages</option>
                <option value="permanent_unit">Permanent units</option>
              </select>
            </label>
            <label>
              Availability
              <select name="availability" defaultValue={availability}>
                <option value="all">Show all</option>
                <option value="available">Available only</option>
              </select>
            </label>
            <label>
              Campsite type
              <select
                name="campsiteType"
                defaultValue={discoveryFilters.campsiteType}
              >
                <option value="all">Any / include cottages</option>
                <option value="tent">Tent site</option>
                <option value="rv">RV site</option>
                <option value="mixed">Mixed tent / RV site</option>
              </select>
            </label>
            <label>
              Advertised access feature
              <select
                name="accessibility"
                defaultValue={discoveryFilters.accessibility}
              >
                <option value="all">No accessibility filter</option>
                <option value="advertised_site">
                  Campground-advertised accessible campsite
                </option>
                <option value="step_free">Cottage with step-free access</option>
                <option value="accessible_washroom">
                  Cottage with accessible washroom
                </option>
              </select>
            </label>
            <label>
              Amenities
              <select name="amenity" defaultValue={discoveryFilters.amenity}>
                <option value="all">Any amenities</option>
                <option value="waterfront">Waterfront</option>
                <option value="wifi">Wi-Fi (shared or on-site)</option>
                <option value="electric">Electrical service</option>
                <option value="fire_ring">Fire ring</option>
                <option value="picnic_table">Picnic table</option>
              </select>
            </label>
            <label>
              Published photos
              <select name="photos" defaultValue={discoveryFilters.photos}>
                <option value="all">Any photo coverage</option>
                <option value="with_photos">At least one photo</option>
                <option value="described">
                  At least one photo with alt text
                </option>
              </select>
            </label>
            <label>
              Cottage guests (1–80; 0 = any)
              <input
                type="number"
                name="guests"
                min={0}
                max={80}
                step={1}
                defaultValue={discoveryFilters.guests}
              />
            </label>
            <label>
              Pets (1–20; 0 = any)
              <input
                type="number"
                name="pets"
                min={0}
                max={20}
                step={1}
                defaultValue={discoveryFilters.pets}
              />
            </label>
            <label>
              RV length in meters (0 = any)
              <input
                type="number"
                name="rvLengthMeters"
                min={0}
                max={80}
                step="0.01"
                defaultValue={discoveryFilters.rvLengthMeters}
              />
            </label>
            <button type="submit">Apply discovery filters</button>
          </form>
          <p>
            <strong>ⓘ Evidence and fit:</strong> Accessibility flags are
            campground-advertised, not independent certifications. A missing
            maximum occupancy or RV length does not match a specific
            requirement. Campsite guest occupancy is not yet represented in the
            inventory, so the guests filter only returns cottages with a
            documented limit. Check critical access, pet and vehicle needs
            directly with staff.
          </p>
          <p>
            <a href="#booking-map-list">Skip map and use the accessible list</a>
          </p>
        </section>

        <DiscoveryResults
          allItems={snapshot.items}
          visibleItems={visibleItems}
          map={snapshot.map}
          context={{
            campgroundSlug: snapshot.campground.slug,
            arrivalDate: snapshot.arrivalDate,
            departureDate: snapshot.departureDate,
          }}
          generatedAt={snapshot.generatedAt}
          wayfinding={snapshot.wayfinding}
        />

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full visual map plus accessible list.
          </p>
          <p>
            <strong>Staff-assisted / nonvisual:</strong> the synchronized list
            and comparison table provide keyboard/screen-reader equivalents.
            Staff can use accommodation codes for voice-assisted selection.
            External IVR/DTMF remains HELD.
          </p>
          <p>
            <strong>SMS/MMS:</strong> a future provider-approved adapter could
            use this same availability source. External messaging remains HELD.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
