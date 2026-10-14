import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getReservationCheckout } from "@/lib/reservation-checkout/postgres.mjs";

import { finalizeReservationCheckoutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservation checkout · iCamp",
  description:
    "Complete guest details, party counts, rule acknowledgement and add-ons before creating a pending reservation.",
  robots: { index: false, follow: false },
};

function checkoutErrorMessage(code: string) {
  if (code === "ICAMP_CHECKOUT_HOLD_EXPIRED") {
    return "Your temporary hold expired. Return to the booking map and select the accommodation again.";
  }
  if (code === "ICAMP_CHECKOUT_DATE_RULES_REJECTED") {
    return "The selected dates no longer satisfy the campground booking rules.";
  }
  if (code === "ICAMP_CHECKOUT_CAPACITY_REJECTED") {
    return "The party size exceeds the current accommodation limits.";
  }
  if (code === "ICAMP_CHECKOUT_HOLD_REVALIDATION_FAILED") {
    return "Availability changed before the reservation could be created. Choose the accommodation again.";
  }
  if (code === "ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE") {
    return "This accommodation is no longer available for checkout.";
  }
  if (code === "ICAMP_CHECKOUT_RATE_UNAVAILABLE") {
    return "A current server-authoritative rate is not available for these dates.";
  }
  return "Checkout could not be completed. Review the fields and try again while the hold is active.";
}

export default async function ReservationCheckoutPage({
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
  const holdId = query.hold ?? "";
  const returnPath =
    `/booking/accommodations/${encodeURIComponent(accommodationId)}/checkout` +
    `?hold=${encodeURIComponent(holdId)}`;
  const session = await requireSignedIn(returnPath);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const checkout = holdId
    ? await getReservationCheckout({
        userId: session.user.id,
        holdId,
      })
    : null;

  if (!checkout || checkout.accommodation.id !== accommodationId) {
    notFound();
  }

  const mapHref =
    `/booking/map?campground=${encodeURIComponent(checkout.campground.slug)}`;
  const errorMessage = query.error
    ? checkoutErrorMessage(query.error)
    : null;

  if (checkout.hold.state !== "active") {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="content-panel">
            <SectionHeading
              eyebrow="Build 041 · Reservation checkout"
              title="Temporary hold is no longer active"
              id="checkout-hold-inactive"
              helpTopic="shell.overview"
            />
            <p>
              This checkout hold is {checkout.hold.state}. A pending reservation
              was not created from this page.
            </p>
            <p>
              <Link href={mapHref}>Return to the live booking map →</Link>
            </p>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!checkout.dates || !checkout.dateRules || !checkout.rateQuote) {
    notFound();
  }

  const rateAvailable =
    checkout.rateQuote.status === "quoted" &&
    checkout.rateQuote.totalCents !== null &&
    checkout.rateQuote.currencyCode;
  const automaticTotal = checkout.bookingCharges?.automaticTotalCents ?? 0;
  const currentTotal =
    rateAvailable && checkout.rateQuote.totalCents !== null
      ? checkout.rateQuote.totalCents + automaticTotal
      : null;
  const optionalItems =
    checkout.bookingCharges?.items.filter(
      (item) => item.applicationMode === "optional",
    ) ?? [];
  const automaticItems =
    checkout.bookingCharges?.items.filter(
      (item) => item.applicationMode === "automatic",
    ) ?? [];
  const limits = checkout.capacity?.effectiveLimits;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={mapHref}>Booking map</Link>
          <span>/</span>
          <span>Reservation checkout</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 041 · Reservation checkout</p>
          <h1>
            {checkout.accommodation.code} ·{" "}
            {checkout.accommodation.displayName}
          </h1>
          <p className="hero-panel__lead">
            {checkout.dates.arrivalDate} to {checkout.dates.departureDate} ·{" "}
            {checkout.dates.nights}{" "}
            {checkout.dates.nights === 1 ? "night" : "nights"}
          </p>
          <p>
            Temporary hold expires{" "}
            {new Date(checkout.hold.expiresAt).toLocaleString("en-CA")}. The
            server revalidates the hold and all booking rules when you submit.
          </p>
        </section>

        {errorMessage ? (
          <section className="content-panel" aria-live="polite">
            <p className="form-message form-message--error">{errorMessage}</p>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Server-authoritative quote"
            title="Current stay and automatic fees"
            id="checkout-quote"
            helpTopic="shell.overview"
          />
          {rateAvailable && checkout.rateQuote.totalCents !== null ? (
            <>
              <p>
                <strong>Accommodation:</strong>{" "}
                {formatMoney(
                  checkout.rateQuote.totalCents,
                  checkout.rateQuote.currencyCode ?? "CAD",
                )}
              </p>
              <p>
                <strong>Automatic service fees:</strong>{" "}
                {formatMoney(
                  automaticTotal,
                  checkout.rateQuote.currencyCode ?? "CAD",
                )}
              </p>
              <p>
                <strong>Current total before optional selections:</strong>{" "}
                {formatMoney(
                  currentTotal,
                  checkout.rateQuote.currencyCode ?? "CAD",
                )}
              </p>
            </>
          ) : (
            <p>A current rate is not available, so checkout cannot finish.</p>
          )}
          <p>
            Optional add-ons and passes selected below are recalculated on the
            server before the pending reservation is created. No client-supplied
            price is trusted.
          </p>
        </section>

        <form className="auth-form" action={finalizeReservationCheckoutAction}>
          <input type="hidden" name="holdId" value={checkout.hold.id} />
          <input
            type="hidden"
            name="accommodationId"
            value={checkout.accommodation.id}
          />

          <section className="content-panel">
            <SectionHeading
              eyebrow="Guest & contact"
              title="Primary reservation contact"
              id="checkout-contact"
              helpTopic="shell.overview"
            />
            <label>
              <span>First name</span>
              <input name="primaryFirstName" maxLength={80} required />
            </label>
            <label>
              <span>Last name</span>
              <input name="primaryLastName" maxLength={80} required />
            </label>
            <label>
              <span>Contact email</span>
              <input
                name="contactEmail"
                type="email"
                defaultValue={checkout.guest.email}
                maxLength={254}
                required
              />
            </label>
            <label>
              <span>Contact phone</span>
              <input
                name="contactPhone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                required
              />
            </label>
          </section>

          <section className="content-panel">
            <SectionHeading
              eyebrow="Party"
              title="Occupants, visitors, pets & vehicles"
              id="checkout-party"
              helpTopic="shell.overview"
            />
            <label>
              <span>
                Occupants
                {limits?.maxOccupants !== null &&
                limits?.maxOccupants !== undefined
                  ? ` · maximum ${limits.maxOccupants}`
                  : ""}
              </span>
              <input
                name="occupants"
                type="number"
                min={1}
                max={limits?.maxOccupants ?? 80}
                defaultValue={1}
                required
              />
            </label>
            <label>
              <span>
                Visitors
                {limits?.maxVisitors !== null &&
                limits?.maxVisitors !== undefined
                  ? ` · maximum ${limits.maxVisitors}`
                  : ""}
              </span>
              <input
                name="visitors"
                type="number"
                min={0}
                max={limits?.maxVisitors ?? 80}
                defaultValue={0}
                required
              />
            </label>
            <label>
              <span>Pets</span>
              <input
                name="pets"
                type="number"
                min={0}
                max={20}
                defaultValue={0}
                required
              />
            </label>
            <label>
              <span>
                Vehicles
                {limits?.maxVehicles !== null &&
                limits?.maxVehicles !== undefined
                  ? ` · maximum ${limits.maxVehicles}`
                  : ""}
              </span>
              <input
                name="vehicles"
                type="number"
                min={0}
                max={limits?.maxVehicles ?? 20}
                defaultValue={0}
                required
              />
            </label>
          </section>

          <section className="content-panel">
            <SectionHeading
              eyebrow="Compatibility"
              title="Stay and equipment requirements"
              id="checkout-compatibility"
              helpTopic="shell.overview"
            />
            {checkout.accommodation.kind === "rental_cottage" ? (
              <input type="hidden" name="lodgingKind" value="cottage" />
            ) : checkout.accommodation.campsiteType === "mixed" ? (
              <label>
                <span>Stay type</span>
                <select
                  name="lodgingKind"
                  defaultValue={checkout.defaultLodgingKind ?? "tent"}
                  required
                >
                  <option value="tent">Tent</option>
                  <option value="rv">RV</option>
                </select>
              </label>
            ) : (
              <input
                type="hidden"
                name="lodgingKind"
                value={checkout.defaultLodgingKind ?? "tent"}
              />
            )}

            {checkout.accommodation.kind === "campsite" &&
            checkout.accommodation.campsiteType !== "tent" ? (
              <>
                <p>
                  If this is an RV stay, provide the dimensions and requested
                  service so the server can revalidate fit.
                </p>
                <label>
                  <span>RV length (metres)</span>
                  <input name="rvLengthMeters" type="number" min="0.1" step="0.01" />
                </label>
                <label>
                  <span>RV width (metres)</span>
                  <input name="rvWidthMeters" type="number" min="0.1" step="0.01" />
                </label>
                <label>
                  <span>RV height (metres)</span>
                  <input name="rvHeightMeters" type="number" min="0.1" step="0.01" />
                </label>
                <label>
                  <span>Electrical amperage requested</span>
                  <select name="electricalAmperage" defaultValue="0">
                    <option value="0">None</option>
                    <option value="15">15 amp</option>
                    <option value="20">20 amp</option>
                    <option value="30">30 amp</option>
                    <option value="50">50 amp</option>
                  </select>
                </label>
                <label>
                  <input type="checkbox" name="needsWaterAtSite" /> Water
                  connection at site required
                </label>
                <label>
                  <input type="checkbox" name="needsWastewaterAtSite" />{" "}
                  Wastewater connection at site required
                </label>
              </>
            ) : null}
            <label>
              <input type="checkbox" name="needsWifi" /> Wi-Fi required
            </label>
            <label>
              <input type="checkbox" name="needsStepFreeAccess" /> Step-free
              access required
            </label>
            {checkout.accommodation.kind === "rental_cottage" ? (
              <label>
                <input type="checkbox" name="needsAccessibleWashroom" />{" "}
                Accessible washroom required
              </label>
            ) : null}
          </section>

          <section className="content-panel">
            <SectionHeading
              eyebrow="Add-ons, passes & fees"
              title="Choose optional booking charges"
              id="checkout-addons"
              helpTopic="shell.overview"
            />
            {optionalItems.length > 0 ? (
              optionalItems.map((item) => (
                <div key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      name="chargeCode"
                      value={item.code}
                    />{" "}
                    <strong>{item.displayName}</strong> · {item.priceLabel}
                  </label>
                  <label>
                    <span>Quantity</span>
                    <input
                      name={`quantity__${item.code}`}
                      type="number"
                      min={item.minimumQuantity}
                      max={item.maximumQuantity}
                      defaultValue={item.minimumQuantity}
                    />
                  </label>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
              ))
            ) : (
              <p>No optional add-ons or passes are configured.</p>
            )}

            {automaticItems.length > 0 ? (
              <>
                <h3>Automatic service fees</h3>
                <ul>
                  {automaticItems.map((item) => (
                    <li key={item.id}>
                      {item.displayName} · {item.priceLabel}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="content-panel">
            <SectionHeading
              eyebrow="Rules & acceptance"
              title="Acknowledge the booking rules"
              id="checkout-rules"
              helpTopic="shell.overview"
            />
            <p>
              Check-in {checkout.dateRules.checkInTime} · Check-out{" "}
              {checkout.dateRules.checkOutTime} · Effective stay range{" "}
              {checkout.dateRules.effectiveMinimumStay}–
              {checkout.dateRules.effectiveMaximumStay} nights.
            </p>
            {checkout.dateRules.holidayNames.length > 0 ? (
              <p>
                Holidays: {checkout.dateRules.holidayNames.join(", ")}.
              </p>
            ) : null}
            {checkout.dateRules.seasonNames.length > 0 ? (
              <p>Seasons: {checkout.dateRules.seasonNames.join(", ")}.</p>
            ) : null}
            <label>
              <input
                type="checkbox"
                name="rulesAcknowledged"
                required
              />{" "}
              I acknowledge the campground booking rules and authorize iCamp to
              revalidate availability, compatibility, capacity and all selected
              charges and save the resulting final server quote with this
              reservation.
            </label>
            <p>
              <strong>No payment is taken in Build 041.</strong> A successful
              submission creates a pending reservation only. Deposits, balances
              and payment-provider handling remain Build 042.
            </p>
            <button
              className="primary-button"
              type="submit"
              disabled={!rateAvailable || !checkout.dateRules.eligible}
            >
              Create pending reservation
            </button>
          </section>
        </form>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full checkout form, rule acknowledgement,
            add-ons and final server quote.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> structured party counts and supported
            choices use the same checkout authority; long rules, free-form
            contact data and visual choices use staff or secure-link handoff.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise checkout state and secure-link
            handoff use the same hold and quote authority. Payment data is not
            accepted by SMS.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
