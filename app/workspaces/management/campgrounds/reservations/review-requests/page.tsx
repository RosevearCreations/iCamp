import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listStaffReservationReviewRequests } from "@/lib/reservation-decisions/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Guest reservation review requests · iCamp",
  description:
    "Permission-scoped internal queue for guest date-change and cancellation-review requests.",
  robots: { index: false },
};

export default async function ReservationReviewWorklistPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Review worklist unavailable</h1>
          <p>
            Live reservation data is not connected. No guest requests can be
            read or processed.
          </p>
          <Link href="/workspaces/management/campgrounds/reservations">
            Reservation management
          </Link>
        </section>
      </AppShell>
    );
  }
  const path =
    "/workspaces/management/campgrounds/reservations/review-requests";
  const session = await requireStaff(path);
  const requests = await listStaffReservationReviewRequests({
    userId: session.user.id,
  });
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds/reservations">
            Reservations
          </Link>
          <span>/</span>
          <span>Guest review requests</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 176 · Role-scoped internal worklist</p>
          <h1>Guest date-change and cancellation review</h1>
          <p className="hero-panel__lead">
            Guest intentions only. Staff must independently check the current
            booking, payment policy and evidence in the canonical reservation
            console. This queue never executes a financial or reservation
            action.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Guest-submitted, source versioned"
            title="Requests visible to your assigned campgrounds"
            id="guest-review-queue"
            helpTopic="shell.overview"
          />
          {requests.length === 0 ? (
            <p>
              No accessible guest review requests are waiting in this queue.
            </p>
          ) : (
            <ul>
              {requests.map((request) => (
                <li key={request.id}>
                  <p>
                    <strong>
                      {request.kind === "change_dates"
                        ? "Date-change review"
                        : "Cancellation review"}
                    </strong>{" "}
                    · {request.state} · {request.campgroundName} ·{" "}
                    {request.accommodationCode}
                  </p>
                  <p>
                    Submitted{" "}
                    {request.submittedAt.slice(0, 16).replace("T", " ")} UTC ·
                    reservation revision {request.sourceReservationVersion}
                    {request.sourcePolicyVersion
                      ? ` · policy revision ${request.sourcePolicyVersion}`
                      : " · policy unconfigured"}
                    .
                  </p>
                  {request.arrivalDate && request.departureDate ? (
                    <p>
                      Requested dates: {request.arrivalDate} to{" "}
                      {request.departureDate}
                    </p>
                  ) : null}
                  <p>Guest reason: {request.reason}</p>
                  <p>
                    <Link
                      href={`/workspaces/management/campgrounds/reservations/${encodeURIComponent(request.reservationId)}`}
                    >
                      Review the live reservation and current financial policy
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p>
            There is no automatic staff notification, acceptance, refund, fee or
            external messaging. Staff should compare current live records before
            any separately authorized action.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
