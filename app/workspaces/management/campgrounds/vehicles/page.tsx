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
import { listRoadVehicleRegistrationDesk } from "@/lib/road-vehicle-registration/postgres.mjs";

import {
  registerRoadVehicleAction,
  revokeRoadVehicleAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Road Vehicle Registration · iCamp",
  description:
    "Register campground-hosted cars, trucks, motorcycles and tow vehicles with plate, driver, host accommodation and validity evidence.",
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function addDays(value: string, days: number) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function savedVehicleLabel(vehicle: {
  guestName: string;
  nickname: string;
  vehicleKind: string;
  make: string | null;
  model: string | null;
  color: string | null;
  modelYear: number | null;
}) {
  const description = [
    vehicle.modelYear,
    vehicle.make,
    vehicle.model,
    vehicle.color,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    vehicle.guestName +
    " · " +
    vehicle.nickname +
    " · " +
    statusLabel(vehicle.vehicleKind) +
    (description ? " · " + description : "")
  );
}

export default async function RoadVehicleRegistrationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/vehicles";
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

        const canRead =
          authorization.permissions.includes("vehicle.read") ||
          authorization.permissions.includes("vehicle.register");

        return canRead ? { ...campground, authorization } : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const data = await listRoadVehicleRegistrationDesk({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  const mayRegister =
    selected.authorization.permissions.includes("vehicle.register") &&
    data.canRegister;
  const tomorrow = addDays(data.campground.localDate, 1);

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
          <span>Road Vehicles</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 053 · Front desk & security operations</p>
          <h1>Road Vehicle Registration</h1>
          <p className="hero-panel__lead">
            Register campground-hosted road vehicles against a host
            accommodation with plate/jurisdiction, owner and driver, date
            validity and revocation evidence. Day/week passes and extra-vehicle
            fees remain Build 054.
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
            title="Vehicle desk"
            id="road-vehicle-scope"
            helpTopic="vehicle.registration"
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
              Open vehicle desk
            </button>
          </form>
          <p>
            Campground-local date: <strong>{data.campground.localDate}</strong>{" "}
            ({data.campground.timeZone}).
          </p>
          <p>
            <Link
              href={
                "/workspaces/management/campgrounds/reservations?campground=" +
                encodeURIComponent(selected.campgroundId)
              }
            >
              Open reservation management →
            </Link>
          </p>
        </section>

        {mayRegister ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Formal registration"
              title="Register a road vehicle"
              id="road-vehicle-register"
              helpTopic="vehicle.registration"
            />
            <p>
              A Build 048 saved vehicle can be linked for identity continuity,
              but plate/jurisdiction stays in this formal registration record
              and is never copied into the reusable guest profile.
            </p>
            <form action={registerRoadVehicleAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />

              <label>
                Host accommodation
                <select name="hostAccommodationId" required>
                  <option value="">Select accommodation</option>
                  {data.accommodations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.displayName} ·{" "}
                      {statusLabel(item.statusState)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Linked reservation (optional)
                <select name="reservationId">
                  <option value="">No reservation link</option>
                  {data.reservations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.guestName} · {item.accommodationCode} ·{" "}
                      {item.arrivalDate} → {item.departureDate} ·{" "}
                      {statusLabel(item.status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.full}>
                Saved guest vehicle (optional)
                <select name="guestVehicleProfileId">
                  <option value="">Manual vehicle description</option>
                  {data.savedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {savedVehicleLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Vehicle type
                <select name="vehicleKind" defaultValue="car" required>
                  <option value="car">Car</option>
                  <option value="truck">Truck</option>
                  <option value="suv">SUV</option>
                  <option value="van">Van</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="tow_vehicle">Tow vehicle</option>
                  <option value="other">Other road vehicle</option>
                </select>
              </label>

              <label>
                Plate number
                <input name="plateNumber" maxLength={24} required />
              </label>

              <label>
                Plate jurisdiction
                <input
                  name="plateJurisdiction"
                  maxLength={40}
                  defaultValue="ON"
                  required
                />
              </label>

              <label className={styles.full}>
                Vehicle description
                <input
                  name="vehicleDescription"
                  maxLength={240}
                  placeholder="e.g. 2024 blue Ford F-150"
                  required
                />
              </label>

              <label>
                Registered owner
                <input name="registeredOwnerName" maxLength={160} required />
              </label>

              <label>
                Primary driver
                <input name="primaryDriverName" maxLength={160} required />
              </label>

              <label>
                Valid from
                <input
                  name="validFrom"
                  type="date"
                  defaultValue={data.campground.localDate}
                  required
                />
              </label>

              <label>
                Valid until
                <input
                  name="validUntil"
                  type="date"
                  defaultValue={tomorrow}
                  required
                />
              </label>

              <label className={styles.full}>
                Registration notes
                <textarea name="notes" maxLength={2000} />
              </label>

              <button className="primary-button" type="submit">
                Register road vehicle
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Current & historical evidence"
            title={selected.campgroundName}
            id="road-vehicle-list"
            helpTopic="vehicle.registration"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Plate</th>
                  <th>Vehicle</th>
                  <th>Owner / driver</th>
                  <th>Host</th>
                  <th>Validity</th>
                  <th>Status</th>
                  {mayRegister ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.registrations.map((registration) => (
                  <tr key={registration.id}>
                    <td>
                      <strong>{registration.plateNumber}</strong>
                      <br />
                      {registration.plateJurisdiction}
                    </td>
                    <td>
                      {registration.vehicleDescription}
                      <br />
                      <small>{statusLabel(registration.vehicleKind)}</small>
                    </td>
                    <td>
                      Owner: {registration.registeredOwnerName}
                      <br />
                      Driver: {registration.primaryDriverName}
                    </td>
                    <td>{registration.hostAccommodationLabel}</td>
                    <td>
                      {registration.validFrom} → {registration.validUntil}
                    </td>
                    <td>{statusLabel(registration.effectiveStatus)}</td>
                    {mayRegister ? (
                      <td>
                        {registration.effectiveStatus === "active" ? (
                          <form action={revokeRoadVehicleAction}>
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="registrationId"
                              value={registration.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={registration.rowVersion}
                            />
                            <label>
                              Revocation reason
                              <input
                                name="reason"
                                maxLength={500}
                                minLength={3}
                                required
                              />
                            </label>
                            <button type="submit">Revoke</button>
                          </form>
                        ) : registration.revocationReason ? (
                          registration.revocationReason
                        ) : (
                          "No action required"
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.registrations.length === 0 ? (
            <p>No road vehicle registrations are recorded for this campground.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <h2>Channel, fee and access boundaries</h2>
          <p>
            <strong>Web/PWA:</strong> full registration desk, saved-vehicle
            linkage, plate/jurisdiction entry, host accommodation, validity and
            revocation.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> a verified guest/staff workflow may
            provide concise plate, vehicle and host details through the existing
            canonical <code>vehicle.register</code> command; ambiguous or visual
            review falls back to staff assistance.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified guided registration can use the
            same canonical workflow, with a secure-link or staff handoff when a
            protected visual review is needed. Plate data is not echoed before
            verification.
          </p>
          <p>
            This build records the vehicle and host relationship only.{" "}
            <strong>Build 054</strong> owns non-stay day/week vehicle passes,
            extra-vehicle fees and parking/access rules.{" "}
            <strong>Build 056/063</strong> owns access credential issuance and
            lifecycle.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
