import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { feedbackCategories } from "@/lib/guest-feedback/core.mjs";
import type { FeedbackReview } from "@/lib/guest-feedback/postgres.mjs";
import {
  listFeedbackEligibleStays,
  listOwnFeedbackCases,
  listOwnGuestFeedback,
} from "@/lib/guest-feedback/postgres.mjs";

import {
  appealFeedbackAction,
  saveGuestFeedbackAction,
  withdrawFeedbackPublicationAction,
} from "./actions";
import styles from "../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My verified guest feedback · iCamp",
  description:
    "Private completed-stay feedback, guest consent choices, appeals and service-recovery progress.",
  robots: { index: false, follow: false },
};

type CaseOption = {
  id: string;
  reservationId: string;
  caseState: string;
  summary: string;
};
function FeedbackForm({
  reservationId,
  feedback,
  cases,
}: {
  reservationId: string;
  feedback: FeedbackReview | null;
  cases: CaseOption[];
}) {
  return (
    <form action={saveGuestFeedbackAction} className={styles.form}>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="feedbackId" value={feedback?.id ?? ""} />
      <input
        type="hidden"
        name="rowVersion"
        value={feedback?.rowVersion ?? 0}
      />
      <label>
        Overall rating
        <select name="rating" defaultValue={feedback?.rating ?? 5} required>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} of 5 stars
            </option>
          ))}
        </select>
      </label>
      <label>
        Category
        <select name="category" defaultValue={feedback?.category ?? "stay"}>
          {feedbackCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label>
        Review title (public only if approved)
        <input
          name="title"
          required
          minLength={4}
          maxLength={120}
          defaultValue={feedback?.title ?? ""}
        />
      </label>
      <label>
        Review summary (potentially public)
        <textarea
          name="publicSummary"
          required
          minLength={20}
          maxLength={1000}
          defaultValue={feedback?.publicSummary ?? ""}
          placeholder="Describe your experience without names, contact information or incident details."
        />
      </label>
      <label>
        Private details for campground staff only
        <textarea
          name="privateDetails"
          maxLength={2000}
          defaultValue={feedback?.privateDetails ?? ""}
          placeholder="Private context or follow-up needs. Never displayed in public reviews."
        />
      </label>
      <label>
        Optional existing assistance case (private link)
        <select
          name="assistanceCaseId"
          defaultValue={feedback?.assistanceCaseId ?? ""}
        >
          <option value="">No case linked</option>
          {cases
            .filter((c) => c.reservationId === reservationId)
            .map((c) => (
              <option value={c.id} key={c.id}>
                {c.summary.slice(0, 80)} · {c.caseState}
              </option>
            ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          name="publicRequested"
          defaultChecked={feedback?.publicRequested ?? false}
        />{" "}
        I explicitly request staff moderation for possible public display of my
        rating, title and summary.
      </label>
      <p>
        Unchecked means private feedback only. Checking this does not publish
        automatically; staff approval is required. You can withdraw public
        consent later. Updating a review removes any previous approval until
        re-moderated.
      </p>
      <button className="primary-button" type="submit">
        {feedback
          ? "Save revision & reset moderation"
          : "Submit verified-stay feedback"}
      </button>
    </form>
  );
}

export default async function GuestFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Guest feedback is unavailable</h1>
          <p>
            The review database is not connected. No rating, approval or
            service-recovery update was recorded. Please contact the campground
            office.
          </p>
        </section>
      </AppShell>
    );
  const session = await requireSignedIn("/guest/feedback");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  const [stays, feedback, cases] = await Promise.all([
    listFeedbackEligibleStays({ userId: session.user.id }),
    listOwnGuestFeedback({ userId: session.user.id }),
    listOwnFeedbackCases({ userId: session.user.id }),
  ]);
  const existing = new Set(feedback.map((review) => review.reservationId));
  const available = stays.filter((stay) => !existing.has(stay.id));
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/stay">My Stay</Link>
          <span>/</span>
          <span>Feedback</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 184 · Completed-stay feedback</p>
          <h1>Your feedback, your visibility choice</h1>
          <p className="hero-panel__lead">
            Share one verified review for each completed stay within 180 days of
            departure. You decide whether to request public display; campground
            staff must separately approve. Follow private service-recovery
            updates and any linked assistance case here. No automatic messages,
            refund or external action occurs.
          </p>
          <div className="hero-actions">
            <Link href="/reviews" className="primary-link">
              Approved public reviews
            </Link>
            <Link href="/guest/assistance" className="secondary-link">
              My assistance cases
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            Your feedback action was saved and audited. Public visibility, where
            requested, depends on independent staff moderation.
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.warning} role="alert">
            The change was not saved. A stay, consent, case link, version or
            moderation status may have changed. Refresh and try again or contact
            the office.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Verified completed reservations"
            title="Share new feedback"
            id="feedback-new"
            helpTopic="shell.overview"
          />
          {available.length === 0 ? (
            <p>
              No eligible completed stays are currently awaiting feedback. You
              can review your previous feedback and withdraw public consent
              below.
            </p>
          ) : (
            available.map((stay) => (
              <article className={styles.card} key={stay.id}>
                <h3>
                  {stay.campgroundName} · {stay.accommodationCode}
                </h3>
                <p>
                  Completed stay: {stay.arrivalDate} to {stay.departureDate}{" "}
                  (departure date is the end of the stay).
                </p>
                <FeedbackForm
                  reservationId={stay.id}
                  feedback={null}
                  cases={cases}
                />
              </article>
            ))
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Private readback"
            title="My reviews, decisions & recovery"
            id="feedback-history"
            helpTopic="shell.overview"
          />
          {feedback.length === 0 ? (
            <p>No feedback has been submitted yet.</p>
          ) : (
            feedback.map((review) => (
              <article className={styles.card} key={review.id}>
                <h3>
                  {review.title} · {review.rating} of 5 stars
                </h3>
                <p>
                  {review.campgroundName} · {review.category} · submitted{" "}
                  {review.submittedAt.slice(0, 10)}
                </p>
                <p>
                  <strong>Public visibility:</strong>{" "}
                  {review.publicRequested
                    ? `Requested · ${review.moderationState}`
                    : "Private only (not requested)"}
                  {review.appealPending ? " · appeal awaiting staff" : ""}
                </p>
                <p>
                  <strong>Service recovery follow-up:</strong>{" "}
                  {review.recoveryStage.replaceAll("_", " ")}
                  {review.recoveryDueDate
                    ? ` · provisional target ${review.recoveryDueDate}`
                    : ""}
                </p>
                {review.assistanceCaseId ? (
                  <p>
                    <strong>Separate assistance case:</strong>{" "}
                    {review.assistanceCaseState} ·{" "}
                    <Link
                      href={`/guest/assistance?reservation=${encodeURIComponent(review.reservationId)}`}
                    >
                      Open my case conversation
                    </Link>
                  </p>
                ) : null}
                {review.moderationHistory.length ? (
                  <div>
                    <h4>Moderation and consent history</h4>
                    <ol>
                      {review.moderationHistory.map((event, i) => (
                        <li key={`${event.occurredAt}-${i}`}>
                          {event.occurredAt.slice(0, 10)} ·{" "}
                          {event.eventKind.replaceAll("_", " ")}
                          {event.reason ? ` · ${event.reason}` : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {review.recoveryHistory.length ? (
                  <div>
                    <h4>In-app service-recovery updates</h4>
                    <ol>
                      {review.recoveryHistory.map((event, i) => (
                        <li key={`${event.occurredAt}-${i}`}>
                          <strong>{event.stage.replaceAll("_", " ")}</strong> ·{" "}
                          {event.occurredAt.slice(0, 10)}
                          <p>{event.summary}</p>
                          {event.dueDate ? (
                            <p>Provisional follow-up date: {event.dueDate}</p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p>
                    There are no recorded staff follow-up updates yet. For
                    urgent assistance, contact the office or use the existing
                    assistance workflow.
                  </p>
                )}
                {review.publicRequested ? (
                  <form
                    action={withdrawFeedbackPublicationAction}
                    className={styles.form}
                  >
                    <input type="hidden" name="feedbackId" value={review.id} />
                    <button className="secondary-button" type="submit">
                      Withdraw public review consent now
                    </button>
                  </form>
                ) : null}
                {review.moderationState === "declined" &&
                review.publicRequested &&
                !review.appealPending ? (
                  <form action={appealFeedbackAction} className={styles.form}>
                    <input type="hidden" name="feedbackId" value={review.id} />
                    <label>
                      Request a moderation recheck
                      <textarea
                        name="reason"
                        minLength={10}
                        maxLength={600}
                        required
                        placeholder="Explain why this private moderation decision should be reconsidered."
                      />
                    </label>
                    <button className="secondary-button" type="submit">
                      Request staff appeal review
                    </button>
                  </form>
                ) : null}
                {review.editable ? (
                  <div>
                    <h4>Revise my review</h4>
                    <FeedbackForm
                      reservationId={review.reservationId}
                      feedback={review}
                      cases={cases}
                    />
                  </div>
                ) : (
                  <p>
                    This review is outside the 180-day editing window. You can
                    still withdraw public consent at any time.
                  </p>
                )}
              </article>
            ))
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Accessible, staffed fallback"
            title="Need help with feedback?"
            id="feedback-support"
            helpTopic="shell.overview"
          />
          <p>
            The campground office can help you discuss a concern. This page does
            not send email, SMS or calls, issue credits, or change the state of
            a separate assistance case. For emergencies, use local emergency
            services.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
