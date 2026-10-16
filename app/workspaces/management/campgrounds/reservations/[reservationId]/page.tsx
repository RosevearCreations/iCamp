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

import { cancelReservationAction, updateReservationAction } from "../actions";
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
  if (!campgroundId)
    redirect("/workspaces/management/campgrounds/reservations");

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
      ["reservation.read", "reservation.modify", "reservation.cancel"].includes(
        key,
      ),
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
  const mayManageAccommodation = authorization.permissions.includes(
    "accommodation.manage",
  );
  const mayCancel = authorization.permissions.includes("reservation.cancel");
  const mayFinance = authorization.permissions.some((permission) =>
    ["payment.read", "refund.issue", "finance.read", "finance.manage"].includes(
      permission,
    ),
  );
  const editable = ["pending", "confirmed", "checked_in"].includes(
    detail.reservation.status,
  );
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
          <p className="eyebrow">Build 044 / 052 · Managed reservation</p>
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

        {detail.reservation.status === "checked_in" ? (
          <div className={styles.review}>
            <strong>Build 052 in-stay controls are active.</strong> Extensions
            recheck canonical availability and reprice the stay. Accommodation
            moves also create housekeeping/maintenance evidence and require
            accommodation-management authority.
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
          {mayFinance ? (
            <p>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/management/campgrounds/reservations/" +
                  encodeURIComponent(reservationId) +
                  "/financial?campground=" +
                  encodeURIComponent(campgroundId)
                }
              >
                Open Build 045 financial safeguards →
              </Link>
            </p>
          ) : null}
        </section>

        {mayModify && editable ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow={
                detail.reservation.status === "checked_in"
                  ? "Build 052 · Extend / move active stay"
                  : "Edit / move / extend / shorten"
              }
              title={
                detail.reservation.status === "checked_in"
                  ? "Adjust checked-in stay"
                  : "Update reservation"
              }
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
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
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
                  {detail.accommodations
                    .filter(
                      (item) =>
                        detail.reservation.status !== "checked_in" ||
                        mayManageAccommodation ||
                        item.id === detail.reservation.accommodationId,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.displayName} · {item.statusState}
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
                  readOnly={detail.reservation.status === "checked_in"}
                  required
                />
                {detail.reservation.status === "checked_in" ? (
                  <span className={styles.hint}>
                    Historical arrival is locked after check-in.
                  </span>
                ) : null}
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
                {detail.reservation.status === "checked_in"
                  ? "Recheck availability, reprice & apply"
                  : "Revalidate, reprice & save"}
              </button>
            </form>
          </section>
        ) : null}

        {detail.stayAdjustments.length > 0 ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Build 052 · Operational evidence"
              title="Checked-in stay adjustments"
              id="checked-in-stay-adjustments"
              helpTopic="campground.structure"
            />
            <div className={styles.history}>
              {detail.stayAdjustments.map((item) => (
                <article key={item.id}>
                  <strong>{item.adjustmentKind}</strong>
                  <p>{item.operationalSummary}</p>
                  <p>
                    {item.priorArrivalDate}–{item.priorDepartureDate} →{" "}
                    {item.revisedArrivalDate}–{item.revisedDepartureDate}
                  </p>
                  <p>
                    Payment difference:{" "}
                    <strong>
                      {formatMoney(item.deltaCents, item.currencyCode)}
                    </strong>
                    {item.financialReviewRequired
                      ? " · financial review required"
                      : ""}
                  </p>
                  <p className={styles.historyMeta}>
                    Availability rechecked · housekeeping review{" "}
                    {item.housekeepingReviewRequired
                      ? "required"
                      : "not required"}
                    {" · "}maintenance review{" "}
                    {item.maintenanceReviewRequired
                      ? "required"
                      : "not required"}
                    {" · "}
                    {new Date(item.occurredAt).toLocaleString("en-CA")}
                  </p>
                </article>
              ))}
            </div>
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
                        : item.minimumQuantity + "–" + item.maximumQuantity}
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
              Cancellation releases live inventory. Build 044 does not refund or
              forfeit captured money; paid cancellations are flagged for Build
              045.
            </p>
            <form action={cancelReservationAction} className={styles.formGrid}>
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input type="hidden" name="reservationId" value={reservationId} />
              <input
                type="hidden"
                name="rowVersion"
                value={detail.reservation.rowVersion}
              />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
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
                  {formatMoney(item.previousTotalCents, item.currencyCode)} →{" "}
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
            <strong>Web/PWA:</strong> full modification, checked-in
            extension/move, cancellation and history experience.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified staff may perform concise
            canonical reservation actions; Build 052 move/repricing and
            operational-handoff review uses staff-assisted visual fallback.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified staff workflows may initiate
            concise canonical actions and use secure-link fallback for complex
            Build 052 repricing, move and operational-impact review.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
