import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  getFrontDeskCheckInDetail,
  listFrontDeskArrivals,
} from "@/lib/front-desk-check-in/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import { checkInReservationAction } from "./actions";
import styles from "../reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Front Desk Check-In · iCamp",
  description:
    "Verify arrival balance, occupancy, pets, vehicles, rules and operational handoffs before checking a reservation in.",
};

function checkInHref(campgroundId: string, reservationId?: string) {
  const base =
    "/workspaces/management/campgrounds/reservations/check-in?campground=" +
    encodeURIComponent(campgroundId);
  return reservationId
    ? base + "&reservation=" + encodeURIComponent(reservationId)
    : base;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function FrontDeskCheckInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    reservation?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/reservations/check-in";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        if (!authorization) return null;

        const permissions = authorization.permissions;
        const canReadReservation =
          permissions.includes("reservation.read") ||
          permissions.includes("reservation.modify");

        return canReadReservation && permissions.includes("payment.read")
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const arrivals = await listFrontDeskArrivals({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const detail = params.reservation
    ? await getFrontDeskCheckInDetail({
        userId: session.user.id,
        campgroundId: selected.campgroundId,
        reservationId: params.reservation,
      })
    : null;

  const canModify =
    selected.authorization.permissions.includes("reservation.modify");
  const needsOverride =
    detail != null &&
    (detail.reservation.outstandingBalanceCents > 0 ||
      detail.reservation.financialReviewRequired);
  const arrivalWindowOpen =
    detail != null &&
    detail.reservation.campgroundLocalDate >= detail.reservation.arrivalDate &&
    detail.reservation.campgroundLocalDate < detail.reservation.departureDate;
  const canSubmit =
    detail != null &&
    canModify &&
    ["pending", "confirmed"].includes(detail.reservation.status) &&
    arrivalWindowOpen &&
    (!needsOverride || detail.canOverride);

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link
            href={
              "/workspaces/management/campgrounds/reservations?campground=" +
              encodeURIComponent(selected.campgroundId)
            }
          >
            Reservations
          </Link>
          <span>/</span>
          <span>Front Desk Check-In</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 049 · Arrival operations</p>
          <h1>Front Desk Check-In</h1>
          <p className="hero-panel__lead">
            Re-verify the live balance, arrival counts, pet rules, saved-stay
            details and campground rules before changing the canonical
            reservation to checked in.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}
        {params.error ? (
          <div className={styles.notice + " " + styles.error}>
            {params.error}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Arrival desk"
            id="front-desk-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open arrivals
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Arrival queue"
            title={selected.campgroundName}
            id="front-desk-arrivals"
            helpTopic="campground.structure"
          />
          <p>
            The queue shows active arrivals from yesterday through the next 14
            days. Balance figures are recalculated from current reservation
            state, the Build 042 payment schedule and captured payments.
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Accommodation</th>
                  <th>Stay</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Review</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {arrivals.map((arrival) => (
                  <tr key={arrival.id}>
                    <td>{arrival.guestDisplayName}</td>
                    <td>
                      {arrival.accommodationCode} · {arrival.accommodationName}
                    </td>
                    <td>
                      {arrival.arrivalDate} → {arrival.departureDate}
                    </td>
                    <td>{statusLabel(arrival.status)}</td>
                    <td>
                      {formatMoney(
                        arrival.outstandingBalanceCents,
                        arrival.currencyCode,
                      )}
                    </td>
                    <td>
                      {arrival.financialReviewRequired
                        ? "Financial review"
                        : arrival.checkedIn
                          ? "Checked in"
                          : "Ready to review"}
                    </td>
                    <td>
                      <Link
                        href={checkInHref(selected.campgroundId, arrival.id)}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {arrivals.length === 0 ? (
            <p>No active arrivals are in the current front-desk window.</p>
          ) : null}
        </section>

        {detail ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Arrival verification"
              title={
                detail.reservation.accommodationCode +
                " · " +
                detail.reservation.guestDisplayName
              }
              id="front-desk-check-in-form"
              helpTopic="campground.structure"
            />

            <div className={styles.history}>
              <article>
                <strong>Stay</strong>
                <p>
                  {detail.reservation.arrivalDate} →{" "}
                  {detail.reservation.departureDate} · campground local date{" "}
                  {detail.reservation.campgroundLocalDate}
                </p>
              </article>
              <article>
                <strong>Live financial verification</strong>
                <p>
                  Reservation:{" "}
                  {formatMoney(
                    detail.reservation.reservationTotalCents,
                    detail.reservation.currencyCode,
                  )}{" "}
                  · expected payable:{" "}
                  {formatMoney(
                    detail.reservation.expectedPayableCents,
                    detail.reservation.currencyCode,
                  )}{" "}
                  · captured:{" "}
                  {formatMoney(
                    detail.reservation.capturedCents,
                    detail.reservation.currencyCode,
                  )}{" "}
                  · outstanding:{" "}
                  {formatMoney(
                    detail.reservation.outstandingBalanceCents,
                    detail.reservation.currencyCode,
                  )}
                </p>
              </article>
              <article>
                <strong>Capacity baseline</strong>
                <p>
                  Occupants max{" "}
                  {detail.capacity.effectiveLimits.maxOccupants ?? "not set"} ·
                  visitors max{" "}
                  {detail.capacity.effectiveLimits.maxVisitors ?? "not set"} ·
                  vehicles max{" "}
                  {detail.capacity.effectiveLimits.maxVehicles ?? "not set"} ·
                  pets{" "}
                  {detail.reservation.petsAllowed
                    ? "allowed, max " + detail.reservation.maxPets
                    : "not allowed"}
                </p>
              </article>
            </div>

            {detail.checkIn ? (
              <>
                <div className={styles.notice}>
                  Immutable Build 049 check-in evidence recorded{" "}
                  {detail.checkIn.checkedInAt ?? ""}.
                </div>
                <div className={styles.tableWrap}>
                  <table>
                    <tbody>
                      <tr>
                        <th>Verified arrival counts</th>
                        <td>
                          {detail.checkIn.occupantCount} occupants ·{" "}
                          {detail.checkIn.visitorCount} visitors ·{" "}
                          {detail.checkIn.petCount} pets ·{" "}
                          {detail.checkIn.vehicleCount} vehicles
                        </td>
                      </tr>
                      <tr>
                        <th>Balance at check-in</th>
                        <td>
                          {formatMoney(
                            detail.checkIn.outstandingBalanceCents,
                            detail.reservation.currencyCode,
                          )}
                          {detail.checkIn.balanceOverrideUsed
                            ? " · audited override used"
                            : ""}
                        </td>
                      </tr>
                      <tr>
                        <th>Access handoff</th>
                        <td>
                          {detail.checkIn.credentialRequestCount} requested ·{" "}
                          {detail.checkIn.credentialHandoffState}
                        </td>
                      </tr>
                      <tr>
                        <th>Notes</th>
                        <td>{detail.checkIn.notes ?? "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {detail.arrivalRequests.length > 0 ? (
                  <>
                    <h3>Arrival handoff requests</h3>
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Kind</th>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.arrivalRequests.map((request) => (
                            <tr key={request.id}>
                              <td>{statusLabel(request.requestKind)}</td>
                              <td>{request.displayName}</td>
                              <td>{request.quantity}</td>
                              <td>{request.fulfillmentState}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <form
                action={checkInReservationAction}
                className={styles.formGrid}
              >
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected.campgroundId}
                />
                <input
                  type="hidden"
                  name="reservationId"
                  value={detail.reservation.id}
                />
                <input
                  type="hidden"
                  name="rowVersion"
                  value={detail.reservation.rowVersion}
                />

                <label>
                  Verified occupants
                  <input
                    name="occupantCount"
                    type="number"
                    min="1"
                    max="80"
                    defaultValue={detail.reservation.checkoutCounts.occupants}
                    required
                  />
                </label>
                <label>
                  Verified visitors
                  <input
                    name="visitorCount"
                    type="number"
                    min="0"
                    max="80"
                    defaultValue={detail.reservation.checkoutCounts.visitors}
                    required
                  />
                </label>
                <label>
                  Verified pets
                  <input
                    name="petCount"
                    type="number"
                    min="0"
                    max="20"
                    defaultValue={detail.reservation.checkoutCounts.pets}
                    required
                  />
                </label>
                <label>
                  Verified vehicles
                  <input
                    name="vehicleCount"
                    type="number"
                    min="0"
                    max="20"
                    defaultValue={detail.reservation.checkoutCounts.vehicles}
                    required
                  />
                </label>

                {detail.saved.vehicles.length > 0 ? (
                  <fieldset className={styles.full}>
                    <legend>Match saved vehicle descriptions</legend>
                    <p className={styles.hint}>
                      Description only. Plate/jurisdiction registration remains
                      Build 053.
                    </p>
                    {detail.saved.vehicles.map((vehicle) => (
                      <label key={vehicle.id}>
                        <input
                          type="checkbox"
                          name="vehicleProfileId"
                          value={vehicle.id}
                        />{" "}
                        {vehicle.nickname} · {vehicle.vehicleKind}
                        {vehicle.make ? " · " + vehicle.make : ""}
                        {vehicle.model ? " " + vehicle.model : ""}
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                {detail.saved.pets.length > 0 ? (
                  <fieldset className={styles.full}>
                    <legend>Match saved pet descriptions</legend>
                    {detail.saved.pets.map((pet) => (
                      <label key={pet.id}>
                        <input
                          type="checkbox"
                          name="petProfileId"
                          value={pet.id}
                        />{" "}
                        {pet.name} · {pet.species}
                        {pet.breed ? " · " + pet.breed : ""}
                      </label>
                    ))}
                  </fieldset>
                ) : null}

                <label>
                  Access credentials requested
                  <input
                    name="credentialRequestCount"
                    type="number"
                    min="0"
                    max="20"
                    defaultValue="0"
                  />
                  <span className={styles.hint}>
                    Records a provisioning handoff only. Actual credential
                    issuance/revocation remains Build 056/063.
                  </span>
                </label>

                <label className={styles.full}>
                  Rental requests
                  <textarea
                    name="rentalRequests"
                    placeholder="Canoe:1, Kayak:2"
                    maxLength={1800}
                  />
                  <span className={styles.hint}>
                    Requested only; later rental workflows own fulfillment and
                    charging.
                  </span>
                </label>

                <label className={styles.full}>
                  Store add-on requests
                  <textarea
                    name="storeRequests"
                    placeholder="Firewood:2"
                    maxLength={1800}
                  />
                  <span className={styles.hint}>
                    Requested only; no POS charge is created by check-in.
                  </span>
                </label>

                <label className={styles.full}>
                  <input type="checkbox" name="rulesAcknowledged" required />{" "}
                  Arrival party acknowledges current campground/site rules.
                </label>

                {needsOverride ? (
                  detail.canOverride ? (
                    <>
                      <div className={styles.review + " " + styles.full}>
                        An outstanding balance or unresolved financial review is
                        present. A manager with reservation.override may make an
                        explicit audited exception.
                      </div>
                      <label className={styles.full}>
                        <input
                          type="checkbox"
                          name="balanceOverrideRequested"
                        />{" "}
                        Apply audited manager check-in override.
                      </label>
                      <label className={styles.full}>
                        Override reason
                        <textarea
                          name="balanceOverrideReason"
                          minLength={3}
                          maxLength={1000}
                        />
                      </label>
                    </>
                  ) : (
                    <div className={styles.review + " " + styles.full}>
                      Check-in is blocked until the balance/financial review is
                      resolved. This Front Desk role cannot use the manager-only
                      reservation.override exception.
                    </div>
                  )
                ) : null}

                {!arrivalWindowOpen ? (
                  <div className={styles.review + " " + styles.full}>
                    Check-in is not open for the campground-local arrival
                    window. The server will not allow check-in before arrival or
                    on/after departure.
                  </div>
                ) : null}

                <label className={styles.full}>
                  Front desk notes
                  <textarea name="notes" maxLength={2000} />
                </label>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={!canSubmit}
                >
                  Complete check-in
                </button>
              </form>
            )}
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Channel and successor-build boundary</h2>
          <p>
            <strong>Web/PWA:</strong> full arrival queue, live financial and
            capacity verification, saved-stay matching, rule acknowledgement and
            check-in evidence.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> a verified staff member may perform
            concise arrival/count/rules confirmation through the same server
            service. Balance overrides and complex reviews require the
            authenticated staff surface.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified staff may receive concise arrival
            status and a secure-link handoff. Sensitive profile details and raw
            card data are never echoed or collected by this workflow.
          </p>
          <p>
            Vehicle descriptions here are arrival evidence only; formal
            plate/jurisdiction registration remains <strong>Build 053</strong>.
            Formal visitor registration remains <strong>Build 055</strong>.
            Access credential issuance/lifecycle remains{" "}
            <strong>Build 056/063</strong>. Rental and store requests are
            handoffs only until their canonical rental/POS builds fulfill them.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
