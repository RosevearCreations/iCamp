import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { getPublicAccommodationDetail } from "@/lib/public-accommodation-detail/postgres.mjs";

import styles from "./detail.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accommodation detail · iCamp",
  description:
    "Review campsite or cottage features, rules, gallery, availability and map context before continuing a booking.",
  robots: { index: false, follow: true },
};

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

export default async function PublicAccommodationDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ accommodationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}>) {
  const [{ accommodationId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const campgroundSlug = query.campground ?? "";
  const arrivalDate = query.arrivalDate ?? isoDate(0);
  const departureDate = query.departureDate ?? isoDate(1);

  let detail = null;
  try {
    detail = await getPublicAccommodationDetail({
      campgroundSlug,
      accommodationId,
      arrivalDate,
      departureDate,
    });
  } catch {
    detail = null;
  }

  if (!detail) notFound();

  const mapHref =
    `/booking/map?campground=${encodeURIComponent(detail.campground.slug)}` +
    `&arrivalDate=${encodeURIComponent(detail.dates.arrivalDate)}` +
    `&departureDate=${encodeURIComponent(detail.dates.departureDate)}`;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/public">Public & Visitor</Link>
          <span>/</span>
          <Link href={mapHref}>Booking map</Link>
          <span>/</span>
          <span>{detail.accommodation.code}</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">
            Build 038 · Campsite & cottage booking detail
          </p>
          <h1>
            {detail.accommodation.code} · {detail.accommodation.displayName}
          </h1>
          <p className="hero-panel__lead">
            {detail.accommodation.kind === "rental_cottage"
              ? "Rental cottage"
              : "Campsite"}
            {detail.accommodation.sectionName
              ? ` · ${detail.accommodation.sectionName}`
              : ""}
            {" · "}
            {detail.dates.nights}{" "}
            {detail.dates.nights === 1 ? "night" : "nights"}
          </p>
        </section>

        <section className={styles.heroGrid} aria-label="Booking readiness">
          <div className="content-panel">
            <SectionHeading
              eyebrow="Live availability"
              title={detail.availability.label}
              id="availability-heading"
              helpTopic="shell.overview"
            />
            <div className={styles.status}>
              <p>
                <strong>
                  {detail.availability.selectable
                    ? "Available for the selected dates."
                    : "Not selectable for the selected dates."}
                </strong>
              </p>
              <p>
                {detail.dates.arrivalDate} to {detail.dates.departureDate}
              </p>
              {detail.availability.blockers.length > 0 ? (
                <p>
                  Current blocker:{" "}
                  {detail.availability.blockers.join(", ").replaceAll("_", " ")}
                  .
                </p>
              ) : null}
            </div>
          </div>

          <div className="content-panel">
            <SectionHeading
              eyebrow="Rate summary"
              title={detail.rateSummary.label}
              id="rate-summary-heading"
              helpTopic="shell.overview"
            />
            <p>{detail.rateSummary.detail}</p>
            <p>
              This page does not invent a placeholder price or client-side
              quote.
            </p>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="gallery-heading">
          <SectionHeading
            eyebrow="Guest-facing photography"
            title="Site / cottage gallery"
            id="gallery-heading"
            helpTopic="shell.overview"
          />
          {detail.gallery.length > 0 ? (
            <div className={styles.gallery}>
              {detail.gallery.map((image) => (
                <figure key={image.id}>
                  {image.url ? (
                    <img src={image.url} alt={image.altText} />
                  ) : (
                    <div className={styles.status}>
                      Image temporarily unavailable.
                    </div>
                  )}
                  {image.caption ? (
                    <figcaption>{image.caption}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <p>
              No public gallery images have been published for this
              accommodation.
            </p>
          )}
        </section>

        <section className="content-panel" aria-labelledby="features-heading">
          <SectionHeading
            eyebrow={
              detail.accommodation.kind === "rental_cottage"
                ? "Cottage-specific details"
                : "Campsite features"
            }
            title="Features"
            id="features-heading"
            helpTopic="shell.overview"
          />
          <dl className={styles.facts}>
            {detail.facts.map((fact) => (
              <div key={fact.label} className={styles.fact}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="content-panel" aria-labelledby="rules-heading">
          <SectionHeading
            eyebrow="Booking rules"
            title="Rules for this stay"
            id="rules-heading"
            helpTopic="shell.overview"
          />
          <dl className={styles.facts}>
            {detail.rules.map((rule) => (
              <div key={rule.label} className={styles.fact}>
                <dt>{rule.label}</dt>
                <dd>{rule.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="content-panel"
          aria-labelledby="map-context-heading"
        >
          <SectionHeading
            eyebrow={`Published map v${detail.mapContext.versionNumber}`}
            title="Map context & nearby amenities"
            id="map-context-heading"
            helpTopic="shell.overview"
          />
          <p>
            {detail.mapContext.sectionName
              ? `This accommodation is in ${detail.mapContext.sectionName}.`
              : "This accommodation is attached to the currently published campground map."}
          </p>
          {detail.mapContext.nearbyAmenities.length > 0 ? (
            <ul>
              {detail.mapContext.nearbyAmenities.map((amenity) => (
                <li key={amenity.code}>
                  <strong>{amenity.displayName}</strong>
                  {" · "}
                  {amenity.kind.replaceAll("_", " ")}
                  {amenity.sameSection ? " · same section" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No guest amenity map objects are published yet.</p>
          )}
          <p>
            <Link href={mapHref}>Return to the live booking map →</Link>
          </p>
        </section>

        <section className="content-panel" aria-labelledby="continue-heading">
          <SectionHeading
            eyebrow="Booking handoff"
            title="Continue from verified details"
            id="continue-heading"
            helpTopic="shell.overview"
          />
          <div className={styles.actions}>
            <Link href={mapHref}>Choose a different accommodation</Link>
          </div>
          <p>
            Build 038 preserves Build 036 atomic hold authority, Build 039 pricing
            ownership and Build 041 checkout ownership. A reservation is not
            created from unpriced client-side data.
          </p>
        </section>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full gallery, feature, rule, availability,
            rate-status and map-context experience.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> the same canonical campsite/cottage facts,
            dates and availability can be read concisely by accommodation code;
            gallery and map context use staff or secure-link handoff.
          </p>
          <p>
            <strong>SMS/MMS:</strong> the same canonical facts and availability
            can be summarized with a secure link back to this visual detail page.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
