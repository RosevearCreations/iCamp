import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  feedbackRecoveryStages,
  recoveryResponseTemplate,
} from "@/lib/guest-feedback/core.mjs";
import { listManagedGuestFeedback } from "@/lib/guest-feedback/postgres.mjs";

import {
  moderateGuestFeedbackAction,
  recordFeedbackRecoveryAction,
} from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Guest feedback moderation & recovery · iCamp",
  description:
    "Restricted campground feedback, publication moderation and service-recovery follow-up queue.",
  robots: { index: false, follow: false },
};

export default async function FeedbackManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const path = "/workspaces/management/campgrounds/feedback";
  const session = await requireAnyCampgroundPermission("guest.manage", path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (cg) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return access?.permissions.includes("guest.manage") ? cg : null;
      }),
    )
  ).filter((cg): cg is NonNullable<typeof cg> => cg !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((cg) => cg.campgroundId === params.campground) ??
    authorized[0];
  const reviews = await listManagedGuestFeedback({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const publicQueue = reviews.filter(
    (r) =>
      r.publicRequested && (r.moderationState === "pending" || r.appealPending),
  );
  const followups = reviews.filter(
    (r) => !["resolved", "not_actionable"].includes(r.recoveryStage),
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Feedback and recovery</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 184 · Moderation & service recovery</p>
          <h1>Guest feedback & accountable follow-up</h1>
          <p className="hero-panel__lead">
            Read completed-stay guest feedback, moderate requested public
            visibility, review appeals and record in-app recovery milestones.
            Private incident details and linked assistance cases remain
            restricted. No automatic public posting, outreach, refund or
            assistance-case closure occurs.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/reviews">
              Public approved reviews
            </Link>
            <Link
              className="secondary-link"
              href="/workspaces/management/campgrounds/assistance"
            >
              Canonical assistance queue
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            Decision recorded and audited. Any public review still requires the
            guest&apos;s continuing consent.
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.warning} role="alert">
            No change was saved. Refresh and check current review version, guest
            consent, moderation and follow-up eligibility.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Permission: guest.manage"
            title="Campground & current workload"
            id="feedback-workload"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((cg) => (
                  <option key={cg.campgroundId} value={cg.campgroundId}>
                    {cg.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open queue
            </button>
          </form>
          <p>
            <strong>{publicQueue.length}</strong> public moderation/appeal
            decisions pending · <strong>{followups.length}</strong> private
            feedback follow-ups still open · <strong>{reviews.length}</strong>{" "}
            total stored reviews (latest 100 shown).
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Provenance and privacy"
            title="Verified guest feedback queue"
            id="feedback-moderation-queue"
            helpTopic="shell.overview"
          />
          {reviews.length === 0 ? (
            <p>
              No verified-stay guest feedback has been submitted for this
              campground. Staff cannot create a guest rating from this queue.
            </p>
          ) : (
            <div className={styles.cards}>
              {reviews.map((review) => (
                <article className={styles.card} key={review.id}>
                  <p className={styles.tag}>
                    {review.category} · {review.rating} of 5 stars · verified
                    stay
                  </p>
                  <h3>{review.title}</h3>
                  <p>{review.publicSummary}</p>
                  <p>
                    <strong>Private incident details (staff only):</strong>{" "}
                    {review.privateDetails || "None supplied"}
                  </p>
                  <p>
                    Stay reference: {review.reservationId} · Submitted:{" "}
                    {review.submittedAt} · Version {review.rowVersion}
                  </p>
                  {review.assistanceCaseId ? (
                    <p>
                      Linked canonical case: {review.assistanceCaseId} ·{" "}
                      {review.assistanceCaseState} (managed separately in Camper
                      Assistance)
                    </p>
                  ) : null}
                  <p>
                    <strong>Public consent:</strong>{" "}
                    {review.publicRequested
                      ? "Guest requested public display"
                      : "Private only — cannot publish"}{" "}
                    · <strong>Moderation:</strong> {review.moderationState}
                    {review.appealPending ? " · appeal pending" : ""}
                  </p>
                  {review.appealPending && review.appealReason ? (
                    <p>
                      <strong>Private guest appeal:</strong>{" "}
                      {review.appealReason}
                    </p>
                  ) : null}
                  {review.moderationHistory.length ? (
                    <div>
                      <h4>Moderation, consent & appeal history</h4>
                      <ol>
                        {review.moderationHistory.map((entry, i) => (
                          <li key={`${entry.occurredAt}-${i}`}>
                            {entry.occurredAt} ·{" "}
                            {entry.eventKind.replaceAll("_", " ")}
                            {entry.reason ? ` · ${entry.reason}` : ""}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {review.publicRequested &&
                  (review.moderationState === "pending" ||
                    review.appealPending) ? (
                    <form
                      action={moderateGuestFeedbackAction}
                      className={styles.form}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="feedbackId"
                        value={review.id}
                      />
                      <input
                        type="hidden"
                        name="rowVersion"
                        value={review.rowVersion}
                      />
                      <label>
                        Decision explanation (required for decline, visible to
                        guest)
                        <textarea
                          name="reason"
                          maxLength={500}
                          placeholder="Explain respectful, clear moderation guidelines. Do not include private guest details."
                        />
                      </label>
                      <div className={styles.controls}>
                        <button
                          className="primary-button"
                          name="decision"
                          value="approved"
                          type="submit"
                        >
                          {review.appealPending
                            ? "Approve appeal & review"
                            : "Approve consented review"}
                        </button>
                        <button
                          className="secondary-button"
                          name="decision"
                          value="declined"
                          type="submit"
                        >
                          {review.appealPending
                            ? "Decline appeal"
                            : "Decline public review"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p>
                      Public moderation is not awaiting a staff decision.
                      Private-only submissions remain private.
                    </p>
                  )}
                  <h4>Private service-recovery follow-up</h4>
                  <p>
                    Current stage:{" "}
                    <strong>{review.recoveryStage.replaceAll("_", " ")}</strong>
                    {review.recoveryDueDate
                      ? ` · Provisional follow-up date: ${review.recoveryDueDate}`
                      : ""}
                  </p>
                  {review.recoveryHistory.length ? (
                    <ol>
                      {review.recoveryHistory.map((event, i) => (
                        <li key={`${event.occurredAt}-${i}`}>
                          {event.occurredAt} ·{" "}
                          {event.stage.replaceAll("_", " ")} · {event.summary}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>No staff progress recorded yet.</p>
                  )}
                  <form
                    action={recordFeedbackRecoveryAction}
                    className={styles.form}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input type="hidden" name="feedbackId" value={review.id} />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={review.rowVersion}
                    />
                    <label>
                      Recovery milestone
                      <select name="stage" defaultValue="reviewing">
                        {feedbackRecoveryStages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Optional provisional follow-up target (within 60 local
                      days)
                      <input name="dueDate" type="date" />
                    </label>
                    <label>
                      Internal staff note (never shown to guests or public)
                      <textarea
                        name="internalNote"
                        maxLength={800}
                        placeholder="Operational details for staff, not a compensation commitment."
                      />
                    </label>
                    <button className="secondary-button" type="submit">
                      Record in-app recovery milestone
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Fixed, respectful guest wording"
            title="Approved in-app response templates"
            id="feedback-response-templates"
            helpTopic="shell.overview"
          />
          <p>
            The selected stage automatically records one of these fixed
            guest-visible updates. No external message is sent and staff notes
            remain internal.
          </p>
          <ul>
            {feedbackRecoveryStages.map((stage) => (
              <li key={stage}>
                <strong>{stage.replaceAll("_", " ")}</strong>:{" "}
                {recoveryResponseTemplate(stage)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
