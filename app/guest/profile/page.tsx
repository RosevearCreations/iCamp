import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import {
  getOwnGuestProfileDetail,
  listOwnGuestProfileScopes,
} from "@/lib/guest-profile/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import {
  archiveOwnSavedItemAction,
  saveOwnGuestProfileAction,
  saveOwnPetAction,
  saveOwnRvAction,
  saveOwnVehicleAction,
} from "./actions";
import styles from "../../workspaces/management/campgrounds/reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My saved stay information · iCamp",
  description:
    "Manage reusable guest, RV, vehicle and pet details plus stay and receipt history.",
};

function archiveForm(
  campgroundId: string,
  profileId: string,
  itemId: string,
  itemKind: "rv" | "vehicle" | "pet",
  rowVersion: number,
) {
  return (
    <form action={archiveOwnSavedItemAction} className={styles.inlineForm}>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemKind" value={itemKind} />
      <input
        type="hidden"
        name="expectedRowVersion"
        value={rowVersion}
      />
      <button className="secondary-button" type="submit">
        Archive
      </button>
    </form>
  );
}

export default async function GuestProfilePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/guest/profile";
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const params = await searchParams;
  const scopes = await listOwnGuestProfileScopes({ userId: session.user.id });

  if (scopes.length === 0) {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="hero-panel">
            <p className="eyebrow">Build 048 · Optional guest profile</p>
            <h1>My saved stay information</h1>
            <p className="hero-panel__lead">
              Your account is ready. A campground profile becomes available
              after your first reservation so saved details stay scoped to the
              property you actually use.
            </p>
          </section>
          <section className="content-panel">
            <p>
              No reservation-linked campground is available yet. Your account
              remains optional and no extra saved-stay data has been created.
            </p>
            <Link href="/auth/account">Back to account</Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const selected =
    scopes.find((scope) => scope.campgroundId === params.campground) ??
    scopes[0];
  const detail = await getOwnGuestProfileDetail({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/auth/account">Account</Link>
          <span>/</span>
          <span>Saved stay information</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 048 · Guest profile & history</p>
          <h1>My saved stay information</h1>
          <p className="hero-panel__lead">
            Keep optional contact, RV, vehicle and pet details for future stays,
            control whether they are retained for reuse, and review existing
            stay and receipt history without changing the original booking
            evidence.
          </p>
        </section>

        {params.saved ? <div className={styles.notice}>{params.saved}</div> : null}
        {params.error ? (
          <div className={styles.notice + " " + styles.error}>
            {params.error}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Campground scope"
            title={selected.campgroundName}
            id="guest-profile-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {scopes.map((scope) => (
                  <option key={scope.campgroundId} value={scope.campgroundId}>
                    {scope.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button" type="submit">
              Switch
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Profile & privacy"
            title={detail ? "Update saved profile" : "Create optional profile"}
            id="guest-profile-details"
            helpTopic="auth.sessions"
          />
          <form action={saveOwnGuestProfileAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <input
              type="hidden"
              name="expectedRowVersion"
              value={detail?.profile.rowVersion ?? ""}
            />
            <label>
              First name
              <input
                name="firstName"
                maxLength={80}
                defaultValue={detail?.profile.firstName ?? ""}
                required
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                maxLength={80}
                defaultValue={detail?.profile.lastName ?? ""}
                required
              />
            </label>
            <label>
              Preferred name
              <input
                name="preferredName"
                maxLength={80}
                defaultValue={detail?.profile.preferredName ?? ""}
              />
            </label>
            <label>
              Contact email
              <input
                name="contactEmail"
                type="email"
                maxLength={254}
                defaultValue={detail?.profile.contactEmail ?? session.user.email}
              />
            </label>
            <label>
              Contact phone
              <input
                name="contactPhone"
                maxLength={40}
                defaultValue={detail?.profile.contactPhone ?? ""}
              />
            </label>
            <label>
              Preferred contact
              <select
                name="preferredContactChannel"
                defaultValue={detail?.profile.preferredContactChannel ?? "email"}
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
                defaultChecked={detail?.profile.saveStayPreferences ?? true}
              />{" "}
              Save reusable RV, vehicle and pet stay information.
            </label>
            <label className={styles.full}>
              <input
                type="checkbox"
                name="allowStaffProfileLookup"
                defaultChecked={detail?.profile.allowStaffProfileLookup ?? true}
              />{" "}
              Allow ordinary staff profile lookup for future stays.
            </label>
            <button className="primary-button" type="submit">
              Save profile & privacy choices
            </button>
          </form>
          <p>
            Messaging consent, STOP/START/HELP and marketing preferences remain
            controlled by the existing communications-consent ledger. This page
            does not silently opt you into marketing.
          </p>
        </section>

        {detail ? (
          <>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Reusable equipment"
                title="RV profiles"
                id="guest-rvs"
                helpTopic="accommodation.inventory"
              />
              {detail.rvs.map((item) => (
                <p key={item.id}>
                  <strong>{item.nickname}</strong> · {item.rvKind}
                  {item.make ? " · " + item.make : ""}
                  {item.model ? " " + item.model : ""}
                  {item.lengthFeet ? " · " + item.lengthFeet + " ft" : ""}
                  {" "}
                  {archiveForm(
                    selected.campgroundId,
                    detail.profile.id,
                    item.id,
                    "rv",
                    item.rowVersion,
                  )}
                </p>
              ))}
              <form action={saveOwnRvAction} className={styles.formGrid}>
                <input type="hidden" name="campgroundId" value={selected.campgroundId} />
                <input type="hidden" name="profileId" value={detail.profile.id} />
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
                <label>Make<input name="make" maxLength={80} /></label>
                <label>Model<input name="model" maxLength={80} /></label>
                <label>Year<input name="modelYear" type="number" min={1900} max={2200} /></label>
                <label>Length (ft)<input name="lengthFeet" type="number" min={1} max={120} step="0.1" /></label>
                <label>Slide-outs<input name="slideOutCount" type="number" min={0} max={12} defaultValue={0} /></label>
                <label>
                  Electrical service
                  <select name="electricalServiceAmps" defaultValue="">
                    <option value="">Unknown / none</option>
                    <option value="15">15 amp</option>
                    <option value="30">30 amp</option>
                    <option value="50">50 amp</option>
                  </select>
                </label>
                <label className={styles.full}>Notes<textarea name="notes" maxLength={1000} /></label>
                <button className="primary-button" type="submit" disabled={!detail.profile.saveStayPreferences}>Save RV</button>
              </form>
            </section>

            <section className="content-panel">
              <SectionHeading eyebrow="Reusable travel details" title="Vehicle profiles" id="guest-vehicles" helpTopic="accommodation.inventory" />
              <p>Plate and jurisdiction are intentionally not stored here; formal road-vehicle registration arrives in Build 053.</p>
              {detail.vehicles.map((item) => (
                <p key={item.id}>
                  <strong>{item.nickname}</strong> · {item.vehicleKind}
                  {item.make ? " · " + item.make : ""}
                  {item.model ? " " + item.model : ""}
                  {" "}
                  {archiveForm(selected.campgroundId, detail.profile.id, item.id, "vehicle", item.rowVersion)}
                </p>
              ))}
              <form action={saveOwnVehicleAction} className={styles.formGrid}>
                <input type="hidden" name="campgroundId" value={selected.campgroundId} />
                <input type="hidden" name="profileId" value={detail.profile.id} />
                <label>Nickname<input name="nickname" maxLength={80} required /></label>
                <label>
                  Vehicle type
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
                <label>Make<input name="make" maxLength={80} /></label>
                <label>Model<input name="model" maxLength={80} /></label>
                <label>Colour<input name="color" maxLength={60} /></label>
                <label>Year<input name="modelYear" type="number" min={1900} max={2200} /></label>
                <label className={styles.full}>Notes<textarea name="notes" maxLength={1000} /></label>
                <button className="primary-button" type="submit" disabled={!detail.profile.saveStayPreferences}>Save vehicle</button>
              </form>
            </section>

            <section className="content-panel">
              <SectionHeading eyebrow="Reusable companion details" title="Pet profiles" id="guest-pets" helpTopic="accommodation.inventory" />
              {detail.pets.map((item) => (
                <p key={item.id}>
                  <strong>{item.name}</strong> · {item.species}
                  {item.breed ? " · " + item.breed : ""}
                  {" "}
                  {archiveForm(selected.campgroundId, detail.profile.id, item.id, "pet", item.rowVersion)}
                </p>
              ))}
              <form action={saveOwnPetAction} className={styles.formGrid}>
                <input type="hidden" name="campgroundId" value={selected.campgroundId} />
                <input type="hidden" name="profileId" value={detail.profile.id} />
                <label>Name<input name="name" maxLength={80} required /></label>
                <label>
                  Species
                  <select name="species" defaultValue="dog">
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>Breed<input name="breed" maxLength={80} /></label>
                <label>Weight (kg)<input name="weightKg" type="number" min="0.1" max={250} step="0.1" /></label>
                <label className={styles.full}>Notes<textarea name="notes" maxLength={1000} /></label>
                <button className="primary-button" type="submit" disabled={!detail.profile.saveStayPreferences}>Save pet</button>
              </form>
            </section>

            <section className="content-panel">
              <SectionHeading eyebrow="History" title="Stays, long-term assignments & receipts" id="guest-history" helpTopic="auth.sessions" />
              <h3>Reservation stays</h3>
              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th>Stay</th><th>Accommodation</th><th>Status</th><th>Confirmation</th><th>Total</th></tr></thead>
                  <tbody>
                    {detail.stays.map((stay) => (
                      <tr key={stay.id}>
                        <td>{stay.arrivalDate} → {stay.departureDate}</td>
                        <td>{stay.accommodationCode} · {stay.accommodationName}</td>
                        <td>{stay.status}</td>
                        <td>{stay.confirmationNumber ?? "—"}</td>
                        <td>{formatMoney(stay.totalCents, stay.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Seasonal/yearly assignments</h3>
              {detail.seasonalAssignments.map((assignment) => (
                <p key={assignment.id}>
                  {assignment.assignmentKind} · {assignment.accommodationCode} · {assignment.startsOn} to {assignment.endsOn} · {assignment.assignmentState}
                </p>
              ))}
              <h3>Receipts</h3>
              {detail.receipts.map((receipt) => (
                <p key={receipt.id}>
                  {receipt.receiptNumber} · {receipt.paymentPurpose} · {formatMoney(receipt.amountCents, receipt.currencyCode)}
                </p>
              ))}
              {detail.stays.length === 0 && detail.receipts.length === 0 && detail.seasonalAssignments.length === 0 ? <p>No linked stay history is available yet.</p> : null}
            </section>
          </>
        ) : null}

        <section className="content-panel">
          <h2>Channel contract & privacy boundary</h2>
          <p><strong>Web/PWA:</strong> full guest profile, privacy, saved-stay and history experience.</p>
          <p><strong>IVR/DTMF:</strong> verified guests can request concise profile/stay status; complex edits use verified staff assistance or a secure web handoff.</p>
          <p><strong>SMS/MMS:</strong> verified concise profile/stay lookup and secure-link handoff are supported. Sensitive profile details are not echoed into unverified messages.</p>
          <p>Raw payment-card details, passwords, medical records and formal road-vehicle registration data are never stored in Build 048 guest profiles.</p>
        </section>
      </div>
    </AppShell>
  );
}
