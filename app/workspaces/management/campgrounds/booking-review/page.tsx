import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listStaffWaitlist258 } from "@/lib/release/build258-booking-postgres.mjs";

import {
  addWaitlistInterest258Action,
  reviewWaitlist258Action,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking dates, holds and waitlist review · iCamp",
  robots: { index: false, follow: false },
};
const path = "/workspaces/management/campgrounds/booking-review";
function isoDate(days = 0) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default async function BookingReview258({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    arrivalDate?: string;
    departureDate?: string;
    result?: string;
  }>;
}>) {
  const session = await requireStaff(path);
  if (session.assuranceLevel !== "aal2")
    redirect("/auth/mfa?next=" + encodeURIComponent(path));
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (item) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return grant?.permissions.some((permission) =>
          [
            "reservation.create",
            "reservation.read",
            "reservation.modify",
          ].includes(permission),
        )
          ? { ...item, grant }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (
    !allowed.length ||
    (params.campground &&
      !allowed.some((item) => item.campgroundId === params.campground))
  )
    redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const arrivalDate = params.arrivalDate ?? isoDate();
  const departureDate = params.departureDate ?? isoDate(1);
  const canCreate = selected.grant.permissions.includes("reservation.create");
  const canReview = selected.grant.permissions.includes("reservation.modify");
  const report = await listStaffWaitlist258({
    actorUserId: session.user.id,
    campgroundId: selected.campgroundId,
    arrivalDate,
    departureDate,
  }).catch(() => null);
  const blockedSites = report?.sites.filter((item) => !item.available) ?? [];
  const metrics = report?.instrument.bookingInventory;

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 258 · SLAVE APPLICATION SHELL</p>
          <h1>Booking dates, temporary holds and staff waitlist review</h1>
          <p className="hero-panel__lead">
            One campground inventory source for guests and staff. A waitlist
            note does not reserve a site, send an offer or change availability.
            The existing atomic reservation-hold service controls inventory.
          </p>
        </section>
        <section className="content-panel">
          <h2>Campground date window</h2>
          <form method="get" className="form-grid">
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Arrival — first occupied night
              <input
                type="date"
                name="arrivalDate"
                defaultValue={arrivalDate}
                required
              />
            </label>
            <label>
              Departure — checkout, not an occupied night
              <input
                type="date"
                name="departureDate"
                defaultValue={departureDate}
                required
              />
            </label>
            <button type="submit">Recheck live inventory</button>
          </form>
          <p role="status">
            <strong>
              {report?.status ?? "HOLD_PRIVATE_DATABASE_OR_INVALID_DATES"}
            </strong>
            {" · "}
            {report?.window.nightsLabel ?? "No verified date window"} · checkout{" "}
            {departureDate} · Inventory checked at{" "}
            {report?.generatedAt ?? "not available"}
          </p>
          {params.result ? (
            <p role="status">Last operation: {params.result}</p>
          ) : null}
          <p>
            <Link href="/booking/map">Guest-facing site map</Link>
            {" · "}
            <Link
              href={`/workspaces/management/campgrounds/availability/holds?campground=${encodeURIComponent(selected.campgroundId)}&arrivalDate=${encodeURIComponent(arrivalDate)}&departureDate=${encodeURIComponent(departureDate)}`}
            >
              Authoritative temporary holds and countdown
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Master instrument — iCamp source-side preview</h2>
          <p>
            This is a local read-only preview of booking capacity. The main
            Server Shell must authenticate source signatures and separately
            collect YW signals before showing a combined operational screen. No
            live Master connection or home-automation command is implied.
          </p>
          <div
            className="status-grid"
            role="group"
            aria-label="Source booking health metrics"
          >
            <div className="content-card">
              <strong>Available sites</strong>
              <p>{metrics?.available ?? "Unverified"}</p>
            </div>
            <div className="content-card">
              <strong>Held or reserved</strong>
              <p>{metrics?.reservedOrHeld ?? "Unverified"}</p>
            </div>
            <div className="content-card">
              <strong>Maintenance / closed</strong>
              <p>
                {metrics ? metrics.maintenance + metrics.closed : "Unverified"}
              </p>
            </div>
            <div className="content-card">
              <strong>Master connection</strong>
              <p>HOLD · Independent signed evidence required</p>
            </div>
          </div>
          <p>
            <Link href="/integration/comms-hub">
              Master/Comms integration status
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Staff-reviewed waitlist interest</h2>
          <p>
            Only verified staff may record interest in a site already blocked
            for these dates. Entries are ordered by creation time, contain no
            guest contact information and never promote themselves into holds or
            reservations.
          </p>
          {canCreate && blockedSites.length > 0 ? (
            <form action={addWaitlistInterest258Action} className="form-grid">
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="arrivalDate" value={arrivalDate} />
              <input type="hidden" name="departureDate" value={departureDate} />
              <input type="hidden" name="requestKey" value={randomUUID()} />
              <label>
                Unavailable site
                <select name="accommodationId" required>
                  {blockedSites.map((site) => (
                    <option
                      key={site.accommodationId}
                      value={site.accommodationId}
                    >
                      {site.code} · {site.displayName} ·{" "}
                      {site.blockers.join(", ")}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">
                Record staff interest — no reservation
              </button>
            </form>
          ) : (
            <p>
              {canCreate
                ? "No verified blocked site is available for waitlist review."
                : "Reservation-create permission is required to add a staff interest note."}
            </p>
          )}
          <h3>FIFO review queue</h3>
          {report?.entries.length ? (
            <ol>
              {report.entries.map((entry) => (
                <li key={entry.id}>
                  <strong>
                    {entry.code} · {entry.displayName}
                  </strong>
                  {" — "}
                  {entry.arrivalDate} to {entry.departureDate} · {entry.state}
                  {" · queued "}
                  {entry.queuedAt}
                  {canReview && entry.state !== "cancelled" ? (
                    <form action={reviewWaitlist258Action}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="arrivalDate"
                        value={arrivalDate}
                      />
                      <input
                        type="hidden"
                        name="departureDate"
                        value={departureDate}
                      />
                      <input type="hidden" name="waitlistId" value={entry.id} />
                      {entry.state !== "reviewed" ? (
                        <button type="submit" name="action" value="reviewed">
                          Mark reviewed — no offer
                        </button>
                      ) : null}
                      <button type="submit" name="action" value="cancelled">
                        Cancel interest
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p>No genuine staff waitlist interests for this date window.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
