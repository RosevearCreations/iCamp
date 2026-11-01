import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { getPublicAccommodationDetail } from "@/lib/public-accommodation-detail/postgres.mjs";
import { parsePublicQuoteSelections } from "@/lib/public-accommodation-detail/quote-preview.mjs";

import { startReservationCheckoutAction } from "./checkout/actions";
import { saveBookingDraftAction } from "@/app/guest/booking-drafts/actions";
import { QuoteSummary } from "./quote-summary";
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
  let selections: Array<{ code: string; quantity: number }> = [];
  let inputError: string | null = null;
  try {
    selections = parsePublicQuoteSelections(query);
  } catch {
    inputError =
      "Invalid or repeated add-on selection. Review the available options and reprice.";
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Live accommodation pricing is temporarily unavailable</h1>
          <p>
            We cannot verify current dates, charges or policies. No quote or
            reservation was created. Please ask the campground office for an
            up-to-date price.
          </p>
          <Link href="/booking/map">Return to booking discovery</Link>
        </section>
      </AppShell>
    );
  }

  let detail = null;
  try {
    detail = await getPublicAccommodationDetail({
      campgroundSlug,
      accommodationId,
      arrivalDate,
      departureDate,
      selections,
    });
  } catch {
    detail = null;
  }

  if (!detail) notFound();

  const mapHref =
    `/booking/map?campground=${encodeURIComponent(detail.campground.slug)}` +
    `&arrivalDate=${encodeURIComponent(detail.dates.arrivalDate)}` +
    `&departureDate=${encodeURIComponent(detail.dates.departureDate)}`;
  const checkoutReady =
    detail.availability.selectable && detail.rateSummary.status === "quoted";
  const checkoutError = query.checkoutError
    ? "Checkout could not start because the selected accommodation or dates are no longer available."
    : null;
  const draftError =
    query.draftError === "consent"
      ? "Please explicitly agree to save these selections to your account."
      : query.draftError === "stale"
        ? "These saved options changed; reprice the stay and try again."
        : query.draftError
          ? "We could not save your draft. No reservation or hold was created."
          : null;
  const quoteQuery = new URLSearchParams({
    campground: detail.campground.slug,
    arrivalDate: detail.dates.arrivalDate,
    departureDate: detail.dates.departureDate,
  });
  selections.forEach((selection, index) => {
    quoteQuery.set(`extra${index + 1}`, selection.code);
    quoteQuery.set(`quantity${index + 1}`, String(selection.quantity));
  });
  const printHref = `/booking/accommodations/${encodeURIComponent(detail.accommodation.id)}/quote/print?${quoteQuery.toString()}`;
  const optionalCharges = detail.bookingCharges.items.filter(
    (item) => item.applicationMode === "optional",
  );

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

        <section
          className="content-panel"
          aria-labelledby="quote-preview-heading"
        >
          <SectionHeading
            eyebrow="Build 174 · Expiring, source-grounded preview"
            title="Transparent stay price, extras and policies"
            id="quote-preview-heading"
            helpTopic="shell.overview"
          />
          <p>
            Choose up to three optional add-ons or passes to get a fresh
            server-priced comparison. Mandatory campground fees are always
            included; unconfigured taxes are never silently set to zero. These
            choices are for this preview only; select them again during
            checkout, where the server recalculates the final eligible items.
          </p>
          <form
            method="get"
            className="form-grid"
            aria-label="Reprice selected optional charges"
          >
            <input
              type="hidden"
              name="campground"
              value={detail.campground.slug}
            />
            <input
              type="hidden"
              name="arrivalDate"
              value={detail.dates.arrivalDate}
            />
            <input
              type="hidden"
              name="departureDate"
              value={detail.dates.departureDate}
            />
            {[1, 2, 3].map((index) => (
              <div key={index}>
                <label>
                  Optional extra {index}
                  <select
                    name={`extra${index}`}
                    defaultValue={selections[index - 1]?.code ?? ""}
                  >
                    <option value="">No extra</option>
                    {optionalCharges.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.displayName} · {item.priceLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity for extra {index}
                  <input
                    name={`quantity${index}`}
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    defaultValue={selections[index - 1]?.quantity ?? 1}
                  />
                </label>
              </div>
            ))}
            <button type="submit">Recalculate server quote</button>
          </form>
          {inputError || detail.selectionError ? (
            <p role="alert" className="form-message form-message--error">
              {inputError ?? detail.selectionError}
            </p>
          ) : null}
          <p>
            <Link href={printHref}>
              Open a fresh, printable / staff-assisted quote summary
            </Link>
          </p>
          <QuoteSummary quote={detail.quotePreview} />
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
              Dynamic date price is calculated server-side from the canonical
              rate plan and matching weekend, holiday, season, event or
              promotional rules. No placeholder or client-side price is used.
            </p>
            {detail.rateSummary.adjustments.length > 0 ? (
              <p>
                Applied adjustments:{" "}
                {detail.rateSummary.adjustments
                  .map((adjustment) => adjustment.displayName)
                  .join(", ")}
                .
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="booking-charges-heading"
        >
          <SectionHeading
            eyebrow="Build 040 · Canonical booking charges"
            title="Optional extras, passes & service fees"
            id="booking-charges-heading"
            helpTopic="shell.overview"
          />
          <p>
            Prices below come from the server-authoritative campground charge
            catalogue. Optional items are not added to a reservation until Build
            041 checkout.
          </p>
          {detail.bookingCharges.items.length > 0 ? (
            <ul>
              {detail.bookingCharges.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.displayName}</strong>
                  {" · "}
                  {item.priceLabel}
                  {" · "}
                  {item.applicationMode === "automatic"
                    ? "Automatic service fee"
                    : item.chargeKind === "pass"
                      ? `Optional ${item.passDurationDays}-day pass`
                      : "Optional add-on"}
                  {item.description ? ` · ${item.description}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No public add-ons, visitor passes or service fees are currently
              configured.
            </p>
          )}
          {detail.bookingCharges.automaticTotalCents !== null ? (
            <p>
              <strong>Automatic service fees:</strong>{" "}
              {new Intl.NumberFormat("en-CA", {
                style: "currency",
                currency: detail.bookingCharges.currencyCode,
              }).format(detail.bookingCharges.automaticTotalCents / 100)}
              {detail.bookingCharges.estimatedTotalCents !== null
                ? ` · Stay plus automatic fees: ${new Intl.NumberFormat(
                    "en-CA",
                    {
                      style: "currency",
                      currency: detail.bookingCharges.currencyCode,
                    },
                  ).format(detail.bookingCharges.estimatedTotalCents / 100)}`
                : ""}
            </p>
          ) : null}
          <p>
            Tax and fee category codes are retained for later finance
            configuration; Build 040 does not invent tax rates.
          </p>
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
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Build 028 already provides optimized public variants. */}
                      <img src={image.url} alt={image.altText} />
                    </>
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
            eyebrow="Build 041 · Reservation checkout"
            title="Continue from verified details"
            id="continue-heading"
            helpTopic="shell.overview"
          />
          {checkoutError ? (
            <p className="form-message form-message--error" role="alert">
              {checkoutError}
            </p>
          ) : null}
          {checkoutReady ? (
            <form action={startReservationCheckoutAction}>
              <input
                type="hidden"
                name="campgroundSlug"
                value={detail.campground.slug}
              />
              <input
                type="hidden"
                name="accommodationId"
                value={detail.accommodation.id}
              />
              <input
                type="hidden"
                name="arrivalDate"
                value={detail.dates.arrivalDate}
              />
              <input
                type="hidden"
                name="departureDate"
                value={detail.dates.departureDate}
              />
              <button className="primary-button" type="submit">
                Continue to reservation checkout
              </button>
            </form>
          ) : (
            <p>
              Checkout is unavailable until the selected dates are live
              selectable and a current server-authoritative rate is available.
            </p>
          )}
          <div className={styles.actions}>
            <Link href={mapHref}>Choose a different accommodation</Link>
          </div>
          <p data-checkout-contract="Build 041 checkout ownership">
            Continuing creates or reuses an owner-bound temporary hold. Build
            041 revalidates dates, availability, capacity, compatibility,
            selected add-ons and the final server quote before creating a
            pending reservation. No payment is captured until Build 042.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="draft-save-heading">
          <SectionHeading
            eyebrow="Build 175 · Private, seven-day recovery"
            title="Save this booking draft for later"
            id="draft-save-heading"
            helpTopic="shell.overview"
          />
          <p>
            Save these dates and optional extras to your iCamp guest account,
            then sign in on a phone, tablet or another device to resume. Your
            choices expire after seven days. Reopening checks fresh inventory,
            rates, fees and policies. It never places a hold, makes a
            reservation or charges you.
          </p>
          {draftError ? (
            <p className="form-message form-message--error" role="alert">
              {draftError}
            </p>
          ) : null}
          {!inputError && !detail.selectionError ? (
            <form action={saveBookingDraftAction} className="form-grid">
              <input
                type="hidden"
                name="campgroundSlug"
                value={detail.campground.slug}
              />
              <input
                type="hidden"
                name="accommodationId"
                value={detail.accommodation.id}
              />
              <input
                type="hidden"
                name="arrivalDate"
                value={detail.dates.arrivalDate}
              />
              <input
                type="hidden"
                name="departureDate"
                value={detail.dates.departureDate}
              />
              {selections.map((selection, index) => (
                <div key={selection.code}>
                  <input
                    type="hidden"
                    name={`extra${index + 1}`}
                    value={selection.code}
                  />
                  <input
                    type="hidden"
                    name={`quantity${index + 1}`}
                    value={selection.quantity}
                  />
                </div>
              ))}
              <label>
                <input type="checkbox" name="saveConsent" required /> I agree to
                save these selections privately for seven days. I can delete
                them at any time.
              </label>
              <button type="submit" className="primary-button">
                Save my draft
              </button>
            </form>
          ) : (
            <p>Reprice invalid extras before saving a draft.</p>
          )}
          <p>
            <Link href="/guest/booking-drafts">
              View or delete my saved booking drafts
            </Link>
          </p>
          <p>
            No recovery link is emailed or texted. Billing and automated
            Omnichannel delivery remain HELD / DISCONNECTED. Staff can assist
            with a fresh printed quote.
          </p>
        </section>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full gallery, feature, rule, availability,
            dynamic-price, add-on/pass/service-fee and map-context experience.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> provider-gated and HELD. Staff may read
            the same sourced quote and policy preview by accommodation code; no
            automated call or payment is activated.
          </p>
          <p>
            <strong>SMS/MMS:</strong> provider-gated and HELD. A printable
            office-assisted view is available without outbound messaging.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
