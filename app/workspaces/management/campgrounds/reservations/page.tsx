import { randomUUID } from "node:crypto";

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
import { formatMoney } from "@/lib/pricing/core.mjs";
import { listReservationManagementConsole } from "@/lib/reservation-management/postgres.mjs";

import { createReservationAction } from "./actions";
import styles from "./reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservation management · iCamp",
  description:
    "Create and manage campground reservations with authoritative availability, repricing and complete change history.",
};

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

export default async function ReservationManagementPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/reservations";
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
        return authorization?.permissions.some((key) =>
          [
            "reservation.read",
            "reservation.create",
            "reservation.modify",
            "reservation.cancel",
          ].includes(key),
        )
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const data = await listReservationManagementConsole({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const mayCreate =
    selected.authorization.permissions.includes("reservation.create");
  const mayUseGuestDesk = selected.authorization.permissions.some(
    (permission) =>
      permission === "guest.read" || permission === "guest.manage",
  );
  const mayUseVehicleDesk = selected.authorization.permissions.some(
    (permission) =>
      permission === "vehicle.read" || permission === "vehicle.register",
  );

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
          <span>Reservations</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 046 · Reservation & office operations</p>
          <h1>Reservation management console</h1>
          <p className="hero-panel__lead">
            Create, move, extend, shorten, reprice and cancel reservations while
            preserving the original checkout/payment/document evidence, with a
            dedicated front-office desk for walk-up and overflow intake.
          </p>
          <p>
            <Link href="/workspaces/management/campgrounds/reservations/review-requests">
              View guest change/cancellation review requests
            </Link>
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
            title="Choose campground"
            id="reservation-campground"
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
              Open reservations
            </button>
          </form>
        </section>

        {mayCreate ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Create"
              title="New managed reservation"
              id="create-managed-reservation"
              helpTopic="campground.structure"
            />
            <p>
              This ordinary office form creates a canonical pending reservation
              using current rates and active booking charges.
            </p>
            {mayUseGuestDesk ? (
              <p>
                <Link
                  href={
                    "/workspaces/management/campgrounds/guests?campground=" +
                    encodeURIComponent(selected.campgroundId)
                  }
                >
                  Open guest profiles & saved stay information →
                </Link>
              </p>
            ) : null}
            {mayUseVehicleDesk ? (
              <p>
                <Link
                  href={
                    "/workspaces/management/campgrounds/vehicles?campground=" +
                    encodeURIComponent(selected.campgroundId)
                  }
                >
                  Open Road Vehicle Registration →
                </Link>
              </p>
            ) : null}
            <p>
              <Link
                href={
                  "/workspaces/management/campgrounds/reservations/office?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Open walk-up / overflow office desk →
              </Link>
            </p>
            {selected.authorization.permissions.includes("payment.read") &&
            selected.authorization.permissions.includes(
              "reservation.modify",
            ) ? (
              <p>
                <Link
                  href={
                    "/workspaces/management/campgrounds/reservations/check-in?campground=" +
                    encodeURIComponent(selected.campgroundId)
                  }
                >
                  Open Front Desk Check-In →
                </Link>
              </p>
            ) : null}
            {selected.authorization.permissions.includes("payment.read") &&
            selected.authorization.permissions.includes(
              "reservation.modify",
            ) ? (
              <p>
                <Link
                  href={
                    "/workspaces/management/campgrounds/reservations/check-out?campground=" +
                    encodeURIComponent(selected.campgroundId)
                  }
                >
                  Open Front Desk Check-Out →
                </Link>
              </p>
            ) : null}
            <form action={createReservationAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <label>
                Guest display name
                <input name="guestDisplayName" maxLength={160} required />
              </label>
              <label>
                Contact email
                <input name="contactEmail" type="email" maxLength={254} />
              </label>
              <label>
                Accommodation
                <select name="accommodationId" required>
                  {data.accommodations.map((item) => (
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
                  defaultValue={isoDate(1)}
                  required
                />
              </label>
              <label>
                Departure
                <input
                  name="departureDate"
                  type="date"
                  defaultValue={isoDate(2)}
                  required
                />
              </label>
              <label className={styles.full}>
                Optional charge codes
                <input
                  name="chargeSelections"
                  placeholder="wifi:1,extra-vehicle:1"
                />
                <span className={styles.hint}>
                  Use comma-separated code:quantity entries. Automatic service
                  fees are added by the pricing engine.
                </span>
              </label>
              <label className={styles.full}>
                Reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  defaultValue="Create managed reservation."
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Create reservation
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Current reservations"
            title={data.campground.name}
            id="managed-reservation-list"
            helpTopic="campground.structure"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Accommodation</th>
                  <th>Stay</th>
                  <th>Status</th>
                  <th>Current total</th>
                  <th>Captured</th>
                  <th>Review</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.guestDisplayName}</td>
                    <td>
                      {reservation.accommodationCode} ·{" "}
                      {reservation.accommodationName}
                    </td>
                    <td>
                      {reservation.arrivalDate} → {reservation.departureDate}
                    </td>
                    <td>{reservation.status}</td>
                    <td>
                      {formatMoney(
                        reservation.currentTotalCents,
                        reservation.currencyCode,
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        reservation.capturedCents,
                        reservation.currencyCode,
                      )}
                    </td>
                    <td>
                      {reservation.financialReviewRequired
                        ? "Financial review"
                        : "Clear"}
                    </td>
                    <td>
                      <Link
                        href={
                          "/workspaces/management/campgrounds/reservations/" +
                          encodeURIComponent(reservation.id) +
                          "?campground=" +
                          encodeURIComponent(selected.campgroundId)
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
          {data.reservations.length === 0 ? (
            <p>No reservations are currently recorded for this campground.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <h2>Channel contract & financial boundary</h2>
          <p>
            <strong>Web/PWA:</strong> full management console, pricing preview
            through save, and complete change-history review.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> reservation lookup and concise status
            changes may use the same management commands only after staff
            verification; complex repricing/move review uses staff-assisted
            fallback.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise staff workflow status and
            secure-link handoff are supported; complex change review stays on
            the authenticated web surface.
          </p>
          <p>
            Build 046 records office intake without replacing the Build 044
            change history. Paid cancellation/refund work remains protected by
            the Build 045 financial safeguards.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
