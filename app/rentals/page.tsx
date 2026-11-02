import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  normalizeRentalWindow,
  rentalAvailabilityLabel,
} from "@/lib/rental-planner/core.mjs";
import {
  listPublicRentalOffers,
  listRentalCampgrounds,
} from "@/lib/rental-planner/postgres.mjs";

import styles from "../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Amenities & rental planning · iCamp",
  description:
    "Verified campground amenities and equipment, with date-specific provisional planning capacity.",
};

export default async function PublicRentalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    kind?: string;
    start?: string;
    end?: string;
  }>;
}) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Rental planning temporarily unavailable</h1>
          <p>
            The live asset database is not connected. No date availability or
            rental can be verified. Ask the campground office for current
            options.
          </p>
        </section>
      </AppShell>
    );
  const params = await searchParams;
  let window;
  let error = false;
  try {
    window = normalizeRentalWindow({
      startDate: params.start,
      endDate: params.end,
    });
  } catch {
    window = null;
    error = true;
  }
  const [campgrounds, offers] = await Promise.all([
    listRentalCampgrounds(),
    error
      ? Promise.resolve([])
      : listPublicRentalOffers({
          campgroundSlug: params.campground,
          kind: params.kind,
          startDate: window?.startDate,
          endDate: window?.endDate,
        }),
  ]);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <span>Amenities & rental planning</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 182 · Campground rentals</p>
          <h1>Plan equipment and amenity time</h1>
          <p className="hero-panel__lead">
            Browse items that campgrounds have explicitly reviewed for rental
            planning. Choose dates to check provisional availability against
            existing requests. No payment, reservation change, held equipment or
            guaranteed allocation happens here.
          </p>
          <div className="hero-actions">
            <Link href="/guest/rentals" className="primary-link">
              My rental plans
            </Link>
            <Link href="/events" className="secondary-link">
              Events & recreation
            </Link>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Source-backed availability"
            title="Choose your dates"
            id="rental-filters"
            helpTopic="shell.overview"
          />
          <p>
            Pickup and return dates are both inclusive campground-local calendar
            days (maximum 14 days). The asset must be operational when staff
            review or accept a request.
          </p>
          <form method="get" role="search" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={params.campground ?? ""}>
                <option value="">All campgrounds</option>
                {campgrounds.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select name="kind" defaultValue={params.kind ?? ""}>
                <option value="">All types</option>
                <option value="equipment">Equipment</option>
                <option value="facility">Amenities</option>
              </select>
            </label>
            <label>
              Pickup date
              <input
                type="date"
                name="start"
                defaultValue={params.start ?? ""}
              />
            </label>
            <label>
              Return date
              <input type="date" name="end" defaultValue={params.end ?? ""} />
            </label>
            <button type="submit" className="primary-button">
              Check planning capacity
            </button>
          </form>
          {error ? (
            <p role="alert" className={styles.warning}>
              Enter valid pickup and return dates, together, for 1–14 inclusive
              days.
            </p>
          ) : null}
        </section>
        <section className="content-panel" aria-live="polite">
          <SectionHeading
            eyebrow="Staff-reviewed catalog"
            title={`${offers.length} listed item${offers.length === 1 ? "" : "s"}`}
            id="rental-results"
            helpTopic="shell.overview"
          />
          {offers.length === 0 ? (
            <p>
              No rental planning items are published for these filters. This
              does not mean the campground has no amenities; ask staff for
              current options.
            </p>
          ) : (
            <div className={styles.cards}>
              {offers.map((offer) => (
                <article className={styles.card} key={offer.id}>
                  <p className={styles.tag}>
                    {offer.assetClass === "facility" ? "Amenity" : "Equipment"}{" "}
                    · {offer.campgroundName}
                  </p>
                  <h3>{offer.assetName}</h3>
                  <p>{offer.description}</p>
                  <dl className={styles.details}>
                    <div>
                      <dt>Verified source</dt>
                      <dd>
                        {offer.assetCode} ·{" "}
                        {offer.itemType.replaceAll("_", " ")}
                      </dd>
                    </div>
                    <div>
                      <dt>Accessibility</dt>
                      <dd>
                        {offer.accessibilityNote ||
                          "No accessibility details supplied; ask the campground office before relying on access."}
                      </dd>
                    </div>
                    <div>
                      <dt>Pickup and return guidance</dt>
                      <dd>
                        {offer.returnGuidance ||
                          "Ask campground staff for collection and return arrangements."}
                      </dd>
                    </div>
                    <div>
                      <dt>Maximum planning window</dt>
                      <dd>{offer.maxDays} inclusive days</dd>
                    </div>
                    <div>
                      <dt>Date-specific planning availability</dt>
                      <dd>{rentalAvailabilityLabel(offer, window)}</dd>
                    </div>
                  </dl>
                  {window &&
                  offer.sourceReady &&
                  offer.acceptingRequests &&
                  offer.available &&
                  window.startDate >= offer.localDate &&
                  window.days <= offer.maxDays ? (
                    <Link
                      className="primary-link"
                      href={`/guest/rentals?offer=${encodeURIComponent(offer.id)}&start=${window.startDate}&end=${window.endDate}`}
                    >
                      Request a planning slot
                    </Link>
                  ) : (
                    <p>
                      Ask the campground office for alternatives or choose
                      different dates.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <p>
            <strong>Planning only:</strong> Availability is one provisional
            request slot per physical asset, not an equipment handover,
            admission, secured inventory hold, payment quote, or approval.
            Billing and outbound messaging remain HELD.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
