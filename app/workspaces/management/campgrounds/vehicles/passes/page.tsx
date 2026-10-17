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
import { listVehiclePassDesk } from "@/lib/vehicle-pass/postgres.mjs";

import {
  captureVehiclePassPaymentAction,
  issueExtraVehiclePassAction,
  issueNonStayVehiclePassAction,
  revokeVehiclePassAction,
  saveVehiclePassPolicyAction,
} from "./actions";
import styles from "../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vehicle Passes & Fees · iCamp",
  description:
    "Issue day/week road-vehicle passes, assess extra-vehicle fees, capture payment and preserve parking/access rule snapshots.",
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

function money(cents: number, currencyCode: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}

function addHours(localDateTime: string, hours: number) {
  const date = new Date(localDateTime + ":00Z");
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export default async function VehiclePassesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/vehicles/passes";
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
          authorization.permissions.includes("vehicle.pass.issue") ||
          authorization.permissions.includes("payment.read");

        return canRead ? { ...campground, authorization } : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];

  const data = await listVehiclePassDesk({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  const dayCharges = data.charges.filter(
    (charge) => charge.chargeKind === "pass" && charge.passDurationDays === 1,
  );
  const weekCharges = data.charges.filter(
    (charge) => charge.chargeKind === "pass" && charge.passDurationDays === 7,
  );
  const extraCharges = data.charges.filter(
    (charge) =>
      ["add_on", "service_fee"].includes(charge.chargeKind) &&
      charge.pricingBasis === "per_unit",
  );
  const eligibleExtraVehicles = data.registrations.filter(
    (registration) =>
      registration.activeVehicleCount > data.policy.includedStayVehicleCount &&
      !registration.hasOpenExtraPass,
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
              "/workspaces/management/campgrounds/vehicles?campground=" +
              encodeURIComponent(selected.campgroundId)
            }
          >
            Road Vehicles
          </Link>
          <span>/</span>
          <span>Passes & Fees</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 054 · Vehicle access operations</p>
          <h1>Day/Week Vehicle Passes & Extra-Vehicle Fees</h1>
          <p className="hero-panel__lead">
            Issue non-stay day/week passes, assess configured extra-vehicle
            charges, capture provider-neutral payment, and snapshot the parking
            and access instructions that applied when each pass was issued.
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
            title="Vehicle pass desk"
            id="vehicle-pass-scope"
            helpTopic="vehicle.passes"
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
              Open pass desk
            </button>
          </form>
          <p>
            Campground-local time:{" "}
            <strong>{data.campground.localDateTime}</strong> (
            {data.campground.timeZone}).
          </p>
        </section>

        {data.canManagePolicy ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Policy"
              title="Canonical fees, parking & access rules"
              id="vehicle-pass-policy"
              helpTopic="vehicle.passes"
            />
            <p>
              Fee choices come from the Build 040 canonical charge catalogue.
              Leave a fee unselected to make that pass type free. Changing this
              policy never rewrites passes already issued.
            </p>
            <form
              action={saveVehiclePassPolicyAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input
                type="hidden"
                name="rowVersion"
                value={data.policy.rowVersion}
              />

              <label>
                Day-pass fee
                <select
                  name="dayPassChargeId"
                  defaultValue={data.policy.dayPassChargeId ?? ""}
                >
                  <option value="">Free / no configured fee</option>
                  {dayCharges.map((charge) => (
                    <option key={charge.id} value={charge.id}>
                      {charge.displayName} ·{" "}
                      {money(charge.unitPriceCents, charge.currencyCode)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Week-pass fee
                <select
                  name="weekPassChargeId"
                  defaultValue={data.policy.weekPassChargeId ?? ""}
                >
                  <option value="">Free / no configured fee</option>
                  {weekCharges.map((charge) => (
                    <option key={charge.id} value={charge.id}>
                      {charge.displayName} ·{" "}
                      {money(charge.unitPriceCents, charge.currencyCode)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Extra-vehicle fee
                <select
                  name="extraVehicleChargeId"
                  defaultValue={data.policy.extraVehicleChargeId ?? ""}
                >
                  <option value="">Free / no configured fee</option>
                  {extraCharges.map((charge) => (
                    <option key={charge.id} value={charge.id}>
                      {charge.displayName} ·{" "}
                      {money(charge.unitPriceCents, charge.currencyCode)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Included stay vehicles
                <input
                  name="includedStayVehicleCount"
                  type="number"
                  min={0}
                  max={20}
                  defaultValue={data.policy.includedStayVehicleCount}
                  required
                />
              </label>

              <label className={styles.full}>
                Parking rule
                <textarea
                  name="parkingRule"
                  maxLength={1000}
                  defaultValue={data.policy.parkingRule}
                  required
                />
              </label>

              <label className={styles.full}>
                Access rule
                <textarea
                  name="accessRule"
                  maxLength={1000}
                  defaultValue={data.policy.accessRule}
                  required
                />
              </label>

              <button className="primary-button" type="submit">
                Save vehicle pass policy
              </button>
            </form>
          </section>
        ) : null}

        {data.canIssue ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Non-stay vehicles"
              title="Issue a day or week pass"
              id="vehicle-pass-issue"
              helpTopic="vehicle.passes"
            />
            <p>
              Day passes may span at most 24 hours; week passes may span at most
              seven days. The pass remains pending if a configured fee must be
              captured.
            </p>
            <form
              action={issueNonStayVehiclePassAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />

              <label>
                Pass type
                <select name="passKind" defaultValue="day" required>
                  <option value="day">Day pass</option>
                  <option value="week">Week pass</option>
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

              <label>
                Driver
                <input name="driverName" maxLength={160} required />
              </label>

              <label className={styles.full}>
                Vehicle description
                <input name="vehicleDescription" maxLength={240} required />
              </label>

              <label>
                Valid from
                <input
                  name="validFromLocal"
                  type="datetime-local"
                  defaultValue={data.campground.localDateTime}
                  required
                />
              </label>

              <label>
                Valid until
                <input
                  name="validUntilLocal"
                  type="datetime-local"
                  defaultValue={addHours(data.campground.localDateTime, 12)}
                  required
                />
              </label>

              <label className={styles.full}>
                Notes
                <textarea name="notes" maxLength={2000} />
              </label>

              <button className="primary-button" type="submit">
                Issue vehicle pass
              </button>
            </form>
          </section>
        ) : null}

        {data.canIssue ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Stay-linked vehicles"
              title="Assess an extra-vehicle pass"
              id="extra-vehicle-pass"
              helpTopic="vehicle.passes"
            />
            <p>
              Only active stay registrations beyond the configured included
              vehicle count appear here. The pass inherits the formal plate,
              driver and host accommodation from Build 053.
            </p>
            {eligibleExtraVehicles.length > 0 ? (
              <form
                action={issueExtraVehiclePassAction}
                className={styles.formGrid}
              >
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected.campgroundId}
                />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={randomUUID()}
                />

                <label className={styles.full}>
                  Registered stay vehicle
                  <select name="roadVehicleRegistrationId" required>
                    <option value="">Select vehicle</option>
                    {eligibleExtraVehicles.map((registration) => (
                      <option key={registration.id} value={registration.id}>
                        {registration.plateJurisdiction}{" "}
                        {registration.plateNumber} ·{" "}
                        {registration.vehicleDescription} ·{" "}
                        {registration.hostAccommodationLabel} ·{" "}
                        {registration.activeVehicleCount} active vehicles
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Valid from
                  <input
                    name="validFromLocal"
                    type="datetime-local"
                    defaultValue={data.campground.localDateTime}
                    required
                  />
                </label>

                <label>
                  Valid until
                  <input
                    name="validUntilLocal"
                    type="datetime-local"
                    defaultValue={addHours(data.campground.localDateTime, 24)}
                    required
                  />
                </label>

                <label className={styles.full}>
                  Notes
                  <textarea name="notes" maxLength={2000} />
                </label>

                <button className="primary-button" type="submit">
                  Assess extra-vehicle pass
                </button>
              </form>
            ) : (
              <p>
                No active stay registration currently requires an extra-vehicle
                pass under the configured included-vehicle count.
              </p>
            )}
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Operations"
            title="Current & historical vehicle passes"
            id="vehicle-pass-list"
            helpTopic="vehicle.passes"
          />
          {data.passes.length === 0 ? (
            <p>No vehicle passes have been issued for this campground.</p>
          ) : (
            <div className="page-stack">
              {data.passes.map((pass) => (
                <article className="content-panel" key={pass.id}>
                  <div>
                    <div>
                      <strong>{pass.passNumber}</strong>
                      <div>
                        {label(pass.passKind)} · {pass.plateJurisdiction}{" "}
                        {pass.plateNumber}
                      </div>
                    </div>
                    <span>{label(pass.effectiveStatus)}</span>
                  </div>

                  <p>{pass.vehicleDescription}</p>
                  <p>
                    Driver: <strong>{pass.driverName}</strong>
                  </p>
                  <p>
                    Valid: {formatDateTime(pass.validFrom)} →{" "}
                    {formatDateTime(pass.validUntil)}
                  </p>
                  <p>
                    Fee:{" "}
                    <strong>
                      {money(pass.feeAmountCents, pass.currencyCode)}
                    </strong>{" "}
                    · payment {label(pass.paymentState)}
                  </p>
                  <p>
                    Parking: {pass.parkingRuleSnapshot}
                    <br />
                    Access: {pass.accessRuleSnapshot}
                  </p>

                  {pass.passStatus === "pending_payment" &&
                  data.canCapturePayment ? (
                    <form
                      action={captureVehiclePassPaymentAction}
                      className={styles.inlineForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="vehiclePassId"
                        value={pass.id}
                      />
                      <button className="primary-button" type="submit">
                        Capture configured fee
                      </button>
                    </form>
                  ) : null}

                  {pass.passStatus !== "revoked" && data.canIssue ? (
                    <form
                      action={revokeVehiclePassAction}
                      className={styles.inlineForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="vehiclePassId"
                        value={pass.id}
                      />
                      <input
                        type="hidden"
                        name="rowVersion"
                        value={pass.rowVersion}
                      />
                      <label>
                        Revocation reason
                        <input
                          name="reason"
                          minLength={3}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button type="submit">Revoke pass</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Channel parity"
            title="Same authority, safe channel handoff"
            id="vehicle-pass-channels"
            helpTopic="vehicle.passes"
          />
          <p>
            <strong>Web/PWA:</strong> full pass policy, issuance, payment and
            revocation desk.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified callers can provide concise
            vehicle/pass facts, but payment credentials are never collected by
            the custom IVR; payment completes through staff-assisted or hosted
            provider flow.
          </p>
          <p>
            <strong>SMS/MMS:</strong> verified guided pass facts use the same
            canonical command, with secure-link handoff for payment and visual
            policy review. Raw payment credentials are never requested by SMS.
          </p>
          <p>
            Build 056 owns access credentials and Build 060 owns enforceable
            access zones/schedules. Build 054 stores only the human-readable
            parking/access rule snapshot that applied when the pass was issued.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
