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
  getFrontDeskCheckOutDetail,
  listFrontDeskDepartures,
} from "@/lib/front-desk-check-out/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import { checkOutReservationAction } from "./actions";
import styles from "../reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Front Desk Check-Out · iCamp",
  description:
    "Verify departure finances and returns, complete the reservation, and trigger post-departure turnover or inspection.",
};

function checkOutHref(campgroundId: string, reservationId?: string) {
  const base =
    "/workspaces/management/campgrounds/reservations/check-out?campground=" +
    encodeURIComponent(campgroundId);
  return reservationId
    ? base + "&reservation=" + encodeURIComponent(reservationId)
    : base;
}

function stateLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function FrontDeskCheckOutPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    reservation?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/reservations/check-out";
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

  const departures = await listFrontDeskDepartures({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  const detail = params.reservation
    ? await getFrontDeskCheckOutDetail({
        userId: session.user.id,
        campgroundId: selected.campgroundId,
        reservationId: params.reservation,
      })
    : null;

  const canModify =
    selected.authorization.permissions.includes("reservation.modify");
  const needsFinancialFollowUp =
    detail != null &&
    (detail.reservation.outstandingBalanceCents > 0 ||
      detail.reservation.financialReviewRequired);
  const canSubmit =
    detail != null &&
    canModify &&
    detail.reservation.status === "checked_in" &&
    detail.checkIn != null;

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
          <span>Front Desk Check-Out</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 050 · Departure operations</p>
          <h1>Front Desk Check-Out</h1>
          <p className="hero-panel__lead">
            Confirm departure, preserve unresolved financial/return follow-up,
            complete the canonical reservation, and trigger the accommodation
            turnover or inspection path in one transaction.
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
            title="Departure desk"
            id="front-desk-check-out-scope"
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
              Open departures
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Departure queue"
            title={selected.campgroundName}
            id="front-desk-departures"
            helpTopic="campground.structure"
          />
          <p>
            Active checked-in stays appear first. Recently completed checkouts
            remain visible for fourteen days as immutable departure evidence.
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Accommodation</th>
                  <th>Departure</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Turnover</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {departures.map((departure) => (
                  <tr key={departure.id}>
                    <td>{departure.guestDisplayName}</td>
                    <td>
                      {departure.accommodationCode} ·{" "}
                      {departure.accommodationName}
                    </td>
                    <td>{departure.departureDate}</td>
                    <td>{stateLabel(departure.status)}</td>
                    <td>
                      {formatMoney(
                        departure.outstandingBalanceCents,
                        departure.currencyCode,
                      )}
                    </td>
                    <td>
                      {departure.turnoverState
                        ? stateLabel(departure.turnoverState)
                        : "Pending checkout"}
                    </td>
                    <td>
                      <Link
                        href={checkOutHref(selected.campgroundId, departure.id)}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {departures.length === 0 ? (
            <p>No checked-in or recent checkout stays are in this queue.</p>
          ) : null}
        </section>

        {detail ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Departure verification"
              title={
                detail.reservation.accommodationCode +
                " · " +
                detail.reservation.guestDisplayName
              }
              id="front-desk-check-out-form"
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
                <strong>Financial snapshot</strong>
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
                <strong>Arrival handoff baseline</strong>
                <p>
                  Rentals requested: {detail.checkIn?.rentalRequestCount ?? 0} ·
                  access credentials requested:{" "}
                  {detail.checkIn?.credentialRequestCount ?? 0}
                </p>
              </article>
            </div>

            {detail.checkOut ? (
              <>
                <div className={styles.notice}>
                  Immutable Build 050 checkout evidence recorded{" "}
                  {detail.checkOut.checkedOutAt ?? ""}.
                </div>
                <div className={styles.tableWrap}>
                  <table>
                    <tbody>
                      <tr>
                        <th>Financial handoff</th>
                        <td>
                          {stateLabel(detail.checkOut.financialHandoffState)} ·{" "}
                          {formatMoney(
                            detail.checkOut.outstandingBalanceCents,
                            detail.reservation.currencyCode,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <th>Returns</th>
                        <td>
                          rentals{" "}
                          {stateLabel(detail.checkOut.rentalReturnState)} · keys{" "}
                          {stateLabel(detail.checkOut.keyReturnState)} ·
                          credentials{" "}
                          {stateLabel(detail.checkOut.credentialReturnState)}
                        </td>
                      </tr>
                      <tr>
                        <th>Accommodation status</th>
                        <td>
                          {stateLabel(
                            detail.checkOut.accommodationStatusBefore,
                          )}{" "}
                          →{" "}
                          {stateLabel(detail.checkOut.accommodationStatusAfter)}
                        </td>
                      </tr>
                      <tr>
                        <th>Turnover</th>
                        <td>
                          {stateLabel(detail.checkOut.turnoverKind)} ·{" "}
                          {stateLabel(detail.checkOut.turnoverState)}
                        </td>
                      </tr>
                      <tr>
                        <th>Notes</th>
                        <td>
                          {detail.checkOut.returnNotes ??
                            detail.checkOut.departureNotes ??
                            "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {detail.checkOut.cottageTurnoverId ? (
                  <p>
                    Cottage turnover ID:{" "}
                    <code>{detail.checkOut.cottageTurnoverId}</code>
                  </p>
                ) : null}
              </>
            ) : (
              <form
                action={checkOutReservationAction}
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

                {needsFinancialFollowUp ? (
                  <div className={styles.review + " " + styles.full}>
                    Outstanding charges and/or a financial review remain. The
                    physical checkout may continue, but the unresolved amount is
                    preserved as a finance follow-up instead of being erased or
                    treated as paid.
                  </div>
                ) : null}

                {needsFinancialFollowUp ? (
                  <label className={styles.full}>
                    <input
                      type="checkbox"
                      name="financialFollowUpAcknowledged"
                      required
                    />{" "}
                    Acknowledge finance follow-up for the unresolved balance or
                    review.
                  </label>
                ) : null}

                <label>
                  Rental return
                  <select
                    name="rentalReturnState"
                    defaultValue={
                      (detail.checkIn?.rentalRequestCount ?? 0) > 0
                        ? "complete"
                        : "not_applicable"
                    }
                  >
                    <option value="not_applicable">Not applicable</option>
                    <option value="complete">Complete / nothing owing</option>
                    <option value="follow_up_required">
                      Follow-up required
                    </option>
                  </select>
                </label>

                <label>
                  Physical key return
                  <select name="keyReturnState" defaultValue="not_applicable">
                    <option value="not_applicable">Not applicable</option>
                    <option value="complete">Complete / nothing owing</option>
                    <option value="follow_up_required">
                      Follow-up required
                    </option>
                  </select>
                </label>

                <label>
                  Access credential return
                  <select
                    name="credentialReturnState"
                    defaultValue={
                      (detail.checkIn?.credentialRequestCount ?? 0) > 0
                        ? "complete"
                        : "not_applicable"
                    }
                  >
                    <option value="not_applicable">Not applicable</option>
                    <option value="complete">Complete / nothing owing</option>
                    <option value="follow_up_required">
                      Follow-up required
                    </option>
                  </select>
                </label>

                <label className={styles.full}>
                  Return notes
                  <textarea
                    name="returnNotes"
                    maxLength={2000}
                    placeholder="Unreturned rental item, lost key, credential follow-up, etc."
                  />
                </label>

                <label className={styles.full}>
                  Departure notes
                  <textarea name="departureNotes" maxLength={2000} />
                </label>

                <label className={styles.full}>
                  <input type="checkbox" name="departureConfirmed" required />{" "}
                  Confirm the guest has departed and the reservation should move
                  to completed.
                </label>

                <div className={styles.review + " " + styles.full}>
                  {detail.reservation.accommodationKind === "cottage"
                    ? "A configured Build 027 departure turnover will be reused or created automatically. If no single active departure template is available, checkout still completes but records a configuration-required turnover handoff."
                    : "The accommodation will enter the post-departure inspection path. Build 073 (advancing historical Build 074) automatically owns campsite-specific cleanup task checklists and configured rebooking clearance."}
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={!canSubmit}
                >
                  Complete check-out
                </button>
              </form>
            )}

            {detail.arrivalRequests.length > 0 ? (
              <>
                <h3>Arrival handoffs for return review</h3>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Kind</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Arrival state</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.arrivalRequests.map((request) => (
                        <tr key={request.id}>
                          <td>{stateLabel(request.requestKind)}</td>
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
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Channel and successor-build boundary</h2>
          <p>
            <strong>Web/PWA:</strong> full departure queue, financial/return
            verification, reservation completion and turnover/inspection
            evidence.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> a verified staff member may perform a
            concise departure confirmation and return-status capture through the
            same server service. Complex financial or unresolved-return review
            uses authenticated staff Web/PWA.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified staff may receive concise
            checkout status and a secure-link handoff. Sensitive financial
            details and raw payment-card data are not collected over messaging.
          </p>
          <p>
            Build 027 remains the canonical cottage housekeeping engine. Build
            062 remains the authority for actual credential revocation/lifecycle
            and Build 074 remains the authority for campsite-specific
            post-departure cleanup tasks.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
