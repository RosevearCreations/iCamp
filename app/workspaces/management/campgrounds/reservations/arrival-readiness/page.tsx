import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listStaffArrivalReadiness } from "@/lib/arrival-planner/postgres.mjs";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

import { reviewArrivalPlanAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Arrival-readiness worklist · iCamp",
  description:
    "Permission-scoped upcoming reservation and guest pre-registration checklist review.",
  robots: { index: false, follow: false },
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ArrivalReadinessPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    error?: string;
    reviewed?: string;
  }>;
}>) {
  const path =
    "/workspaces/management/campgrounds/reservations/arrival-readiness";
  const session = await requireStaff(path);
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Arrival readiness unavailable</h1>
          <p>
            The database is not connected. No review or check-in change was
            made.
          </p>
        </section>
      </AppShell>
    );
  }
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (item) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        if (!auth) return null;
        return auth.permissions.includes("reservation.read") ||
          auth.permissions.includes("reservation.modify")
          ? { ...item, permissions: auth.permissions }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const current =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const canReview = current.permissions.includes("reservation.modify");
  const arrivals = await listStaffArrivalReadiness({
    userId: session.user.id,
    campgroundId: current.campgroundId,
  });
  const awaiting = arrivals.filter((item) => item.plan?.state === "submitted");
  const needsFollowup = awaiting.filter(
    (item) =>
      !item.reviewCurrent || item.review?.outcome === "follow_up_needed",
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/reservations">
            Reservations
          </Link>
          <span>/</span>
          <span>Arrival readiness</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 177 · Internal front desk</p>
          <h1>Upcoming arrival-readiness worklist</h1>
          <p className="hero-panel__lead">
            Compare guest-submitted plans with the canonical reservation and
            record a version-pinned checklist review. Only the existing check-in
            process may change reservation status or authorize access.
          </p>
        </section>
        {params.reviewed ? (
          <p className="content-panel" role="status">
            Internal checklist review saved. No guest message or check-in action
            was sent.
          </p>
        ) : null}
        {params.error ? (
          <p className="content-panel" role="alert">
            Review could not be saved. Provide a reason for follow-up and reload
            if the reservation or guest plan changed.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Assigned campground scope"
            title="Arrival desk"
            id="arrival-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className="form-grid">
            <label>
              Campground
              <select name="campground" defaultValue={current.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button" type="submit">
              Open arrivals
            </button>
          </form>
          <p>
            {arrivals.length} reservations in the arrival window;{" "}
            {awaiting.length} submitted pre-registration plans;{" "}
            {needsFollowup.length} awaiting current review or follow-up.
          </p>
          <p>
            This window covers yesterday through the next 14 days, scoped to
            this property. Billing, messaging and gate operations stay HELD.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Source-grounded arrival records"
            title="Guest preparation and office review"
            id="arrival-worklist"
            helpTopic="campground.structure"
          />
          {arrivals.length === 0 ? (
            <p>
              No confirmed or checked-in reservations appear in this arrival
              window.
            </p>
          ) : (
            <div className="page-stack">
              {arrivals.map((item) => {
                const plan = item.plan;
                const review = item.review;
                const mismatches = [
                  plan &&
                  plan.sourceReservationVersion !== item.reservationVersion
                    ? "Reservation changed after guest submitted this plan"
                    : null,
                  plan?.expectedVehicleCount != null &&
                  plan.expectedVehicleCount !== item.bookedVehicleCount
                    ? "Vehicle count differs from reservation"
                    : null,
                  plan?.expectedVisitorCount != null &&
                  plan.expectedVisitorCount !== item.bookedVisitorCount
                    ? "Visitor count differs from reservation"
                    : null,
                  plan?.expectedArrivalTime &&
                  item.checkInTime &&
                  plan.expectedArrivalTime < item.checkInTime
                    ? "Estimated time is before standard check-in"
                    : null,
                  plan?.documentPreparation === "need_help"
                    ? "Guest needs document guidance"
                    : null,
                ].filter(Boolean);
                return (
                  <article key={item.reservationId} className="content-panel">
                    <h3>
                      {item.guestName} · {item.accommodationCode}
                    </h3>
                    <p>
                      {item.arrivalDate} to {item.departureDate} ·{" "}
                      {label(item.status)} · check-in begins{" "}
                      {item.checkInTime ?? "office confirmation required"}.
                    </p>
                    <p>
                      <strong>Guest plan:</strong>{" "}
                      {plan ? label(plan.state) : "Not started"}.{" "}
                      <strong>Staff receipt:</strong>{" "}
                      {item.reviewCurrent && review
                        ? label(review.outcome)
                        : review
                          ? "Stale — recheck required"
                          : "No current review"}
                      .
                    </p>
                    {plan ? (
                      <>
                        <p>
                          Estimated arrival{" "}
                          {plan.expectedArrivalTime ?? "not set"};{" "}
                          {label(plan.arrivalMode)}; vehicles{" "}
                          {plan.expectedVehicleCount ?? "not set"} (booked{" "}
                          {item.bookedVehicleCount}); visitors{" "}
                          {plan.expectedVisitorCount ?? "not set"} (booked{" "}
                          {item.bookedVisitorCount}).
                        </p>
                        <p>
                          Documents: {label(plan.documentPreparation)} · Guest
                          rules reviewed: {plan.rulesReviewed ? "yes" : "no"}.
                        </p>
                        {plan.assistanceRequested ? (
                          <p>
                            <strong>
                              Guest-consented accessibility assistance:
                            </strong>{" "}
                            {plan.assistanceNote ??
                              "Requested — contact guest through approved office process"}
                            .
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {mismatches.length ? (
                      <ul>
                        {mismatches.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                    {review?.note && item.reviewCurrent ? (
                      <p>Staff follow-up note: {review.note}</p>
                    ) : null}
                    <p>
                      <Link
                        href={`/workspaces/management/campgrounds/reservations/check-in?campground=${encodeURIComponent(item.campgroundId)}&reservation=${encodeURIComponent(item.reservationId)}`}
                      >
                        Open canonical front-desk check-in verification
                      </Link>
                    </p>
                    {canReview &&
                    plan?.state === "submitted" &&
                    plan.sourceReservationVersion === item.reservationVersion &&
                    item.status === "confirmed" &&
                    !item.checkedIn ? (
                      <form
                        action={reviewArrivalPlanAction}
                        className="form-grid"
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={item.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="reservationId"
                          value={item.reservationId}
                        />
                        <input
                          type="hidden"
                          name="expectedPlanVersion"
                          value={plan.rowVersion}
                        />
                        <input
                          type="hidden"
                          name="expectedReservationVersion"
                          value={item.reservationVersion}
                        />
                        <label>
                          Staff checklist result (never check-in approval)
                          <select
                            name="outcome"
                            defaultValue={
                              item.reviewCurrent
                                ? review?.outcome
                                : "follow_up_needed"
                            }
                          >
                            <option value="follow_up_needed">
                              Follow-up needed
                            </option>
                            <option value="reviewed">
                              Pre-registration reviewed for desk
                            </option>
                          </select>
                        </label>
                        <label>
                          Staff note (required for follow-up)
                          <textarea
                            name="note"
                            rows={2}
                            maxLength={300}
                            defaultValue={
                              item.reviewCurrent ? (review?.note ?? "") : ""
                            }
                            placeholder="Describe the check or remaining question"
                          />
                        </label>
                        <button type="submit" className="secondary-button">
                          Record staff checklist review
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
          <p>
            Review receipts are source-versioned. Guest edits or reservation
            changes make an older receipt stale. Office verification and the
            existing check-in authorization remain separate.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
