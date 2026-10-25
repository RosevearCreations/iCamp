import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import { ageBand } from "@/lib/permanent-unit-ageing/core.mjs";
import { getAgeingDashboard } from "@/lib/permanent-unit-ageing/postgres.mjs";
import {
  exceptionReviewAction,
  ownerEscalationAction,
  ownerResponseAction,
} from "./actions";
import styles from "../../../reservations/reservations.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance exception ageing & owner escalation · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/ageing";
const labels: Record<string, string> = {
  open_hold: "Active exception hold",
  cleared_history: "Cleared exception history",
  followup: "Evidence follow-up",
  within_24h: "Under 24 hours",
  overdue_24h: "24–72 hours old",
  critical_72h: "72+ hours old",
  unknown: "Unknown age",
};
export default async function AgeingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(path),
    params = await searchParams;
  const available = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (c) => ({
        ...c,
        allowed: await hasCampgroundPermission(
          session.user.id,
          c.campgroundId,
          "permanent_unit.transfer",
        ),
      })),
    )
  ).filter((c) => c.allowed);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((c) => c.campgroundId === params.campground) ?? available[0];
  const data = await getAgeingDashboard(session.user.id, selected.campgroundId);
  const hidden = (
    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
  );
  const isOwner = data.owners.some((o) => o.id === session.user.id);
  const now = Date.parse(data.serverNow);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/reconciliation">
            Evidence reconciliation
          </Link>
          <span>/</span>
          <span>Exception ageing</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 098 · Owner escalation boundary</p>
          <h1>Delivery exceptions, re-review &amp; owner follow-up</h1>
          <p className="hero-panel__lead">
            Monitor ageing from immutable exception evidence, document
            independent re-review, and direct unresolved matters into a private
            owner response queue.
          </p>
          <p>
            <strong>
              No automatic reminders, sends, legal determinations or hold
              releases.
            </strong>{" "}
            Ageing flags guide operator attention (24 and 72 hours), not a
            statutory deadline. Owners still need separate procedures for lawful
            communication, financing and exception resolution.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={`${styles.notice} ${styles.error}`}>
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="ageing-camp"
            eyebrow="Restricted property"
            title="Select campground"
            helpTopic="permanent.ageing"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open
            </button>
          </form>
          <p>
            {data.campground.name} · {data.reviews.length} re-review records ·{" "}
            {data.escalations.length} owner escalation(s)
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="ageing-queue"
            eyebrow="Time-based operator attention"
            title="Exception ageing &amp; re-review queue"
            helpTopic="permanent.ageing"
          />
          {!data.consents.length ? (
            <p>
              No applicant delivery consents yet.{" "}
              <Link href="/workspaces/management/campgrounds/permanent-units/financing/receipts">
                Review manual delivery records
              </Link>
              .
            </p>
          ) : null}
          {data.consents.map((c) => {
            const latest = data.exceptions.find((e) => e.consent_id === c.id),
              recon = data.reconciliations.find((r) => r.consent_id === c.id),
              prev = data.reviews.find((r) => r.consent_id === c.id);
            const state =
              latest?.event_type === "hold"
                ? "open_hold"
                : latest
                  ? "cleared_history"
                  : "followup";
            const since =
              latest?.recorded_at ?? recon?.prepared_at ?? c.recorded_at;
            const band = ageBand(since, now),
              needsAttention =
                state === "open_hold" ||
                recon?.completeness === "needs_followup";
            if (!needsAttention && !prev) return null;
            return (
              <article className="content-panel" key={c.id}>
                <h3>
                  {c.buyer_display_name} · disclosure {c.version_code}
                </h3>
                <p>
                  <strong>Current state:</strong> {labels[state]} ·{" "}
                  <strong>Age band:</strong> {labels[band]} ·{" "}
                  <strong>Evidence origin:</strong>{" "}
                  {new Date(since).toLocaleString("en-CA", { timeZone: "UTC" })}{" "}
                  UTC
                </p>
                <p>
                  <strong>Latest exception:</strong>{" "}
                  {latest?.reason_code ?? "No hold event"} ·{" "}
                  <strong>Latest reconciliation:</strong>{" "}
                  {recon?.completeness ?? "Not prepared"}
                </p>
                {prev ? (
                  <p>
                    <strong>Last operator review:</strong>{" "}
                    {prev.review_decision} · <strong>Next review:</strong>{" "}
                    {new Date(prev.next_review_at).toLocaleString("en-CA", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </p>
                ) : null}
                <form
                  action={exceptionReviewAction}
                  className={styles.formGrid}
                >
                  {hidden}
                  <input type="hidden" name="consentId" value={c.id} />
                  <input
                    type="hidden"
                    name="reconciliationId"
                    value={recon?.id ?? ""}
                  />
                  <input
                    type="hidden"
                    name="exceptionEventId"
                    value={latest?.id ?? ""}
                  />
                  <input type="hidden" name="observationState" value={state} />
                  <label>
                    Independent review outcome
                    <select name="reviewDecision">
                      <option value="continue_monitoring">
                        Continue monitoring and follow-up
                      </option>
                      <option value="request_owner_escalation">
                        Request owner escalation
                      </option>
                      <option
                        value="recommend_manual_clearance"
                        disabled={state !== "open_hold"}
                      >
                        Recommend separate manual hold clearance
                      </option>
                    </select>
                  </label>
                  <label>
                    Next review due (UTC)
                    <input type="datetime-local" name="nextReviewAt" required />
                  </label>
                  <label>
                    Restricted review evidence reference
                    <input
                      name="evidenceReference"
                      minLength={8}
                      maxLength={400}
                      required
                    />
                  </label>
                  <label>
                    Facts, outstanding actions &amp; ageing rationale
                    <textarea
                      name="note"
                      minLength={12}
                      maxLength={800}
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Record immutable independent re-review
                  </button>
                </form>
                {data.reviews
                  .filter((r) => r.consent_id === c.id)
                  .map((review) => {
                    const escalation = data.escalations.find(
                        (e) => e.exception_review_id === review.id,
                      ),
                      response = escalation
                        ? data.responses.find(
                            (r) => r.escalation_id === escalation.id,
                          )
                        : undefined;
                    const outstanding = data.escalations.some(
                      (e) =>
                        data.reviews.some(
                          (r) =>
                            r.id === e.exception_review_id &&
                            r.consent_id === c.id,
                        ) &&
                        !data.responses.some((a) => a.escalation_id === e.id),
                    );
                    return (
                      <article key={review.id} className="content-panel">
                        <h4>
                          {review.review_decision} · {review.observation_state}
                        </h4>
                        {escalation ? (
                          <>
                            <p>
                              <strong>Owner request:</strong>{" "}
                              {escalation.priority} ·{" "}
                              {escalation.escalation_reference} ·{" "}
                              {escalation.requested_action} ·{" "}
                              <strong>Owner response:</strong>{" "}
                              {response?.response ??
                                "Awaiting designated owner"}
                            </p>
                            {!response &&
                            isOwner &&
                            escalation.target_owner_user_id ===
                              session.user.id ? (
                              <form
                                action={ownerResponseAction}
                                className={styles.formGrid}
                              >
                                {hidden}
                                <input
                                  type="hidden"
                                  name="escalationId"
                                  value={escalation.id}
                                />
                                <label>
                                  Owner acknowledgement
                                  <select name="response">
                                    <option value="accepted_followup">
                                      Accept follow-up assignment
                                    </option>
                                    <option value="returned_for_rework">
                                      Return for rework
                                    </option>
                                  </select>
                                </label>
                                <label>
                                  Restricted decision reference
                                  <input
                                    name="evidenceReference"
                                    minLength={8}
                                    maxLength={400}
                                    required
                                  />
                                </label>
                                <label>
                                  Owner action note
                                  <textarea
                                    name="note"
                                    minLength={12}
                                    maxLength={800}
                                    required
                                  />
                                </label>
                                <button
                                  className="primary-button"
                                  type="submit"
                                >
                                  Record private owner response
                                </button>
                              </form>
                            ) : null}
                          </>
                        ) : review.review_decision ===
                            "request_owner_escalation" &&
                          !outstanding &&
                          data.owners.length > 0 ? (
                          <form
                            action={ownerEscalationAction}
                            className={styles.formGrid}
                          >
                            {hidden}
                            <input
                              type="hidden"
                              name="exceptionReviewId"
                              value={review.id}
                            />
                            <label>
                              Designated campground owner
                              <select name="targetOwnerUserId" required>
                                {data.owners.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.email_normalized}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Attention priority
                              <select name="priority">
                                <option value="standard">Standard</option>
                                <option value="urgent">Urgent</option>
                                <option value="critical">Critical</option>
                              </select>
                            </label>
                            <label>
                              Owner acknowledgement due (UTC)
                              <input
                                type="datetime-local"
                                name="dueAt"
                                required
                              />
                            </label>
                            <label>
                              Restricted escalation record reference
                              <input
                                name="escalationReference"
                                minLength={8}
                                maxLength={400}
                                required
                              />
                            </label>
                            <label>
                              Requested manual owner follow-up
                              <textarea
                                name="requestedAction"
                                minLength={12}
                                maxLength={800}
                                required
                              />
                            </label>
                            <button className="primary-button" type="submit">
                              Create internal owner escalation
                            </button>
                          </form>
                        ) : null}
                      </article>
                    );
                  })}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
