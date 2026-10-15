import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getGuestProfileDetail } from "@/lib/guest-profile/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import {
  archiveStaffSavedItemAction,
  linkReservationAction,
  linkSeasonalAssignmentAction,
  saveStaffGuestProfileAction,
  saveStaffPetAction,
  saveStaffRvAction,
  saveStaffVehicleAction,
} from "../actions";
import styles from "../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest profile detail · iCamp",
};

function archiveForm(
  campgroundId: string,
  profileId: string,
  itemId: string,
  itemKind: "rv" | "vehicle" | "pet",
  rowVersion: number,
) {
  return (
    <form action={archiveStaffSavedItemAction} className={styles.inlineForm}>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemKind" value={itemKind} />
      <input type="hidden" name="expectedRowVersion" value={rowVersion} />
      <button className="secondary-button" type="submit">
        Archive
      </button>
    </form>
  );
}

export default async function GuestProfileDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const route = await params;
  const query = await searchParams;
  const campgroundId = String(query.campground ?? "").trim();
  const path =
    "/workspaces/management/campgrounds/guests/" +
    encodeURIComponent(route.profileId) +
    "?campground=" +
    encodeURIComponent(campgroundId);
  const session = await requireStaff(path);
  const detail = await getGuestProfileDetail({
    actorUserId: session.user.id,
    campgroundId,
    profileId: route.profileId,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link
            href={
              "/workspaces/management/campgrounds/guests?campground=" +
              encodeURIComponent(campgroundId)
            }
          >
            Guests
          </Link>
          <span>/</span>
          <span>
            {detail.profile.firstName} {detail.profile.lastName}
          </span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 048 · Canonical guest record</p>
          <h1>
            {detail.profile.firstName} {detail.profile.lastName}
          </h1>
          <p className="hero-panel__lead">
            Review reusable stay details and canonical stay/receipt history
            without changing immutable booking/payment/document evidence.
          </p>
        </section>

        {query.saved ? (
          <div className={styles.notice}>{query.saved}</div>
        ) : null}
        {query.error ? (
          <div className={styles.notice + " " + styles.error}>
            {query.error}
          </div>
        ) : null}

        {detail.canManage ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Identity & privacy"
              title="Profile details"
              id="staff-guest-profile"
              helpTopic="auth.sessions"
            />
            <form
              action={saveStaffGuestProfileAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input type="hidden" name="profileId" value={detail.profile.id} />
              <input
                type="hidden"
                name="expectedRowVersion"
                value={detail.profile.rowVersion}
              />
              <label>
                First name
                <input
                  name="firstName"
                  maxLength={80}
                  defaultValue={detail.profile.firstName}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  maxLength={80}
                  defaultValue={detail.profile.lastName}
                  required
                />
              </label>
              <label>
                Preferred name
                <input
                  name="preferredName"
                  maxLength={80}
                  defaultValue={detail.profile.preferredName ?? ""}
                />
              </label>
              <label>
                Contact email
                <input
                  name="contactEmail"
                  type="email"
                  maxLength={254}
                  defaultValue={detail.profile.contactEmail ?? ""}
                />
              </label>
              <label>
                Contact phone
                <input
                  name="contactPhone"
                  maxLength={40}
                  defaultValue={detail.profile.contactPhone ?? ""}
                />
              </label>
              <label>
                Optional guest account email
                <input
                  name="accountEmail"
                  type="email"
                  maxLength={320}
                  placeholder={
                    detail.profile.userAccountId
                      ? "Account already linked"
                      : "Link an existing guest login"
                  }
                  disabled={Boolean(detail.profile.userAccountId)}
                />
              </label>
              <label>
                Preferred contact
                <select
                  name="preferredContactChannel"
                  defaultValue={detail.profile.preferredContactChannel}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="phone">Phone</option>
                  <option value="none">No preference</option>
                </select>
              </label>
              <label className={styles.full}>
                <input
                  type="checkbox"
                  name="saveStayPreferences"
                  defaultChecked={detail.profile.saveStayPreferences}
                />{" "}
                Guest permits reusable stay details.
              </label>
              <label className={styles.full}>
                <input
                  type="checkbox"
                  name="allowStaffProfileLookup"
                  defaultChecked={detail.profile.allowStaffProfileLookup}
                />{" "}
                Guest permits ordinary future-stay lookup.
              </label>
              <button className="primary-button" type="submit">
                Save profile
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Saved stay information"
            title="RV, vehicles & pets"
            id="staff-saved-info"
            helpTopic="accommodation.inventory"
          />
          <h3>RVs</h3>
          {detail.rvs.map((item) => (
            <p key={item.id}>
              <strong>{item.nickname}</strong> · {item.rvKind}
              {item.lengthFeet ? " · " + item.lengthFeet + " ft" : ""}{" "}
              {detail.canManage
                ? archiveForm(
                    campgroundId,
                    detail.profile.id,
                    item.id,
                    "rv",
                    item.rowVersion,
                  )
                : null}
            </p>
          ))}
          <h3>Vehicles</h3>
          {detail.vehicles.map((item) => (
            <p key={item.id}>
              <strong>{item.nickname}</strong> · {item.vehicleKind}
              {item.make ? " · " + item.make : ""}{" "}
              {detail.canManage
                ? archiveForm(
                    campgroundId,
                    detail.profile.id,
                    item.id,
                    "vehicle",
                    item.rowVersion,
                  )
                : null}
            </p>
          ))}
          <h3>Pets</h3>
          {detail.pets.map((item) => (
            <p key={item.id}>
              <strong>{item.name}</strong> · {item.species}
              {item.breed ? " · " + item.breed : ""}{" "}
              {detail.canManage
                ? archiveForm(
                    campgroundId,
                    detail.profile.id,
                    item.id,
                    "pet",
                    item.rowVersion,
                  )
                : null}
            </p>
          ))}

          {detail.canManage && detail.profile.saveStayPreferences ? (
            <>
              <h3>Add RV</h3>
              <form action={saveStaffRvAction} className={styles.formGrid}>
                <input type="hidden" name="campgroundId" value={campgroundId} />
                <input
                  type="hidden"
                  name="profileId"
                  value={detail.profile.id}
                />
                <label>
                  Nickname
                  <input name="nickname" maxLength={80} required />
                </label>
                <label>
                  RV type
                  <select name="rvKind" defaultValue="travel_trailer">
                    <option value="motorhome">Motorhome</option>
                    <option value="travel_trailer">Travel trailer</option>
                    <option value="fifth_wheel">Fifth wheel</option>
                    <option value="pop_up">Pop-up</option>
                    <option value="truck_camper">Truck camper</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Make
                  <input name="make" maxLength={80} />
                </label>
                <label>
                  Model
                  <input name="model" maxLength={80} />
                </label>
                <label>
                  Year
                  <input name="modelYear" type="number" min={1900} max={2200} />
                </label>
                <label>
                  Length (ft)
                  <input
                    name="lengthFeet"
                    type="number"
                    min={1}
                    max={120}
                    step="0.1"
                  />
                </label>
                <label>
                  Slide-outs
                  <input
                    name="slideOutCount"
                    type="number"
                    min={0}
                    max={12}
                    defaultValue={0}
                  />
                </label>
                <label>
                  Electrical service
                  <select name="electricalServiceAmps" defaultValue="">
                    <option value="">Unknown / none</option>
                    <option value="15">15 amp</option>
                    <option value="30">30 amp</option>
                    <option value="50">50 amp</option>
                  </select>
                </label>
                <label className={styles.full}>
                  Notes
                  <textarea name="notes" maxLength={1000} />
                </label>
                <button className="primary-button" type="submit">
                  Save RV
                </button>
              </form>

              <h3>Add vehicle</h3>
              <form action={saveStaffVehicleAction} className={styles.formGrid}>
                <input type="hidden" name="campgroundId" value={campgroundId} />
                <input
                  type="hidden"
                  name="profileId"
                  value={detail.profile.id}
                />
                <label>
                  Nickname
                  <input name="nickname" maxLength={80} required />
                </label>
                <label>
                  Type
                  <select name="vehicleKind" defaultValue="car">
                    <option value="car">Car</option>
                    <option value="truck">Truck</option>
                    <option value="suv">SUV</option>
                    <option value="van">Van</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="tow_vehicle">Tow vehicle</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Make
                  <input name="make" maxLength={80} />
                </label>
                <label>
                  Model
                  <input name="model" maxLength={80} />
                </label>
                <label>
                  Colour
                  <input name="color" maxLength={60} />
                </label>
                <label>
                  Year
                  <input name="modelYear" type="number" min={1900} max={2200} />
                </label>
                <label className={styles.full}>
                  Notes
                  <textarea name="notes" maxLength={1000} />
                </label>
                <button className="primary-button" type="submit">
                  Save vehicle
                </button>
              </form>

              <h3>Add pet</h3>
              <form action={saveStaffPetAction} className={styles.formGrid}>
                <input type="hidden" name="campgroundId" value={campgroundId} />
                <input
                  type="hidden"
                  name="profileId"
                  value={detail.profile.id}
                />
                <label>
                  Name
                  <input name="name" maxLength={80} required />
                </label>
                <label>
                  Species
                  <select name="species" defaultValue="dog">
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Breed
                  <input name="breed" maxLength={80} />
                </label>
                <label>
                  Weight (kg)
                  <input
                    name="weightKg"
                    type="number"
                    min="0.1"
                    max={250}
                    step="0.1"
                  />
                </label>
                <label className={styles.full}>
                  Notes
                  <textarea name="notes" maxLength={1000} />
                </label>
                <button className="primary-button" type="submit">
                  Save pet
                </button>
              </form>
            </>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Canonical history"
            title="Stays & receipts"
            id="staff-guest-history"
            helpTopic="auth.sessions"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Stay</th>
                  <th>Accommodation</th>
                  <th>Status</th>
                  <th>Confirmation</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.stays.map((stay) => (
                  <tr key={stay.id}>
                    <td>
                      {stay.arrivalDate} → {stay.departureDate}
                    </td>
                    <td>
                      {stay.accommodationCode} · {stay.accommodationName}
                    </td>
                    <td>{stay.status}</td>
                    <td>{stay.confirmationNumber ?? "—"}</td>
                    <td>{formatMoney(stay.totalCents, stay.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Receipts</h3>
          {detail.receipts.map((receipt) => (
            <p key={receipt.id}>
              {receipt.receiptNumber} · {receipt.paymentPurpose} ·{" "}
              {formatMoney(receipt.amountCents, receipt.currencyCode)}
            </p>
          ))}
          <h3>Seasonal/yearly history</h3>
          {detail.seasonalAssignments.map((assignment) => (
            <p key={assignment.id}>
              {assignment.assignmentKind} · {assignment.accommodationCode} ·{" "}
              {assignment.startsOn} to {assignment.endsOn} ·{" "}
              {assignment.assignmentState}
            </p>
          ))}
        </section>

        {detail.canManage ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Link existing records"
              title="Canonical history linkage"
              id="guest-linkage"
              helpTopic="auth.sessions"
            />
            <p>
              Link an existing reservation or Build 047 seasonal/yearly
              assignment by its internal ID when resolving a legacy or
              office-created record. The server verifies campground and
              permission scope before linking.
            </p>
            <form action={linkReservationAction} className={styles.inlineForm}>
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input type="hidden" name="profileId" value={detail.profile.id} />
              <label>
                Reservation ID
                <input name="reservationId" required />
              </label>
              <button className="secondary-button" type="submit">
                Link reservation
              </button>
            </form>
            <form
              action={linkSeasonalAssignmentAction}
              className={styles.inlineForm}
            >
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input type="hidden" name="profileId" value={detail.profile.id} />
              <label>
                Seasonal/yearly assignment ID
                <input name="assignmentId" required />
              </label>
              <button className="secondary-button" type="submit">
                Link long-term assignment
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Profile evidence</h2>
          {detail.events.map((event) => (
            <p key={event.id}>
              {event.occurredAt} · {event.eventKind} · {event.sourceChannel} ·{" "}
              {event.summary}
            </p>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
