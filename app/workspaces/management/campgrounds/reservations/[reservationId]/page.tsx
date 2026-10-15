import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getReservationManagementDetail } from "@/lib/reservation-management/postgres.mjs";

import {
  cancelReservationAction,
  updateReservationAction,
} from "../actions";
import styles from "../reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Managed reservation · iCamp",
  description:
    "Review and modify a campground reservation with append-only change history.",
};

export default async function ReservationManagementDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const { reservationId } = await params;
  const query = await searchParams;
  const campgroundId = String(query.campground ?? "").trim();
  if (!campgroundId) redirect("/workspaces/management/campgrounds/reservations");

  const path =
    "/workspaces/management/campgrounds/reservations/" +
    encodeURIComponent(reservationId) +
    "?campground=" +
    encodeURIComponent(campgroundId);
  const session = await requireStaff(path);
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campgroundId,
  );
  if (
    !authorization ||
    !authorization.permissions.some((key) =>
      [
        "reservation.read",
        "reservation.modify",
        "reservation.cancel",
      ].includes(key),
    )
  ) {
    redirect("/auth/not-authorized");
  }

  const detail = await getReservationManagementDetail({
    userId: session.user.id,
    campgroundId,
    reservationId,
  });
  if (!detail) notFound();

  const mayModify = authorization.permissions.includes("reservation.modify");
  const mayCancel = authorization.permissions.includes("reservation.cancel");
  const editable = ["pending", "confirmed"].includes(detail.reservation.status);
  const selectionText = detail.state.chargeSelections
    .map((item) => item.code + ":" + item.quantity)
    .join(",");

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link
            href={
              "/workspaces/management/campgrounds/reservations?campground=" +
              encodeURIComponent(campgroundId)
            }
          >
            Reservations
          </Link>
          <span>/</span>
          <span>{detail.reservation.id}</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 044 · Managed reservation</p>
          <h1>{detail.state.guestDisplayName}</h1>
          <p className="hero-panel__lead">
            {detail.reservation.accommodationCode} ·{" "}
            {detail.reservation.accommodationName} ·{" "}
            {detail.reservation.arrivalDate} to{" "}
            {detail.reservation.departureDate}
          </p>
          <p>
            Status <strong>{detail.reservation.status}</strong> · row{" "}
            {detail.reservation.rowVersion}
          </p>
        </section>

        {query.saved ? (
          <div className={styles.notice}>{query.saved}</div>
        ) : null}
        {query.error ? (
          <div className={styles.error + " " + styles.notice}>
            {query.error}
          </div>
        ) : null}

        {detail.state.financialReviewRequired ? (
          <div className={styles.review}>
            <strong>Financial review required.</strong>{" "}
            {detail.state.financialReviewReason ??
              "A management change requires Build 045 financial reconciliation."}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Current state"
            title="Reservation & financial position"
            id="managed-current-state"
            helpTopic="campground.structure"
          />
          <p>
            Current managed total:{" "}
            <strong>
              {formatMoney(
                detail.state.currentTotalCents,
                detail.state.currencyCode,
              )}
            </strong>
          </p>
          <p>
            Captured payments:{" "}
            <strong>
              {formatMoney(
                detail.reservation.capturedCents,
                detail.state.currencyCode,
              )}
            </strong>
          </p>
          <p>
            Original Build 041 checkout, Build 042 payment schedule and Build
            043 confirmation documents remain immutable historical evidence.
          </p>
        </section>

        {mayModify && editable ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Edit / move / extend / shorten"
              title="Update reservation"
              id="managed-reservation-edit"
              helpTopic="campground.structure"
            />
            <form action={updateReservationAction} className={styles.formGrid}>
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input type="hidden" name="reservationId" value={reservationId} />
              <input
                type="hidden"
                name="rowVersion"
                value={detail.reservation.rowVersion}
              />
              <input
                type="hidden"
                name="idempotencyKey"
                value={randomUUID()}
              />
              <label>
                Guest display name
                <input
                  name="guestDisplayName"
                  defaultValue={detail.state.guestDisplayName}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Contact email
                <input
                  name="contactEmail"
                  type="email"
                  defaultValue={detail.state.contactEmail ?? ""}
                  maxLength={254}
                />
              </label>
              <label>
                Accommodation
                <select
                  name="accommodationId"
                  defaultValue={detail.reservation.accommodationId}
                  required
                >
                  {detail.accommodations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Arrival
                <input
                  name="arrivalDate"
                  type="date"
                  defaultValue={detail.reservation.arrivalDate}
                  required
                />
              </label>
              <label>
                Departure
                <input
                  name="departureDate"
                  type="date"
                  defaultValue={detail.reservation.departureDate}
                  required
                />
              </label>
              <label className={styles.full}>
                Optional charge codes
                <input name="chargeSelections" defaultValue={selectionText} />
                <span className={styles.hint}>
                  Use code:quantity entries separated by commas. Automatic
                  service fees are recalculated automatically.
                </span>
              </label>
              <label className={styles.full}>
                Change reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  defaultValue="Update reservation."
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Revalidate, reprice & save
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Fees & add-ons"
            title="Available charge catalogue"
            id="managed-charge-catalogue"
            helpTopic="campground.structure"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Charge</th>
                  <th>Mode</th>
                  <th>Price</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {detail.chargeCatalog.map((item) => (
                  <tr key={item.code}>
                    <td>{item.code}</td>
                    <td>{item.displayName}</td>
                    <td>{item.applicationMode}</td>
                    <td>{item.priceLabel}</td>
                    <td>
                      {item.applicationMode === "automatic"
                        ? "automatic"
                        : item.minimumQuantity +
                          "–" +
                          item.maximumQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {mayCancel && editable ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Cancel"
              title="Cancel reservation"
              id="managed-reservation-cancel"
              helpTopic="campground.structure"
            />
            <p>
              Cancellation releases live inventory. Build 044 does not refund
              or forfeit captured money; paid cancellations are flagged for
              Build 045.
            </p>
            <form action={cancelReservationAction} className={styles.formGrid}>
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input type="hidden" name="reservationId" value={reservationId} />
              <input
                type="hidden"
                name="rowVersion"
                value={detail.reservation.rowVersion}
              />
              <input
                type="hidden"
                name="idempotencyKey"
                value={randomUUID()}
              />
              <label className={styles.full}>
                Cancellation reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
              <button className={styles.dangerButton} type="submit">
                Cancel reservation — no refund
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Complete history"
            title="Append-only reservation changes"
            id="reservation-change-history"
            helpTopic="campground.structure"
          />
          <div className={styles.history}>
            {detail.history.map((item) => (
              <article key={item.id}>
                <strong>
                  #{item.sequenceNo} · {item.changeKind}
                </strong>
                <p>{item.reason}</p>
                <p>
                  {formatMoney(
                    item.previousTotalCents,
                    item.currencyCode,
                  )}{" "}
                  →{" "}
                  {formatMoney(item.revisedTotalCents, item.currencyCode)} ·
                  delta {formatMoney(item.deltaCents, item.currencyCode)}
                </p>
                <p className={styles.historyMeta}>
                  {new Date(item.occurredAt).toLocaleString("en-CA")} ·{" "}
                  {item.sourceChannel}
                  {item.financialReviewRequired ? " · financial review" : ""}
                </p>
              </article>
            ))}
            {detail.history.length === 0 ? (
              <p>
                No Build 044 management changes have been recorded yet. The
                original booking evidence remains the starting point.
              </p>
            ) : null}
          </div>
        </section>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full modification, cancellation and
            history experience.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified staff may perform concise
            canonical reservation actions; multi-field pricing review uses
            staff-assisted visual fallback.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified staff workflows may initiate
            concise canonical actions and use secure-link fallback for complex
            repricing/history review.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
