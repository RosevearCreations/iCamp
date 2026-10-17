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
import { listVisitorRegistrationDesk } from "@/lib/visitor-registration/postgres.mjs";

import {
  captureVisitorPaymentAction,
  registerVisitorAction,
  revokeVisitorAction,
  saveVisitorPolicyAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visitor Registration · iCamp",
  description:
    "Register reservation-hosted visitors, enforce site-specific visitor limits, collect configured fees and preserve visit evidence.",
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

function reservationLabel(reservation: {
  externalReference: string | null;
  accommodationCode: string;
  accommodationName: string;
  arrivalDate: string;
  departureDate: string;
  effectiveMaxVisitors: number | null;
  currentOpenVisitors: number;
}) {
  const reference = reservation.externalReference
    ? reservation.externalReference + " · "
    : "";
  const limit =
    reservation.effectiveMaxVisitors === null
      ? "no configured visitor max"
      : reservation.currentOpenVisitors +
        "/" +
        reservation.effectiveMaxVisitors +
        " open visitors";

  return (
    reference +
    reservation.accommodationCode +
    " · " +
    reservation.accommodationName +
    " · " +
    reservation.arrivalDate +
    " → " +
    reservation.departureDate +
    " · " +
    limit
  );
}

export default async function VisitorRegistrationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/visitors";
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
          authorization.permissions.includes("visitor.read") ||
          authorization.permissions.includes("visitor.register") ||
          authorization.permissions.includes("payment.read");

        return canRead ? { ...campground, authorization } : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];

  const data = await listVisitorRegistrationDesk({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  const dayCharges = data.charges.filter(
    (charge) => charge.passDurationDays === 1,
  );
  const weekCharges = data.charges.filter(
    (charge) => charge.passDurationDays === 7,
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
          <span>Visitors</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">
            Build 055 · Front desk & security operations
          </p>
          <h1>Visitor Registration & Site-Specific Limits</h1>
          <p className="hero-panel__lead">
            Register visitors against an active host reservation, resolve the
            exact Build 033 visitor limit for that site, apply configured
            day/week fees, and preserve the visit policy and capacity evidence
            in force when the visitor was registered.
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
            title="Visitor desk"
            id="visitor-scope"
            helpTopic="visitor.registration"
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
              Open visitor desk
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
              title="Identity, contact, fees & visitor rule"
              id="visitor-policy"
              helpTopic="visitor.registration"
            />
            <p>
              Visitor fees reuse the Build 040 canonical pass catalogue.
              Identity verification records the method and operator evidence
              only; Build 055 does not store government-ID numbers or images.
            </p>
            <form action={saveVisitorPolicyAction} className={styles.formGrid}>
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
                Day visitor fee
                <select
                  name="dayVisitChargeId"
                  defaultValue={data.policy.dayVisitChargeId ?? ""}
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
                Week visitor fee
                <select
                  name="weekVisitChargeId"
                  defaultValue={data.policy.weekVisitChargeId ?? ""}
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
                Identity verification
                <select
                  name="identityVerificationMode"
                  defaultValue={data.policy.identityVerificationMode}
                >
                  <option value="none">No identity check required</option>
                  <option value="host_attested">Host attestation</option>
                  <option value="staff_visual">
                    Staff visual identity check
                  </option>
                </select>
              </label>

              <label>
                Contact requirement
                <select
                  name="contactRequirement"
                  defaultValue={data.policy.contactRequirement}
                >
                  <option value="none">No contact required</option>
                  <option value="phone">Phone required</option>
                  <option value="email">Email required</option>
                  <option value="either">Phone or email required</option>
                  <option value="both">Phone and email required</option>
                </select>
              </label>

              <label className={styles.full}>
                Visitor rule
                <textarea
                  name="visitorRule"
                  maxLength={1000}
                  defaultValue={data.policy.visitorRule}
                  required
                />
              </label>

              <button className="primary-button" type="submit">
                Save visitor policy
              </button>
            </form>
          </section>
        ) : null}

        {data.canRegister ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Registration"
              title="Register a visitor"
              id="visitor-register"
              helpTopic="visitor.registration"
            />
            <p>
              The host must have an active pending, confirmed or checked-in
              reservation. Visitor capacity is resolved from the most specific
              matching Build 033 rule and enforced atomically across overlapping
              visit windows.
            </p>
            {data.reservations.length > 0 ? (
              <form action={registerVisitorAction} className={styles.formGrid}>
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
                  Host reservation / site
                  <select name="reservationId" required>
                    <option value="">Select host reservation</option>
                    {data.reservations.map((reservation) => (
                      <option key={reservation.id} value={reservation.id}>
                        {reservationLabel(reservation)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Visit type
                  <select name="visitKind" defaultValue="day" required>
                    <option value="day">Day visitor</option>
                    <option value="week">Week visitor</option>
                  </select>
                </label>

                <label>
                  Visitor name
                  <input name="visitorName" maxLength={160} required />
                </label>

                <label>
                  Phone
                  <input name="contactPhone" maxLength={40} />
                </label>

                <label>
                  Email
                  <input name="contactEmail" type="email" maxLength={254} />
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
                    defaultValue={addHours(data.campground.localDateTime, 8)}
                    required
                  />
                </label>

                {data.policy.identityVerificationMode !== "none" ? (
                  <label className={styles.full}>
                    <input name="identityVerified" type="checkbox" required /> I
                    completed the configured{" "}
                    <strong>
                      {label(data.policy.identityVerificationMode)}
                    </strong>{" "}
                    identity check. No government-ID number or image is stored.
                  </label>
                ) : null}

                <label className={styles.full}>
                  Notes
                  <textarea name="notes" maxLength={2000} />
                </label>

                <button className="primary-button" type="submit">
                  Register visitor
                </button>
              </form>
            ) : (
              <p>
                No active host reservation is currently eligible for visitor
                registration.
              </p>
            )}
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Operations"
            title="Current & historical visitors"
            id="visitor-list"
            helpTopic="visitor.registration"
          />
          {data.registrations.length === 0 ? (
            <p>No visitor registrations have been recorded.</p>
          ) : (
            <div className="page-stack">
              {data.registrations.map((registration) => (
                <article className="content-panel" key={registration.id}>
                  <div>
                    <strong>
                      {registration.visitorNumber} · {registration.visitorName}
                    </strong>
                    <span>{label(registration.effectiveStatus)}</span>
                  </div>
                  <p>
                    Host: <strong>{registration.hostAccommodationLabel}</strong>{" "}
                    · {label(registration.visitKind)}
                  </p>
                  <p>
                    Valid:{" "}
                    {formatDateTime(
                      registration.validFrom,
                      data.campground.timeZone,
                    )}{" "}
                    →{" "}
                    {formatDateTime(
                      registration.validUntil,
                      data.campground.timeZone,
                    )}
                  </p>
                  <p>
                    Site visitor limit:{" "}
                    <strong>
                      {registration.effectiveMaxVisitors === null
                        ? "No configured maximum"
                        : registration.effectiveMaxVisitors}
                    </strong>
                    {registration.capacityRuleScope
                      ? " · " + label(registration.capacityRuleScope)
                      : ""}
                  </p>
                  <p>
                    Contact:{" "}
                    {registration.contactPhone ??
                      registration.contactEmail ??
                      "Not required"}
                    {registration.contactPhone && registration.contactEmail
                      ? " · " + registration.contactEmail
                      : ""}
                  </p>
                  <p>
                    Identity: {label(registration.identityVerificationMode)}
                    {registration.identityVerifiedAt
                      ? " · verified"
                      : " · no verification required"}
                  </p>
                  <p>
                    Fee:{" "}
                    <strong>
                      {money(
                        registration.feeAmountCents,
                        registration.currencyCode,
                      )}
                    </strong>{" "}
                    · payment {label(registration.paymentState)}
                  </p>
                  <p>Visitor rule: {registration.visitorRuleSnapshot}</p>

                  {registration.registrationStatus === "pending_payment" &&
                  data.canCapturePayment ? (
                    <form
                      action={captureVisitorPaymentAction}
                      className={styles.inlineForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="visitorRegistrationId"
                        value={registration.id}
                      />
                      <button className="primary-button" type="submit">
                        Capture configured fee
                      </button>
                    </form>
                  ) : null}

                  {registration.registrationStatus !== "revoked" &&
                  data.canRegister ? (
                    <form
                      action={revokeVisitorAction}
                      className={styles.inlineForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="visitorRegistrationId"
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
                          minLength={3}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button type="submit">Revoke visitor</button>
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
            title="Same visitor authority across channels"
            id="visitor-channels"
            helpTopic="visitor.registration"
          />
          <p>
            <strong>Web/PWA:</strong> full visitor policy, registration,
            capacity evidence, fee capture, history and revocation desk.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified callers can provide concise
            visitor and host facts, with staff/provider handoff for identity or
            payment steps that should not be collected by custom keypad flows.
          </p>
          <p>
            <strong>SMS/MMS:</strong> guided visitor facts use the same
            canonical workflow, with secure-link handoff for protected review
            and payment. Government-ID details and payment credentials are never
            requested by SMS.
          </p>
          <p>
            Build 056 owns access credential abstraction, Build 062 owns
            wristband/QR/pass issuance and validation, Build 063 ties credential
            lifecycle to arrival/departure, and Build 060 owns enforceable
            access zones and schedules. Build 055 registers the visitor only.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
