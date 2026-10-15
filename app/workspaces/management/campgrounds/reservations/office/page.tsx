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
import { listOfficeBookingInventory } from "@/lib/office-booking/postgres.mjs";
import { listReservationManagementConsole } from "@/lib/reservation-management/postgres.mjs";

import {
  createOfficeBookingAction,
  createOverflowAreaAction,
  setOverflowAreaMembersAction,
} from "./actions";
import styles from "../reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Walk-up & office booking · iCamp",
  description:
    "Create office, walk-up and overflow reservations against authoritative live campground availability.",
};

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function safeWindow(arrival?: string, departure?: string) {
  const fallback = { arrivalDate: isoDate(0), departureDate: isoDate(1) };
  const a = String(arrival ?? "").trim();
  const d = String(departure ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(a) || !/^\d{4}-\d{2}-\d{2}$/u.test(d)) {
    return fallback;
  }
  if (d <= a) return fallback;
  return { arrivalDate: a, departureDate: d };
}

function availabilityText(item: { available: boolean; blockers: string[] }) {
  return item.available ? "Available" : "Blocked: " + item.blockers.join(", ");
}

export default async function OfficeBookingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    arrival?: string;
    departure?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/reservations/office";
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
  const window = safeWindow(params.arrival, params.departure);
  const [management, inventory] = await Promise.all([
    listReservationManagementConsole({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listOfficeBookingInventory({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
      arrivalDate: window.arrivalDate,
      departureDate: window.departureDate,
    }),
  ]);
  const mayCreate =
    selected.authorization.permissions.includes("reservation.create");
  const mayConfigure = selected.authorization.permissions.includes(
    "campground.configuration",
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
          <Link
            href={
              "/workspaces/management/campgrounds/reservations?campground=" +
              encodeURIComponent(selected.campgroundId)
            }
          >
            Reservations
          </Link>
          <span>/</span>
          <span>Office booking</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 046 · Front-office intake</p>
          <h1>Walk-up, overflow & office booking</h1>
          <p className="hero-panel__lead">
            Staff-created reservations stay on the canonical reservation,
            pricing and Build 035 availability engines. Walk-up inventory comes
            from campsite operating profiles; overflow areas group canonical
            accommodations instead of creating a second inventory system.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}
        {params.error ? (
          <div className={styles.notice + " " + styles.error}>{params.error}</div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Inventory window"
            title="Authoritative availability"
            id="office-booking-window"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.formGrid}>
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
            <label>
              Arrival
              <input
                name="arrival"
                type="date"
                defaultValue={window.arrivalDate}
                required
              />
            </label>
            <label>
              Departure
              <input
                name="departure"
                type="date"
                defaultValue={window.departureDate}
                required
              />
            </label>
            <button className="primary-button" type="submit">
              Refresh inventory
            </button>
          </form>
        </section>

        {mayCreate ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Staff-created booking"
              title="Create office reservation"
              id="create-office-booking"
              helpTopic="campground.structure"
            />
            <p>
              Choose the intake mode deliberately. The server rejects a walk-up
              booking unless the selected campsite is configured as walk-up,
              and rejects overflow unless the accommodation belongs to the
              selected active overflow area.
            </p>
            <form action={createOfficeBookingAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <label>
                Booking mode
                <select name="bookingMode" defaultValue="office">
                  <option value="office">Office booking</option>
                  <option value="walk_up">Walk-up</option>
                  <option value="overflow">Overflow</option>
                </select>
              </label>
              <label>
                Overflow area
                <select name="overflowAreaId" defaultValue="">
                  <option value="">Not an overflow booking</option>
                  {inventory.overflowAreas
                    .filter((area) => area.isActive)
                    .map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.code} · {area.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Accommodation
                <select name="accommodationId" required>
                  {management.accommodations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Guest display name
                <input name="guestDisplayName" maxLength={160} required />
              </label>
              <label>
                Contact email
                <input name="contactEmail" type="email" maxLength={254} />
              </label>
              <label>
                Arrival
                <input
                  name="arrivalDate"
                  type="date"
                  defaultValue={window.arrivalDate}
                  required
                />
              </label>
              <label>
                Departure
                <input
                  name="departureDate"
                  type="date"
                  defaultValue={window.departureDate}
                  required
                />
              </label>
              <label className={styles.full}>
                Optional charge codes
                <input
                  name="chargeSelections"
                  placeholder="wifi:1,extra-vehicle:1"
                />
              </label>
              <label className={styles.full}>
                Office note
                <textarea
                  name="officeNote"
                  maxLength={1000}
                  placeholder="Optional front-desk context; do not store payment credentials."
                />
              </label>
              <label className={styles.full}>
                Reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  defaultValue="Create office booking."
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Create booking
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Walk-up inventory"
            title="Walk-up campsite availability"
            id="walk-up-inventory"
            helpTopic="campground.structure"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Service</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {inventory.walkUpInventory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.code} · {item.displayName}
                    </td>
                    <td>{item.campsiteType ?? "—"}</td>
                    <td>{item.serviceLevel ?? "—"}</td>
                    <td>{availabilityText(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inventory.walkUpInventory.length === 0 ? (
            <p>No active campsites are currently configured with a walk-up profile.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Overflow inventory"
            title="Configured overflow areas"
            id="overflow-inventory"
            helpTopic="campground.structure"
          />
          {inventory.overflowAreas.map((area) => (
            <div key={area.id}>
              <h3>
                {area.code} · {area.displayName}
              </h3>
              <p>
                {area.isActive ? "Active" : "Inactive"} · {area.availableCount} of{" "}
                {area.members.length} members available for the selected dates.
              </p>
              {area.notes ? <p>{area.notes}</p> : null}
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Accommodation</th>
                      <th>Kind</th>
                      <th>Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {area.members.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.code} · {item.displayName}
                        </td>
                        <td>{item.accommodationKind}</td>
                        <td>{availabilityText(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {area.members.length === 0 ? <p>No members assigned.</p> : null}

              {mayConfigure ? (
                <form
                  action={setOverflowAreaMembersAction}
                  className={styles.formGrid}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="overflowAreaId" value={area.id} />
                  <div className={styles.full}>
                    <strong>Overflow members</strong>
                    {management.accommodations.map((item) => (
                      <label key={item.id}>
                        <input
                          type="checkbox"
                          name="memberAccommodationIds"
                          value={item.id}
                          defaultChecked={area.members.some(
                            (member) => member.id === item.id,
                          )}
                        />{" "}
                        {item.code} · {item.displayName}
                      </label>
                    ))}
                  </div>
                  <label className={styles.full}>
                    Reason
                    <input
                      name="reason"
                      defaultValue="Update overflow area membership."
                      minLength={3}
                      maxLength={1000}
                      required
                    />
                  </label>
                  <button className="secondary-button" type="submit">
                    Save members
                  </button>
                </form>
              ) : null}
            </div>
          ))}
          {inventory.overflowAreas.length === 0 ? (
            <p>No overflow areas are configured yet.</p>
          ) : null}
        </section>

        {mayConfigure ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Overflow configuration"
              title="Create overflow area"
              id="create-overflow-area"
              helpTopic="campground.structure"
            />
            <form action={createOverflowAreaAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label>
                Code
                <input name="code" placeholder="overflow-a" maxLength={40} required />
              </label>
              <label>
                Name
                <input
                  name="displayName"
                  placeholder="North field overflow"
                  maxLength={120}
                  required
                />
              </label>
              <label className={styles.full}>
                Notes
                <textarea name="notes" maxLength={1000} />
              </label>
              <label className={styles.full}>
                Reason
                <input
                  name="reason"
                  defaultValue="Create overflow booking area."
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Create overflow area
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full office, walk-up and overflow intake,
            inventory review and authorized overflow configuration.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified staff can identify the guest,
            dates, accommodation and booking mode through the canonical
            reservation command; complex availability comparison uses
            staff-assisted review.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified staff can use concise office
            booking workflows with secure-link handoff for multi-option
            inventory review. No payment credential is collected over custom
            SMS/IVR.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
