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
import { getFinancePortfolio } from "@/lib/permanent-unit-portfolio/postgres.mjs";
import {
  classifyPortfolio,
  summarizePortfolio,
} from "@/lib/permanent-unit-portfolio/core.mjs";
import { recurrenceReviewAction } from "./actions";
import styles from "../../../reservations/reservations.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance follow-up portfolio & exception recurrence · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/portfolio";
const reasons: Record<string, string> = {
  identity_mismatch: "Identity mismatch",
  disclosure_dispute: "Disclosure dispute",
  delivery_failure: "Delivery failure",
  consent_withdrawn: "Consent withdrawn",
  other: "Other exception",
};
const statusLabels: Record<string, string> = {
  all: "All cases",
  active_hold: "Active holds",
  owner_followup: "Open owner follow-ups",
  recurring: "Recurring exception patterns",
  overdue: "Overdue owner tasks",
};
export default async function PortfolioPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    view?: string;
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
  const data = await getFinancePortfolio(
      session.user.id,
      selected.campgroundId,
    ),
    now = Date.parse(data.campground.server_now);
  const summary = summarizePortfolio(data.rows, now),
    view = Object.hasOwn(statusLabels, params.view ?? "")
      ? (params.view ?? "all")
      : "all";
  const filtered = data.rows.filter((r) => {
    const s = classifyPortfolio(r, now);
    return (
      view === "all" ||
      (view === "recurring" && s.recurrences.length > 0) ||
      (view === "overdue" && s.overdueTasks > 0) ||
      view === s.status
    );
  });
  const shown = filtered.slice(0, 40),
    hidden = (
      <input type="hidden" name="campgroundId" value={selected.campgroundId} />
    );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/followup">
            Owner follow-up
          </Link>
          <span>/</span>
          <span>Portfolio monitoring</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 100 · Restricted operational oversight
          </p>
          <h1>Finance follow-up portfolio &amp; recurring exceptions</h1>
          <p className="hero-panel__lead">
            Monitor current exception holds, open and overdue manual owner
            tasks, and repeated recorded hold reasons within one campground.
          </p>
          <p>
            <strong>
              No credit scoring, automated applicant contact, exception release
              or owner-assignment change.
            </strong>{" "}
            Counts reflect existing immutable records and are operational
            indicators—not legal deadlines or lending assessments.
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
            id="portfolio-scope"
            eyebrow="Campground authorization"
            title="Private monitoring scope"
            helpTopic="permanent.portfolio"
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
            <label>
              Queue filter
              <select name="view" defaultValue={view}>
                {Object.entries(statusLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              View portfolio
            </button>
          </form>
          {data.displayLimited ? (
            <p role="alert">
              Displaying the most recent 500 consent records; portfolio counts
              are scoped to these records, not the entire historical campground
              ledger.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="portfolio-totals"
            eyebrow="Evidence-derived attention"
            title="Portfolio snapshot"
            helpTopic="permanent.portfolio"
          />
          <div className={styles.formGrid}>
            <p>
              <strong>Consent cases reviewed:</strong> {summary.consents}
            </p>
            <p>
              <strong>Active exception holds:</strong> {summary.activeHolds}
            </p>
            <p>
              <strong>Open owner tasks:</strong> {summary.openOwnerTasks}
            </p>
            <p>
              <strong>Overdue owner tasks:</strong> {summary.overdueOwnerTasks}
            </p>
            <p>
              <strong>Cases with recurring holds:</strong>{" "}
              {summary.recurringConsents}
            </p>
            <p>
              <strong>Recurrence reviews missing or due:</strong>{" "}
              {summary.pendingRecurrenceReviews}
            </p>
          </div>
          <p>
            Owner-task due times are operational dates. A completed
            administrative follow-up does not mean a consent or hold has been
            resolved.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="portfolio-cases"
            eyebrow="Manual follow-up evidence"
            title={statusLabels[view]}
            helpTopic="permanent.portfolio"
          />
          <p>
            Showing {shown.length} of {filtered.length} matching cases (up to 40
            per screen).
          </p>
          {!shown.length ? <p>No cases match this filter.</p> : null}
          {shown.map((c) => {
            const state = classifyPortfolio(c, now);
            return (
              <article className="content-panel" key={c.id}>
                <h3>
                  {c.buyer_display_name} · disclosure {c.version_code}
                </h3>
                <p>
                  <strong>State:</strong>{" "}
                  {statusLabels[state.status] ?? state.status} ·{" "}
                  <strong>Open:</strong> {state.openTasks} ·{" "}
                  <strong>Overdue:</strong> {state.overdueTasks} ·{" "}
                  <strong>Completed administrative tasks:</strong>{" "}
                  {c.closed_tasks} · <strong>Escalations:</strong>{" "}
                  {c.escalation_count}
                </p>
                {state.recurrences.length ? (
                  state.recurrences.map((reason) => (
                    <section key={reason.reason_code} className="content-panel">
                      <h4>
                        {reasons[reason.reason_code]} · {reason.hold_count} hold
                        cycles
                      </h4>
                      <p>
                        <strong>Last independent recurrence review:</strong>{" "}
                        {reason.review_disposition ?? "None recorded"} ·{" "}
                        <strong>Next review:</strong>{" "}
                        {reason.next_review_at
                          ? new Date(reason.next_review_at).toLocaleString(
                              "en-CA",
                              { timeZone: "UTC" },
                            ) + " UTC"
                          : "Not scheduled"}
                      </p>
                      {state.staleReview || reason.next_review_at ? (
                        <form
                          action={recurrenceReviewAction}
                          className={styles.formGrid}
                        >
                          {hidden}
                          <input type="hidden" name="consentId" value={c.id} />
                          <input
                            type="hidden"
                            name="latestExceptionEventId"
                            value={c.latest_exception_event_id ?? ""}
                          />
                          <input
                            type="hidden"
                            name="reasonCode"
                            value={reason.reason_code}
                          />
                          <input
                            type="hidden"
                            name="observedReasonHoldCount"
                            value={reason.hold_count}
                          />
                          <input
                            type="hidden"
                            name="observedEscalationCount"
                            value={c.escalation_count}
                          />
                          <label>
                            Independent review disposition
                            <select name="reviewDisposition">
                              <option value="continue_monitoring">
                                Continue monitoring
                              </option>
                              <option value="recommend_owner_review">
                                Recommend manual owner review
                              </option>
                              <option value="record_pattern_for_followup">
                                Record pattern for manual follow-up
                              </option>
                            </select>
                          </label>
                          <label>
                            Next review due (UTC)
                            <input
                              type="datetime-local"
                              name="nextReviewAt"
                              required
                            />
                          </label>
                          <label>
                            Restricted evidence reference
                            <input
                              name="evidenceReference"
                              minLength={8}
                              maxLength={400}
                              required
                            />
                          </label>
                          <label>
                            Independent findings and actions
                            <textarea
                              name="note"
                              minLength={12}
                              maxLength={800}
                              required
                            />
                          </label>
                          <button className="primary-button" type="submit">
                            Record immutable recurrence review
                          </button>
                        </form>
                      ) : null}
                    </section>
                  ))
                ) : (
                  <p>
                    No repeated hold reasons on the retained consent history.
                  </p>
                )}
              </article>
            );
          })}
          <p>
            <Link href="/workspaces/management/campgrounds/permanent-units/financing/ageing">
              Open exception ageing
            </Link>{" "}
            ·{" "}
            <Link href="/workspaces/management/campgrounds/permanent-units/financing/followup">
              Open owner follow-up actions
            </Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
