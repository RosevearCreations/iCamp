import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { QuoteSummary } from "@/app/booking/accommodations/[accommodationId]/quote-summary";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { listMyStays } from "@/lib/my-stay/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getPublicAccommodationDetail } from "@/lib/public-accommodation-detail/postgres.mjs";
import { parseReviewDates } from "@/lib/reservation-decisions/core.mjs";
import {
  getOwnReservationDecisionSource,
  listOwnReservationReviewRequests,
} from "@/lib/reservation-decisions/postgres.mjs";

import {
  submitReservationReviewAction,
  withdrawReservationReviewAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reservation options · iCamp",
  description:
    "Review current cancellation terms and explore a date change without altering your reservation.",
  robots: { index: false, follow: false },
};

const errors: Record<string, string> = {
  consent:
    "Please confirm that you are requesting staff review, not changing your reservation.",
  dates: "Choose different future dates before requesting a change.",
  existing:
    "You already have an active request of this type. Withdraw it before submitting another.",
  withdraw:
    "This request could not be withdrawn. Please contact the office if staff have already acted on it.",
  unavailable:
    "The current reservation or policy could not be verified. Nothing was changed; refresh and try again.",
};

function label(kind: string) {
  return kind === "change_dates" ? "Date-change review" : "Cancellation review";
}

export default async function GuestReservationOptionsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    reservation?: string;
    arrivalDate?: string;
    departureDate?: string;
    error?: string;
    saved?: string;
    withdrawn?: string;
  }>;
}>) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Reservation review is temporarily unavailable</h1>
          <p>
            The live reservation database is not connected. No change,
            cancellation, refund or review request was made. Please ask the
            campground office for help with existing bookings.
          </p>
          <Link href="/booking/map">Booking discovery</Link>
        </section>
      </AppShell>
    );
  }
  const params = await searchParams;
  const session = await requireSignedIn("/guest/reservation-options");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const stays = await listMyStays({ userId: session.user.id });
  const selected = stays.find((stay) => stay.id === params.reservation) ?? null;
  if (!selected) {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="hero-panel">
            <p className="eyebrow">Build 176 · Review first</p>
            <h1>Reservation options</h1>
            <p className="hero-panel__lead">
              Choose one of your own reservations to review its current terms.
              No change or cancellation happens on this screen.
            </p>
          </section>
          <section className="content-panel">
            <h2>Your reservations</h2>
            {stays.length === 0 ? (
              <p>No guest-owned reservations are linked to this account.</p>
            ) : (
              <ul>
                {stays.map((stay) => (
                  <li key={stay.id}>
                    <Link
                      href={`/guest/reservation-options?reservation=${encodeURIComponent(stay.id)}`}
                    >
                      {stay.campgroundName} · {stay.accommodationCode} ·{" "}
                      {stay.arrivalDate} to {stay.departureDate}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/guest/stay">Return to My Stay</Link>
          </section>
        </div>
      </AppShell>
    );
  }
  const [source, requests] = await Promise.all([
    getOwnReservationDecisionSource({
      userId: session.user.id,
      reservationId: selected.id,
    }),
    listOwnReservationReviewRequests({
      userId: session.user.id,
      reservationId: selected.id,
    }),
  ]);
  if (!source) redirect("/guest/reservation-options");
  const { stay, policy, cancellation } = source;
  const canRequest = ["confirmed", "checked_in"].includes(
    stay.reservation.status,
  );
  const canPreviewChange =
    stay.reservation.status === "confirmed" &&
    stay.reservation.arrivalDate > stay.reservation.campgroundLocalDate;
  let candidate = null as ReturnType<typeof parseReviewDates> | null;
  let dateError: string | null = null;
  let freshDetail = null as Awaited<
    ReturnType<typeof getPublicAccommodationDetail>
  >;
  if (params.arrivalDate || params.departureDate) {
    try {
      candidate = parseReviewDates(
        {
          arrivalDate: params.arrivalDate,
          departureDate: params.departureDate,
        },
        stay.reservation.campgroundLocalDate,
      );
      if (canPreviewChange) {
        freshDetail = await getPublicAccommodationDetail({
          campgroundSlug: stay.reservation.campground.slug,
          accommodationId: stay.reservation.accommodation.id,
          arrivalDate: candidate.arrivalDate,
          departureDate: candidate.departureDate,
          selections: [],
        });
      }
    } catch {
      dateError =
        "Choose real future arrival and departure dates for one to 90 nights.";
    }
  }
  const stayPath = "/guest/stay?reservation=" + encodeURIComponent(selected.id);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/stay">My Stay</Link>
          <span>/</span>
          <span>Reservation options</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 176 · Review before any decision</p>
          <h1>Change or cancel? Understand your options first.</h1>
          <p className="hero-panel__lead">
            {stay.reservation.campground.name} ·{" "}
            {stay.reservation.accommodation.code} ·{" "}
            {stay.reservation.arrivalDate} to {stay.reservation.departureDate}
          </p>
        </section>
        {params.saved === "1" ? (
          <p role="status" className="content-panel">
            Your staff-review request was saved internally. Your reservation
            remains unchanged. No message was sent.
          </p>
        ) : null}
        {params.withdrawn === "1" ? (
          <p role="status" className="content-panel">
            Your request was withdrawn. Your reservation remains unchanged.
          </p>
        ) : null}
        {params.error && errors[params.error] ? (
          <p role="alert" className="content-panel">
            {errors[params.error]}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Your confirmed booking record"
            title="What stays in place"
            id="reservation-current"
            helpTopic="shell.overview"
          />
          <p>
            State:{" "}
            <strong>{stay.reservation.status.replaceAll("_", " ")}</strong>.
            Reserved dates:{" "}
            <strong>
              {stay.reservation.arrivalDate} to {stay.reservation.departureDate}
            </strong>
            .
          </p>
          <p>
            Recorded expected payable:{" "}
            <strong>
              {formatMoney(
                stay.payment.expectedPayableCents,
                stay.payment.currencyCode,
              )}
            </strong>{" "}
            · captured to date:{" "}
            {formatMoney(stay.payment.capturedCents, stay.payment.currencyCode)}{" "}
            · outstanding:{" "}
            {formatMoney(
              stay.payment.outstandingCents,
              stay.payment.currencyCode,
            )}
            .
          </p>
          <p>
            These are recorded booking/payment figures, not a new quote or a
            promise of a refund. Unconfigured taxes and extras are never assumed
            to be zero.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Option 1 · No action"
            title="Keep my reservation"
            id="reservation-keep"
            helpTopic="shell.overview"
          />
          <p>
            Your current reservation stays exactly as it is. You can return any
            time to review these choices.
          </p>
          <Link className="primary-link" href={stayPath}>
            Keep my booking and return to My Stay
          </Link>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Option 2 · Availability and repricing"
            title="Explore different dates"
            id="reservation-date-preview"
            helpTopic="shell.overview"
          />
          <p>
            See a fresh, server-priced comparison for the same accommodation. It
            may show your existing reservation as an availability blocker where
            dates overlap. The price of an amendment and any adjustment fee
            require an office review.
          </p>
          {canPreviewChange ? (
            <form method="get" className="form-grid">
              <input type="hidden" name="reservation" value={selected.id} />
              <label>
                New arrival date
                <input
                  type="date"
                  name="arrivalDate"
                  required
                  defaultValue={
                    candidate?.arrivalDate ?? stay.reservation.arrivalDate
                  }
                  min={stay.reservation.campgroundLocalDate}
                />
              </label>
              <label>
                New departure date
                <input
                  type="date"
                  name="departureDate"
                  required
                  defaultValue={
                    candidate?.departureDate ?? stay.reservation.departureDate
                  }
                  min={stay.reservation.campgroundLocalDate}
                />
              </label>
              <button type="submit" className="secondary-button">
                Check live dates and price
              </button>
            </form>
          ) : (
            <p role="status">
              This reservation is no longer eligible for a self-service date
              comparison. Please ask the campground office.
            </p>
          )}
          {dateError ? <p role="alert">{dateError}</p> : null}
          {candidate && canPreviewChange ? (
            <>
              <p>
                <strong>New dates:</strong> {candidate.arrivalDate} to{" "}
                {candidate.departureDate} · {candidate.nights} nights.
              </p>
              {freshDetail ? (
                <>
                  <p role="status">
                    Availability: {freshDetail.availability.label}. This is a
                    separate public rate quotation, not a computed amendment
                    balance.
                  </p>
                  <QuoteSummary quote={freshDetail.quotePreview} />
                </>
              ) : (
                <p role="alert">
                  No current source-backed date quote is available for these
                  dates. No availability or price has been promised.
                </p>
              )}
              {candidate.arrivalDate === stay.reservation.arrivalDate &&
              candidate.departureDate === stay.reservation.departureDate ? (
                <p>
                  Choose dates different from your current booking before
                  requesting a change.
                </p>
              ) : (
                <form
                  action={submitReservationReviewAction}
                  className="form-grid"
                >
                  <input
                    type="hidden"
                    name="reservationId"
                    value={selected.id}
                  />
                  <input type="hidden" name="kind" value="change_dates" />
                  <input
                    type="hidden"
                    name="arrivalDate"
                    value={candidate.arrivalDate}
                  />
                  <input
                    type="hidden"
                    name="departureDate"
                    value={candidate.departureDate}
                  />
                  <input
                    type="hidden"
                    name="expectedReservationVersion"
                    value={stay.reservation.rowVersion}
                  />
                  <input
                    type="hidden"
                    name="expectedPolicyVersion"
                    value={policy?.rowVersion ?? ""}
                  />
                  <input
                    type="hidden"
                    name="idempotencyKey"
                    value={randomUUID()}
                  />
                  <label>
                    Reason for the date change
                    <textarea
                      name="reason"
                      minLength={10}
                      maxLength={500}
                      rows={3}
                      required
                      placeholder="Tell the office what needs to change"
                    />
                  </label>
                  <label>
                    <input type="checkbox" name="confirmReview" required /> I
                    understand this only submits an internal staff-review
                    request; my current booking stays unchanged.
                  </label>
                  <button type="submit" className="primary-button">
                    Request staff review of these dates
                  </button>
                </form>
              )}
            </>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Option 3 · Current campground policy"
            title="Cancellation preview and request"
            id="reservation-cancel-preview"
            helpTopic="shell.overview"
          />
          {policy ? (
            <>
              <p>
                Current policy window:{" "}
                {policy.freeCancellationDaysBeforeArrival} day(s) before
                arrival. Refund basis: {policy.earlyRefundBasisPoints / 100}%
                before the window, {policy.lateRefundBasisPoints / 100}% inside
                it; refundable security deposits follow the separately
                configured {policy.securityDepositRefundBasisPoints / 100}%
                rule.
              </p>
              <p>
                Configured cancellation fee:{" "}
                {formatMoney(policy.cancellationFeeCents, policy.currencyCode)}.
                These are current campground policy terms, not an approved
                cancellation or refund.
              </p>
            </>
          ) : (
            <p role="status">
              No current campground cancellation/refund policy is configured.
              Financial terms need an office review.
            </p>
          )}
          {cancellation.status === "estimated" &&
          cancellation.recommendation ? (
            <>
              <p role="status">
                <strong>Illustrative policy recommendation:</strong>{" "}
                {formatMoney(
                  cancellation.recommendation.recommendedRefundCents,
                  stay.payment.currencyCode,
                )}{" "}
                from the currently captured and unrefunded payments.
              </p>
              <p>
                Window: {cancellation.recommendation.policyWindow} (
                {cancellation.recommendation.daysBeforeArrival} days to
                arrival). Applied fee in recommendation:{" "}
                {formatMoney(
                  cancellation.recommendation.feeAppliedCents,
                  stay.payment.currencyCode,
                )}
                . Any retained amount or refund is still subject to staff
                verification and provider authorization.
              </p>
            </>
          ) : (
            <p role="status">
              <strong>No reliable refund amount can be shown:</strong>{" "}
              {cancellation.reason}. Contact the office for a review.
            </p>
          )}
          <p>
            No cancellation, refund request, payment reversal, credit, charge or
            external notification happens here.
          </p>
          {canRequest ? (
            <form action={submitReservationReviewAction} className="form-grid">
              <input type="hidden" name="reservationId" value={selected.id} />
              <input type="hidden" name="kind" value="cancellation_review" />
              <input
                type="hidden"
                name="expectedReservationVersion"
                value={stay.reservation.rowVersion}
              />
              <input
                type="hidden"
                name="expectedPolicyVersion"
                value={policy?.rowVersion ?? ""}
              />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <label>
                Reason for requesting cancellation review
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  required
                  placeholder="Explain your cancellation question or circumstances"
                />
              </label>
              <label>
                <input type="checkbox" name="confirmReview" required /> I
                understand this only requests staff review. It does not cancel
                my booking or authorize a fee or refund.
              </label>
              <button type="submit" className="secondary-button">
                Request cancellation review
              </button>
            </form>
          ) : (
            <p>Contact the campground office about this reservation state.</p>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Internal follow-up · no outbound messages"
            title="My review requests"
            id="reservation-review-requests"
            helpTopic="shell.overview"
          />
          {requests.length === 0 ? (
            <p>No review requests have been submitted for this reservation.</p>
          ) : (
            <ul>
              {requests.map((request) => (
                <li key={request.id}>
                  <p>
                    <strong>{label(request.kind)}</strong> · {request.state} ·{" "}
                    {request.submittedAt.slice(0, 10)}
                  </p>
                  {request.arrivalDate && request.departureDate ? (
                    <p>
                      Requested dates: {request.arrivalDate} to{" "}
                      {request.departureDate}
                    </p>
                  ) : null}
                  <p>{request.reason}</p>
                  {request.state === "submitted" ? (
                    <form action={withdrawReservationReviewAction}>
                      <input
                        type="hidden"
                        name="reservationId"
                        value={selected.id}
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <button type="submit" className="secondary-button">
                        Withdraw this review request
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p>
            Staff must open their internal reservation review worklist to see
            these requests. Billing, payment providers, automated phone/SMS and
            dispatch remain HELD / DISCONNECTED.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
