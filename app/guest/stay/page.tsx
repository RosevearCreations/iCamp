import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { getGuestRulePublications } from "@/lib/campground-rules/postgres.mjs";
import { getMyStayDetail, listMyStays } from "@/lib/my-stay/postgres.mjs";
import { getGuestActiveSuspensions } from "@/lib/safety-enforcement/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import { acknowledgeCampgroundRuleAction } from "./rule-actions";
import styles from "../../workspaces/management/campgrounds/reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Stay · iCamp",
  description:
    "Guest portal for reservation details, accommodation, map, rules, Wi-Fi, services, assistance and receipts.",
  robots: { index: false, follow: false },
};

function phaseLabel(value: string) {
  return value.replaceAll("_", " ");
}

function serviceLink(
  title: string,
  href: string | null,
  futureBoundary: string,
) {
  return (
    <article>
      <strong>{title}</strong>
      {href ? (
        <p>
          <a href={href}>Open {title.toLowerCase()} →</a>
        </p>
      ) : (
        <p>
          Not enabled for this campground yet. {futureBoundary} remains the
          canonical transaction/content authority.
        </p>
      )}
    </article>
  );
}

export default async function MyStayPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ reservation?: string }>;
}>) {
  const path = "/guest/stay";
  const session = await requireSignedIn(path);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const params = await searchParams;
  const stays = await listMyStays({ userId: session.user.id });
  const selected =
    stays.find((stay) => stay.id === params.reservation) ??
    stays.find((stay) => stay.status === "checked_in") ??
    stays.find((stay) => stay.status === "confirmed") ??
    stays[0] ??
    null;

  const detail = selected
    ? await getMyStayDetail({
        userId: session.user.id,
        reservationId: selected.id,
      })
    : null;

  const publishedRules = detail
    ? await getGuestRulePublications({
        userId: session.user.id,
        reservationId: detail.reservation.id,
      })
    : [];

  const activeSuspensions = detail
    ? await getGuestActiveSuspensions({
        userId: session.user.id,
        reservationId: detail.reservation.id,
      })
    : [];

  const mapHref = detail
    ? "/booking/map?campground=" +
      encodeURIComponent(detail.reservation.campground.slug) +
      "&arrivalDate=" +
      encodeURIComponent(detail.reservation.arrivalDate) +
      "&departureDate=" +
      encodeURIComponent(detail.reservation.departureDate)
    : null;
  const paymentHref = detail
    ? `/booking/reservations/${encodeURIComponent(
        detail.reservation.id,
      )}/payment`
    : null;
  const documentsHref =
    detail?.documents.confirmationNumber != null
      ? `/booking/reservations/${encodeURIComponent(
          detail.reservation.id,
        )}/documents`
      : null;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/auth/account">Account</Link>
          <span>/</span>
          <span>My Stay</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 051 · Guest portal</p>
          <h1>My Stay</h1>
          <p className="hero-panel__lead">
            One secure place for your reservation, accommodation, campground
            map, rules, Wi-Fi guidance, guest services, assistance and receipts.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/guest/hub">
              Open mobile My Stay hub
            </Link>
            <Link className="primary-link" href="/guest/profile">
              Saved stay information
            </Link>
            <Link className="secondary-link" href="/auth/account">
              Account
            </Link>
            <Link className="secondary-link" href="/guest/reservation-options">
              Change or cancellation options
            </Link>
            <Link className="secondary-link" href="/guest/arrival-planner">
              Plan your arrival
            </Link>
            <Link className="secondary-link" href="/guest/events">
              Activity requests
            </Link>
            <Link className="secondary-link" href="/guest/rentals">
              Rental planning
            </Link>
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Your reservations"
            title="Choose a stay"
            id="my-stay-list"
            helpTopic="shell.overview"
          />
          {stays.length === 0 ? (
            <p>
              No guest-owned reservations are linked to this account yet. Start
              from the public booking map to create a reservation.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Campground</th>
                    <th>Accommodation</th>
                    <th>Dates</th>
                    <th>Stay state</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stays.map((stay) => (
                    <tr key={stay.id}>
                      <td>{stay.campgroundName}</td>
                      <td>
                        {stay.accommodationCode} · {stay.accommodationName}
                      </td>
                      <td>
                        {stay.arrivalDate} → {stay.departureDate}
                      </td>
                      <td>{phaseLabel(stay.phase)}</td>
                      <td>
                        <Link
                          href={
                            "/guest/stay?reservation=" +
                            encodeURIComponent(stay.id)
                          }
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {detail ? (
          <>
            <section className="content-panel">
              <SectionHeading
                eyebrow={detail.reservation.campground.name}
                title={
                  detail.reservation.accommodation.code +
                  " · " +
                  detail.reservation.accommodation.displayName
                }
                id="my-stay-overview"
                helpTopic="shell.overview"
                trailing={
                  <span className="build-chip">
                    {phaseLabel(detail.reservation.phase)}
                  </span>
                }
              />
              <div className={styles.history}>
                <article>
                  <strong>Stay dates</strong>
                  <p>
                    {detail.reservation.arrivalDate} →{" "}
                    {detail.reservation.departureDate}
                  </p>
                  <p>
                    <Link
                      href={`/guest/reservation-options?reservation=${encodeURIComponent(detail.reservation.id)}`}
                    >
                      Review change and cancellation options
                    </Link>
                  </p>
                  <p>
                    <Link
                      href={`/guest/arrival-planner?reservation=${encodeURIComponent(detail.reservation.id)}`}
                    >
                      Prepare for arrival and pre-registration
                    </Link>
                  </p>
                  <p>
                    Campground local date:{" "}
                    {detail.reservation.campgroundLocalDate}
                  </p>
                </article>
                <article>
                  <strong>Party</strong>
                  <p>
                    {detail.party.occupants} occupants · {detail.party.visitors}{" "}
                    visitors · {detail.party.pets} pets ·{" "}
                    {detail.party.vehicles} vehicles
                  </p>
                </article>
                <article>
                  <strong>Stay operations</strong>
                  <p>
                    Reservation: {phaseLabel(detail.reservation.status)}
                    {detail.checkIn ? " · checked in" : " · not checked in yet"}
                    {detail.checkOut ? " · checked out" : ""}
                  </p>
                </article>
              </div>
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Site / cottage"
                title="Your accommodation"
                id="my-stay-accommodation"
                helpTopic="shell.overview"
              />
              {detail.campsite ? (
                <div className={styles.history}>
                  <article>
                    <strong>Campsite</strong>
                    <p>
                      {phaseLabel(detail.campsite.campsiteType)} ·{" "}
                      {phaseLabel(detail.campsite.serviceLevel)} ·{" "}
                      {detail.campsite.surfaceType}
                    </p>
                  </article>
                  <article>
                    <strong>Utilities</strong>
                    <p>
                      Electrical {detail.campsite.electricalAmperage}A · water{" "}
                      {phaseLabel(detail.campsite.waterService)} · wastewater{" "}
                      {phaseLabel(detail.campsite.wastewaterService)}
                    </p>
                  </article>
                  <article>
                    <strong>Site features</strong>
                    <p>
                      {detail.campsite.isWaterfront ? "Waterfront · " : ""}
                      {detail.campsite.pullThrough ? "Pull-through · " : ""}
                      shade {detail.campsite.shadeLevel} ·{" "}
                      {detail.campsite.hasFireRing
                        ? "fire ring"
                        : "no fire ring"}{" "}
                      ·{" "}
                      {detail.campsite.hasPicnicTable
                        ? "picnic table"
                        : "no picnic table"}
                    </p>
                  </article>
                </div>
              ) : null}

              {detail.cottage ? (
                <div className={styles.history}>
                  <article>
                    <strong>Cottage</strong>
                    <p>
                      {phaseLabel(detail.cottage.cottageStyle)} ·{" "}
                      {detail.cottage.bedroomCount} bedrooms ·{" "}
                      {detail.cottage.bedCount} beds · max{" "}
                      {detail.cottage.maxOccupancy}
                    </p>
                  </article>
                  <article>
                    <strong>Kitchen & washroom</strong>
                    <p>
                      {phaseLabel(detail.cottage.kitchenType)} kitchen ·{" "}
                      {phaseLabel(detail.cottage.washroomType)} washroom ·{" "}
                      {phaseLabel(detail.cottage.showerType)} shower
                    </p>
                  </article>
                  <article>
                    <strong>Comfort & access</strong>
                    <p>
                      Heating {phaseLabel(detail.cottage.heatingType)} · cooling{" "}
                      {phaseLabel(detail.cottage.coolingType)} · view{" "}
                      {phaseLabel(detail.cottage.viewType)}
                    </p>
                  </article>
                </div>
              ) : null}
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Getting around"
                title="Map, rules & Wi-Fi"
                id="my-stay-guidance"
                helpTopic="shell.overview"
              />
              <div className={styles.history}>
                <article>
                  <strong>Campground map</strong>
                  {mapHref ? (
                    <p>
                      <Link href={mapHref}>
                        Open the published campground map →
                      </Link>
                    </p>
                  ) : (
                    <p>No published map link is available.</p>
                  )}
                  <p>
                    The map uses the same published Build 037 campground map and
                    accessible accommodation list.
                  </p>
                </article>
                <article>
                  <strong>Stay rules</strong>
                  <p>
                    Check-in:{" "}
                    {detail.rules.currentCheckInTime ?? "configured at office"}{" "}
                    · check-out:{" "}
                    {detail.rules.currentCheckOutTime ?? "configured at office"}
                  </p>
                  <p>
                    {detail.rules.guestSummary ??
                      "Your accepted booking-rule snapshot remains part of your stay evidence. Current published facility rules and acknowledgements appear below."}
                  </p>
                  <p>
                    Booking acknowledgement:{" "}
                    {detail.rules.bookingAcknowledgedAt ?? "not recorded"}.
                    {detail.rules.checkInAcknowledgedAt
                      ? " Front Desk acknowledgement: " +
                        detail.rules.checkInAcknowledgedAt +
                        "."
                      : ""}
                  </p>
                </article>
                <article>
                  <strong>Wi-Fi</strong>
                  <p>
                    Site service:{" "}
                    {detail.wifi.service
                      ? phaseLabel(detail.wifi.service)
                      : "campground guidance"}
                  </p>
                  {detail.wifi.networkName ? (
                    <p>Network: {detail.wifi.networkName}</p>
                  ) : null}
                  <p>
                    {detail.wifi.accessInstructions ??
                      "No campground Wi-Fi access instructions have been published to My Stay."}
                  </p>
                </article>
              </div>
            </section>

            {activeSuspensions.length ? (
              <section className="content-panel">
                <SectionHeading
                  eyebrow="Access notice · Management record"
                  title="Current feature or area restrictions"
                  id="my-stay-enforcement"
                  helpTopic="safety.enforcement"
                />
                <p>
                  Your campground has recorded the following approved access
                  restriction(s). Contact the campground office for questions,
                  review or reinstatement. Physical gate settings are managed
                  separately.
                </p>
                <div className={styles.history}>
                  {activeSuspensions.map((item) => (
                    <article key={item.id}>
                      <strong>
                        {item.facility_name ??
                          item.zone_name ??
                          item.feature_code ??
                          "Campground-wide"}
                      </strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>
                        {item.reason_summary}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="content-panel">
              <SectionHeading
                eyebrow="Build 082 · Published policies"
                title="Campground & facility rules"
                id="my-stay-published-rules"
                helpTopic="campground.rules"
              />
              <p>
                Each acknowledgement refers to the precise published rule
                version displayed here. If the campground publishes a newer
                version, it appears as a new item requiring your review.
              </p>
              {publishedRules.length === 0 ? (
                <p>
                  No facility rule publications are available for this stay yet.
                </p>
              ) : (
                <div className={styles.history}>
                  {publishedRules.map((rule) => (
                    <article key={rule.rule_version_id}>
                      <h3>{rule.title}</h3>
                      <p>
                        <strong>{rule.rule_category}</strong> · version{" "}
                        {rule.version_number}
                        {rule.facility_id
                          ? " · facility-specific"
                          : " · category-wide"}
                      </p>
                      <p style={{ whiteSpace: "pre-wrap" }}>{rule.content}</p>
                      {rule.acknowledged_at ? (
                        <p role="status">
                          Acknowledged this exact version on{" "}
                          {new Date(rule.acknowledged_at).toLocaleString(
                            "en-CA",
                          )}
                          .
                        </p>
                      ) : rule.acknowledgement_required ? (
                        <form action={acknowledgeCampgroundRuleAction}>
                          <input
                            type="hidden"
                            name="reservationId"
                            value={detail.reservation.id}
                          />
                          <input
                            type="hidden"
                            name="ruleSetId"
                            value={rule.rule_set_id}
                          />
                          <input
                            type="hidden"
                            name="ruleVersionId"
                            value={rule.rule_version_id}
                          />
                          <label>
                            <input
                              type="checkbox"
                              name="acknowledge"
                              required
                            />
                            I have read and acknowledge version{" "}
                            {rule.version_number} of {rule.title}.
                          </label>
                          <p>
                            <button type="submit" className="primary-button">
                              Record acknowledgement
                            </button>
                          </p>
                        </form>
                      ) : (
                        <p>
                          Information only; acknowledgement is not required for
                          this version.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="During your stay"
                title="Services & local information"
                id="my-stay-services"
                helpTopic="shell.overview"
              />
              <div className={styles.history}>
                {serviceLink(
                  "Campground store",
                  detail.portal.storeUrl,
                  "Build 121",
                )}
                {serviceLink(
                  "Equipment rentals",
                  detail.portal.rentalsUrl,
                  "Builds 112–116",
                )}
                {serviceLink(
                  "Events",
                  detail.portal.eventsUrl,
                  "Builds 097–099",
                )}
                {serviceLink(
                  "Local interests",
                  detail.portal.localInterestsUrl,
                  "Builds 100–106",
                )}
              </div>
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Help"
                title="Assistance"
                id="my-stay-assistance"
                helpTopic="camper.assistance.request"
              />
              <p>
                {detail.portal.assistanceInstructions ??
                  "Use the stay-linked assistance form for campground service requests."}
              </p>
              <div className="hero-actions">
                <Link
                  className="primary-link"
                  href={
                    "/guest/assistance?reservation=" +
                    encodeURIComponent(detail.reservation.id)
                  }
                >
                  Request camper assistance
                </Link>
                {detail.portal.assistanceUrl ? (
                  <a
                    className="secondary-link"
                    href={detail.portal.assistanceUrl}
                  >
                    Additional campground help
                  </a>
                ) : null}
              </div>
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Payments & documents"
                title="Balance, receipts & confirmation"
                id="my-stay-financial"
                helpTopic="shell.overview"
              />
              <p>
                Expected payable:{" "}
                <strong>
                  {formatMoney(
                    detail.payment.expectedPayableCents,
                    detail.payment.currencyCode,
                  )}
                </strong>{" "}
                · captured:{" "}
                {formatMoney(
                  detail.payment.capturedCents,
                  detail.payment.currencyCode,
                )}{" "}
                · outstanding:{" "}
                {formatMoney(
                  detail.payment.outstandingCents,
                  detail.payment.currencyCode,
                )}
              </p>
              {detail.payment.balanceDueDate ? (
                <p>Balance due date: {detail.payment.balanceDueDate}</p>
              ) : null}
              <div className="hero-actions">
                {paymentHref ? (
                  <Link className="primary-link" href={paymentHref}>
                    Payment details
                  </Link>
                ) : null}
                {documentsHref ? (
                  <Link className="secondary-link" href={documentsHref}>
                    Confirmation, invoice & receipts
                  </Link>
                ) : null}
              </div>
              {detail.documents.receipts.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Purpose</th>
                        <th>Amount</th>
                        <th>Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.documents.receipts.map((receipt) => (
                        <tr key={receipt.id}>
                          <td>{receipt.receiptNumber}</td>
                          <td>{phaseLabel(receipt.paymentPurpose)}</td>
                          <td>
                            {formatMoney(
                              receipt.amountCents,
                              receipt.currencyCode,
                            )}
                          </td>
                          <td>{receipt.issuedAt ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>
                  No captured-payment receipts are available for this stay yet.
                </p>
              )}
            </section>

            <section className="content-panel">
              <h2>Channel contract & privacy</h2>
              <p>
                <strong>Web/PWA:</strong> full My Stay experience.
              </p>
              <p>
                <strong>IVR/DTMF:</strong> verified guests may hear concise stay
                dates, accommodation code, balance and office guidance from the
                same canonical records. Visual map/content uses secure web or
                staff-assisted fallback.
              </p>
              <p>
                <strong>SMS/MMS:</strong> verified guests may receive concise
                stay status and secure-link handoff. Wi-Fi details, financial
                information and private documents are not echoed before
                verification.
              </p>
              <p>
                Build 051 does not create parallel store, rental, event,
                destination or versioned-rule records. Camper assistance intake
                is now canonical in Build 077; triage and closure continue in
                Build 078. The remaining domains stay owned by their scheduled
                builds.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
