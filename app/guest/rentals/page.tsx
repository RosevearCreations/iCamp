import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { listGuestRecreationStays } from "@/lib/recreation-events/postgres.mjs";
import {
  guestStayEligibleForRental,
  normalizeRentalWindow,
  rentalAvailabilityLabel,
} from "@/lib/rental-planner/core.mjs";
import {
  listOwnRentalRequests,
  listPublicRentalOffers,
} from "@/lib/rental-planner/postgres.mjs";

import {
  submitRentalPlanningAction,
  withdrawRentalPlanningAction,
} from "./actions";
import styles from "../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My rental plans · iCamp",
  description:
    "Private, reservation-linked provisional amenity and equipment planning requests.",
  robots: { index: false, follow: false },
};

export default async function GuestRentalPlansPage({
  searchParams,
}: {
  searchParams: Promise<{
    offer?: string;
    start?: string;
    end?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Rental planning is unavailable</h1>
          <p>
            The live asset database is not connected. No rental request, payment
            or allocation was created. Please contact the campground office.
          </p>
        </section>
      </AppShell>
    );
  const session = await requireSignedIn("/guest/rentals");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  let window;
  let invalidWindow = false;
  try {
    window = normalizeRentalWindow({
      startDate: params.start,
      endDate: params.end,
    });
  } catch {
    window = null;
    invalidWindow = true;
  }
  const [stays, requests, offers] = await Promise.all([
    listGuestRecreationStays({ userId: session.user.id }),
    listOwnRentalRequests({ userId: session.user.id }),
    invalidWindow
      ? Promise.resolve([])
      : listPublicRentalOffers({
          startDate: window?.startDate,
          endDate: window?.endDate,
        }),
  ]);
  const selected = offers.find((item) => item.id === params.offer) ?? null;
  const eligible = selected
    ? stays.filter((stay) => guestStayEligibleForRental(stay, selected, window))
    : [];
  const alreadyActive =
    selected &&
    requests.some(
      (request) =>
        request.offerId === selected.id &&
        ["pending", "reviewed"].includes(request.status),
    );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/stay">My Stay</Link>
          <span>/</span>
          <span>Rental plans</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 182 · Guest rental planner</p>
          <h1>Plan your campground rentals</h1>
          <p className="hero-panel__lead">
            Check provisional date availability for verified equipment or an
            amenity, then request staff review against your own stay. This is
            not a hold, charge, ticket, access pass or confirmed rental.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/rentals">
              Browse rentals
            </Link>
            <Link className="secondary-link" href="/guest/stay">
              My Stay
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            {params.saved === "withdraw"
              ? "Your rental planning request was withdrawn, releasing its provisional slot."
              : "Your rental planning request was saved for staff review. No item was allocated or charged."}
          </p>
        ) : null}
        {params.error || invalidWindow ? (
          <p className={styles.warning} role="alert">
            The request could not be completed or the selected dates are
            invalid. Availability, reservation eligibility or review state may
            have changed; refresh and contact the campground if necessary.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Reservation-linked planning"
            title="Request a provisional slot"
            id="rental-plan-form"
            helpTopic="shell.overview"
          />
          {!selected ? (
            <p>
              Start with a reviewed item in the{" "}
              <Link href="/rentals">rental catalog</Link>, choosing both pickup
              and return dates.
            </p>
          ) : (
            <>
              <h3>{selected.assetName}</h3>
              <p>
                {selected.campgroundName} ·{" "}
                {selected.assetClass === "facility" ? "Amenity" : "Equipment"} ·{" "}
                {selected.itemType.replaceAll("_", " ")}
              </p>
              <form method="get" className={styles.filters}>
                <input name="offer" type="hidden" value={selected.id} />
                <label>
                  Pickup date (inclusive)
                  <input
                    name="start"
                    type="date"
                    defaultValue={params.start ?? ""}
                    required
                  />
                </label>
                <label>
                  Return date (inclusive)
                  <input
                    name="end"
                    type="date"
                    defaultValue={params.end ?? ""}
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  Recheck dates
                </button>
              </form>
              <p>{rentalAvailabilityLabel(selected, window)}</p>
              {alreadyActive ? (
                <p>
                  You already have an active planning request for this item;
                  review its status below before creating another.
                </p>
              ) : eligible.length === 0 ? (
                <p>
                  No eligible stay or provisional slot was verified for these
                  dates. A stay must be confirmed or checked in, belong to this
                  guest and cover the pickup and return dates.
                </p>
              ) : (
                <form
                  action={submitRentalPlanningAction}
                  className={styles.form}
                >
                  <input name="offerId" type="hidden" value={selected.id} />
                  <input
                    name="startDate"
                    type="hidden"
                    value={window?.startDate ?? ""}
                  />
                  <input
                    name="endDate"
                    type="hidden"
                    value={window?.endDate ?? ""}
                  />
                  <input
                    name="clientRequestId"
                    type="hidden"
                    value={randomUUID()}
                  />
                  <label>
                    Eligible reservation
                    <select name="reservationId" required>
                      {eligible.map((stay) => (
                        <option value={stay.id} key={stay.id}>
                          {stay.campgroundName} · {stay.arrivalDate} to{" "}
                          {stay.departureDate} · {stay.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Optional note to staff
                    <textarea
                      name="guestNote"
                      maxLength={400}
                      placeholder="Pickup/access needs (no payment information)"
                    />
                  </label>
                  <p>
                    One source asset supports one provisional overlapping
                    request. Staff review is not an allocation or guarantee of
                    collection.
                  </p>
                  <button className="primary-button" type="submit">
                    Submit rental planning request
                  </button>
                </form>
              )}
            </>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Private to your account"
            title="My planning history"
            id="rental-plan-history"
            helpTopic="shell.overview"
          />
          {requests.length === 0 ? (
            <p>No rental plans are associated with your guest account yet.</p>
          ) : (
            <div className={styles.cards}>
              {requests.map((request) => (
                <article className={styles.card} key={request.id}>
                  <h3>{request.assetName}</h3>
                  <p>
                    {request.campgroundName} · {request.startDate} through{" "}
                    {request.endDate} (inclusive)
                  </p>
                  <p>
                    State: <strong>{request.status}</strong>
                    {request.status === "reviewed"
                      ? " — staff reviewed, not allocated"
                      : ""}
                  </p>
                  {["pending", "reviewed"].includes(request.status) ? (
                    <form action={withdrawRentalPlanningAction}>
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <button className="primary-button" type="submit">
                        Withdraw planning request
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <p>
            For telephone, text or accessibility assistance, contact the
            campground office directly. No automated outbound messaging or
            financial action is active.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
