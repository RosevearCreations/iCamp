import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { arrivalReadiness } from "@/lib/arrival-planner/core.mjs";
import { getOwnArrivalPlanBundle } from "@/lib/arrival-planner/postgres.mjs";
import { getMyStayDetail, listMyStays } from "@/lib/my-stay/postgres.mjs";

import { saveArrivalPlanAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Arrival planner · iCamp",
  description:
    "Prepare for a campground stay with an optional secure guest pre-registration checklist.",
  robots: { index: false, follow: false },
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function GuestArrivalPlannerPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    reservation?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Arrival planning is temporarily unavailable</h1>
          <p>
            The live reservation database is not connected. No information was
            saved and check-in was not changed. Please contact the campground
            office for arrival guidance.
          </p>
        </section>
      </AppShell>
    );
  }
  const path = "/guest/arrival-planner";
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  const stays = await listMyStays({ userId: session.user.id });
  const selected =
    stays.find((stay) => stay.id === params.reservation) ??
    stays.find((stay) => stay.status === "confirmed") ??
    null;
  const stay = selected
    ? await getMyStayDetail({
        userId: session.user.id,
        reservationId: selected.id,
      })
    : null;
  const bundle = stay
    ? await getOwnArrivalPlanBundle({
        userId: session.user.id,
        reservationId: stay.reservation.id,
      })
    : null;
  const plan = bundle?.plan ?? null;
  const review = bundle?.review ?? null;
  const readiness = stay ? arrivalReadiness({ stay, plan, review }) : null;
  const canEdit = readiness?.open === true && !stay?.checkIn;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/stay">My Stay</Link>
          <span>/</span>
          <span>Arrival planner</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 177 · Before you arrive</p>
          <h1>Plan your arrival with confidence</h1>
          <p className="hero-panel__lead">
            Review the actual reservation, prepare what the office may need,
            then optionally share estimated arrival details for staff review.
            This is not remote check-in or early-entry authorization.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/guest/stay">
              Back to My Stay
            </Link>
            <Link className="secondary-link" href="/guest/profile">
              Saved guest information
            </Link>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Your reservations"
            title="Choose your stay"
            id="arrival-reservations"
            helpTopic="shell.overview"
          />
          {stays.length === 0 ? (
            <p>No reservation is currently linked to this guest account.</p>
          ) : (
            <ul>
              {stays.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/guest/arrival-planner?reservation=${encodeURIComponent(item.id)}`}
                  >
                    {item.campgroundName} · {item.accommodationCode} ·{" "}
                    {item.arrivalDate} to {item.departureDate} (
                    {statusLabel(item.status)})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {stay && readiness ? (
          <>
            {params.saved === "1" ? (
              <p role="status" className="content-panel">
                Your arrival details were saved internally. The reservation,
                balance and check-in status were not changed.
              </p>
            ) : null}
            {params.error ? (
              <p role="alert" className="content-panel">
                We could not save these details. For submission, include your
                estimated time, vehicle and visitor counts, document plan and
                rules review. If the reservation changed, refresh this page.
              </p>
            ) : null}
            <section className="content-panel">
              <SectionHeading
                eyebrow="Source: current campground reservation"
                title={`${stay.reservation.campground.name} · ${stay.reservation.accommodation.code}`}
                id="arrival-source"
                helpTopic="shell.overview"
              />
              <p>
                Confirmed record: {stay.reservation.arrivalDate} to{" "}
                {stay.reservation.departureDate} ·{" "}
                <strong>{statusLabel(stay.reservation.status)}</strong>.
              </p>
              <p>
                Check-in time:{" "}
                <strong>{stay.rules.currentCheckInTime ?? "Ask office"}</strong>{" "}
                local campground time. Check-out:{" "}
                {stay.rules.currentCheckOutTime ?? "Ask office"}. Your estimated
                arrival is a request, not an approved arrival window.
              </p>
              <p>
                Booked guest/visitor/vehicle record: {stay.party.occupants}{" "}
                occupant(s), {stay.party.visitors} visitor(s),{" "}
                {stay.party.vehicles} vehicle(s), {stay.party.pets} pet(s). Site
                limits are unchanged by this planner.
              </p>
              {stay.rules.guestSummary ? (
                <p>
                  <strong>Campground guidance:</strong>{" "}
                  {stay.rules.guestSummary}
                </p>
              ) : (
                <p>
                  Ask the office for current campground arrival and guest rules.
                </p>
              )}
            </section>
            <section className="content-panel">
              <SectionHeading
                eyebrow={`${readiness.completed} of ${readiness.tasks.length} preparation items`}
                title="Arrival-readiness checklist"
                id="arrival-checklist"
                helpTopic="shell.overview"
              />
              <ul>
                {readiness.tasks.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.complete ? "Prepared · " : "To review · "}
                      {item.label}
                    </strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
              {readiness.differences.length ? (
                <div role="status">
                  <strong>Items for the front desk to verify</strong>
                  <ul>
                    {readiness.differences.map((difference) => (
                      <li key={difference}>{difference}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Optional secure pre-registration"
                title="Share your arrival estimate"
                id="arrival-details"
                helpTopic="shell.overview"
              />
              <p>
                The office will see your latest submitted plan. A saved draft
                stays editable; a submission is still subject to identity,
                documents, capacity, payment and arrival-day verification. No
                SMS, email or gate command is sent.
              </p>
              <p>
                Current plan:{" "}
                <strong>
                  {plan ? statusLabel(plan.state) : "Not started"}
                </strong>
                {plan?.updatedAt
                  ? ` · updated ${plan.updatedAt.slice(0, 10)}`
                  : ""}
                .
              </p>
              {canEdit ? (
                <form action={saveArrivalPlanAction} className="form-grid">
                  <input
                    type="hidden"
                    name="reservationId"
                    value={stay.reservation.id}
                  />
                  <input
                    type="hidden"
                    name="expectedReservationVersion"
                    value={stay.reservation.rowVersion}
                  />
                  <input
                    type="hidden"
                    name="expectedPlanVersion"
                    value={plan?.rowVersion ?? 0}
                  />
                  <label>
                    Estimated arrival time (campground local)
                    <input
                      name="expectedArrivalTime"
                      type="time"
                      defaultValue={plan?.expectedArrivalTime ?? ""}
                    />
                  </label>
                  <label>
                    How will you arrive?
                    <select
                      name="arrivalMode"
                      defaultValue={plan?.arrivalMode ?? "unspecified"}
                    >
                      <option value="unspecified">Not sure yet</option>
                      <option value="personal_vehicle">Personal vehicle</option>
                      <option value="rideshare">Ride or taxi</option>
                      <option value="walking">Walking</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Vehicles expected at arrival
                    <input
                      name="expectedVehicleCount"
                      type="number"
                      min={0}
                      max={20}
                      step={1}
                      defaultValue={plan?.expectedVehicleCount ?? ""}
                      placeholder="Include 0 if none"
                    />
                  </label>
                  <label>
                    Visitors expected at arrival
                    <input
                      name="expectedVisitorCount"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      defaultValue={plan?.expectedVisitorCount ?? ""}
                      placeholder="Include 0 if none"
                    />
                  </label>
                  <label>
                    Confirmation and identification preparation
                    <select
                      name="documentPreparation"
                      defaultValue={plan?.documentPreparation ?? "not_reviewed"}
                    >
                      <option value="not_reviewed">
                        I have not reviewed this yet
                      </option>
                      <option value="will_bring">
                        I plan to bring the office-required documents
                      </option>
                      <option value="need_help">
                        I need the office to explain what to bring
                      </option>
                    </select>
                  </label>
                  <label>
                    <input
                      name="rulesReviewed"
                      type="checkbox"
                      defaultChecked={plan?.rulesReviewed ?? false}
                    />{" "}
                    I reviewed the available campground guidance and understand
                    the office will verify official rules at check-in.
                  </label>
                  <label>
                    <input
                      name="assistanceRequested"
                      type="checkbox"
                      defaultChecked={plan?.assistanceRequested ?? false}
                    />{" "}
                    I choose to share an arrival-access assistance request with
                    authorized office staff.
                  </label>
                  <label>
                    Optional assistance arrangements (300 characters max)
                    <textarea
                      name="assistanceNote"
                      rows={3}
                      maxLength={300}
                      defaultValue={plan?.assistanceNote ?? ""}
                      placeholder="For example: step-free route to the office. Please do not include diagnoses, medical history or identity numbers."
                    />
                  </label>
                  <div className="hero-actions">
                    <button
                      className="secondary-button"
                      type="submit"
                      name="intent"
                      value="draft"
                    >
                      Save editable draft
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      name="intent"
                      value="submitted"
                    >
                      Submit to front desk
                    </button>
                  </div>
                </form>
              ) : (
                <p role="status">
                  Online arrival planning is closed for this reservation. Ask
                  the campground office to assist. Existing check-in remains the
                  authority.
                </p>
              )}
            </section>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Read-only staff feedback"
                title="Front-desk review receipt"
                id="arrival-staff-receipt"
                helpTopic="shell.overview"
              />
              {review && readiness.reviewCurrent ? (
                <>
                  <p role="status">
                    Current staff review:{" "}
                    <strong>{statusLabel(review.outcome)}</strong> (
                    {review.reviewedAt.slice(0, 10)}).
                  </p>
                  {review.note ? <p>Staff note: {review.note}</p> : null}
                </>
              ) : review ? (
                <p role="status">
                  A previous staff review is no longer current because the plan
                  or reservation changed. The office must recheck it.
                </p>
              ) : (
                <p>
                  No staff review receipt has been recorded for this plan yet.
                </p>
              )}
              <p>
                Even a reviewed plan is{" "}
                <strong>not a completed check-in</strong>, payment approval,
                access credential, or confirmation of early arrival. Contact the
                campground office for an assisted alternative.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
