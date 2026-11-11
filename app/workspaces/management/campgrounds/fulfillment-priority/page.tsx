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
import {
  listCampgroundDispatchEvidence,
  listCampgroundSlaFollowups,
  type FulfillmentSlaFollowup,
} from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";
import {
  DISPATCH_ACK_LABELS,
  DISPATCH_COMPLETION_LABELS,
} from "@/lib/booking-charges/fulfillment-dispatch-core.mjs";
import { SLA_FOLLOWUP_LABELS } from "@/lib/booking-charges/fulfillment-followup-core.mjs";
import {
  FULFILLMENT_PRIORITY_FILTERS,
  classifyFulfillmentPriority,
  compareFulfillmentPriority,
  matchesFulfillmentPriorityFilter,
  validateFulfillmentPriorityFilter,
  validateFulfillmentPriorityPage,
} from "@/lib/booking-charges/fulfillment-priority-core.mjs";
import { fieldAcceptanceLabel } from "@/lib/booking-charges/fulfillment-supervisor-core.mjs";
import { listFulfillmentSupervisorEvidence } from "@/lib/booking-charges/fulfillment-supervisor-postgres.mjs";
import {
  CONTINUITY_DECISIONS,
  DEVICE_REVIEW_DECISIONS,
} from "@/lib/booking-charges/fulfillment-continuity-core.mjs";
import { listSupervisorContinuityEvidence } from "@/lib/booking-charges/fulfillment-continuity-postgres.mjs";

import {
  recordCaseOwnershipAction,
  recordSupervisorContinuityAction,
  removePriorityViewAction,
  savePriorityViewAction,
} from "./actions";

import styles from "./priority.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fulfillment Priority Review · iCamp",
  description: "Private campground supervisor exception-aging review",
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;

function utc(value: string | null | undefined) {
  return value ? `${value.slice(0, 16).replace("T", " ")} UTC` : "Not recorded";
}

function elapsed(minutes: number | null) {
  if (minutes === null) return "Not measurable from source evidence";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
}

export default async function FulfillmentPriorityPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    filter?: string;
    page?: string;
    result?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/fulfillment-priority";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (item) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return grant?.permissions.includes("reservation.modify") &&
          grant.permissions.includes("staff.manage")
          ? item
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (
    !allowed.length ||
    (params.campground &&
      !allowed.some((item) => item.campgroundId === params.campground))
  ) {
    redirect("/auth/not-authorized");
  }

  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const filter = validateFulfillmentPriorityFilter(params.filter);
  const requestedPage = validateFulfillmentPriorityPage(params.page);
  const [
    dispatchEvidence,
    supervisorEvidence,
    fieldEvidence,
    continuityEvidence,
  ] = await Promise.all([
    listCampgroundDispatchEvidence({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listCampgroundSlaFollowups({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listFulfillmentSupervisorEvidence({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => null),
    listSupervisorContinuityEvidence({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => null),
  ]);
  const ownershipByDispatch = new Map(
    fieldEvidence?.ownership.map((item) => [item.dispatchId, item]) ?? [],
  );
  const reportsByDispatch = new Map(
    fieldEvidence?.mobile.map((item) => [item.dispatchId, item]) ?? [],
  );
  const caseReviewsByDispatch = new Map(
    continuityEvidence?.caseFollowups.map((item) => [item.dispatchId, item]) ??
      [],
  );
  const deviceReviewsByDispatch = new Map(
    continuityEvidence?.deviceReviews.map((item) => [item.dispatchId, item]) ??
      [],
  );
  const now = new Date().toISOString();
  const latestFollowup = new Map<string, FulfillmentSlaFollowup>();
  for (const followup of supervisorEvidence.followups) {
    if (!latestFollowup.has(followup.dispatchId)) {
      latestFollowup.set(followup.dispatchId, followup);
    }
  }
  const cases = dispatchEvidence.entries
    .map((entry) => {
      const followup = latestFollowup.get(entry.dispatch.id) ?? null;
      return {
        ...entry,
        followup,
        ownership: ownershipByDispatch.get(entry.dispatch.id) ?? null,
        fieldReport: reportsByDispatch.get(entry.dispatch.id) ?? null,
        caseReview: caseReviewsByDispatch.get(entry.dispatch.id) ?? null,
        deviceReview: deviceReviewsByDispatch.get(entry.dispatch.id) ?? null,
        priority: classifyFulfillmentPriority({
          dispatch: entry.dispatch,
          classification: entry.classification,
          followup,
          now,
        }),
      };
    })
    .sort(compareFulfillmentPriority);
  const attention = cases.filter((item) => item.priority.isOpen).length;
  const overdue = cases.filter((item) =>
    ["overdue", "recheck"].includes(item.priority.category),
  ).length;
  const support = cases.filter(
    (item) => item.priority.category === "support",
  ).length;
  const filtered = cases.filter((item) =>
    matchesFulfillmentPriorityFilter(item.priority, filter),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const base = `${path}?campground=${encodeURIComponent(selected.campgroundId)}&filter=${filter}`;
  const truncated =
    dispatchEvidence.truncated ||
    supervisorEvidence.truncated ||
    Boolean(fieldEvidence?.truncated) ||
    Boolean(continuityEvidence?.truncated);

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/campground">Campground</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/workspaces/management/campgrounds/service-fulfillment?campground=${encodeURIComponent(selected.campgroundId)}`}
          >
            Fulfillment queue
          </Link>
          <span aria-hidden="true">/</span>
          <span>Supervisor priority</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 242 · Campground supervisors only</p>
          <h1>Fulfillment exception priority and aging</h1>
          <p className="hero-panel__lead">
            Identify missed assignment targets, requests for help and follow-up
            decisions without changing guest reservations, payroll, payment or
            job completion. All decisions remain in the campground source queue.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Private, tenant-scoped review"
            title="Choose campground and priority view"
            id="priority-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority view
              <select name="filter" defaultValue={filter}>
                {Object.entries(FULFILLMENT_PRIORITY_FILTERS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Refresh priority view
            </button>
          </form>
          {params.result === "view-saved" ||
          params.result === "view-removed" ? (
            <p role="status">Your personal supervisor view was updated.</p>
          ) : null}
          {params.result === "owner-recorded" ? (
            <p role="status">
              The case ownership event was recorded and audited.
            </p>
          ) : null}
          {params.result === "continuity-recorded" ? (
            <p role="status">
              The source-linked supervisor review was recorded in the immutable
              history.
            </p>
          ) : null}
          {params.result === "continuity-error" ? (
            <p role="alert" className={styles.warning}>
              The review was not recorded. Refresh this case: ownership, its
              latest device report, or the previous review may have changed.
            </p>
          ) : null}
          {params.result === "view-error" || params.result === "owner-error" ? (
            <p role="alert" className={styles.warning}>
              Nothing was saved. Refresh current campground permissions and
              evidence; a saved view may already exist or another supervisor may
              have changed ownership.
            </p>
          ) : null}
          <section
            className={styles.savedViews}
            aria-label="My supervisor saved views"
          >
            <h3>My priority shortcuts</h3>
            <p>
              Save up to eight personal filter shortcuts. They never expose
              another campground or modify worker assignments.
            </p>
            {fieldEvidence?.savedViews.length ? (
              <ul className={styles.shortcuts}>
                {fieldEvidence.savedViews.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`${path}?campground=${encodeURIComponent(selected.campgroundId)}&filter=${item.filter}`}
                    >
                      {item.label}
                    </Link>
                    <form action={removePriorityViewAction}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="viewId" value={item.id} />
                      <button
                        type="submit"
                        className="secondary-button"
                        aria-label={`Remove saved view ${item.label}`}
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No personal shortcuts are stored.</p>
            )}
            <form action={savePriorityViewAction} className={styles.filters}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="viewFilter" value={filter} />
              <label>
                Shortcut name (2–48 characters)
                <input
                  name="viewLabel"
                  minLength={2}
                  maxLength={48}
                  required
                  placeholder="Today's overdue work"
                />
              </label>
              <button
                className="secondary-button"
                disabled={
                  !fieldEvidence || fieldEvidence.savedViews.length >= 8
                }
                type="submit"
              >
                Save current filter
              </button>
            </form>
          </section>
          {!fieldEvidence ? (
            <p role="alert" className={styles.warning}>
              Build 241 source tables are not available or could not be
              verified. Saved views, case ownership and mobile acceptance
              evidence are on HOLD until the campground database migration is
              independently applied.
            </p>
          ) : null}
          {!continuityEvidence ? (
            <p role="alert" className={styles.warning}>
              Build 242 continuity source migration is not verified. Case
              follow-up and device-review actions remain unavailable until the
              source tables are installed and accessible.
            </p>
          ) : null}
          <div className={styles.exportRow}>
            <a
              className="secondary-button"
              href={`/api/management/fulfillment-supervisor/export?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Download private source evidence (JSON)
            </a>
            <p>
              Authorized campground supervisors only. This unsigned snapshot
              contains source IDs and decisions but no guest details, worker
              identities or free-text notes; it is not a Master Shell receipt.
            </p>
          </div>
          <div
            className={styles.metrics}
            aria-label="Visible source exceptions"
          >
            <div>
              <strong>{attention}</strong>
              <span>Open reviews</span>
            </div>
            <div>
              <strong>{overdue}</strong>
              <span>Overdue / recheck</span>
            </div>
            <div>
              <strong>{support}</strong>
              <span>Worker support</span>
            </div>
          </div>
          <p className={styles.explain}>
            Snapshot: {utc(now)}. Aging starts at the earliest recorded support
            receipt or missed acknowledgement/completion deadline, and stops at
            an explicit supervisor resolution. Bands (under 1h, 1–4h, 4–24h,
            24h+) are display groups—not contractual SLA or automatic escalation
            thresholds. Historical supersession has no recorded end time, so its
            age cannot be calculated.
          </p>
          {truncated ? (
            <p role="alert" className={styles.warning}>
              Partial evidence: the source returned a capped set of dispatch or
              review records (up to 750). Counts and sorting cover visible
              records only; they are not complete campground totals.
            </p>
          ) : (
            <p className={styles.explain}>
              Counts cover the dispatch history returned by this campground
              source (up to three records per job), not all historic evidence.
            </p>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow={`${FULFILLMENT_PRIORITY_FILTERS[filter]} · ${filtered.length} visible cases`}
            title="Source-linked supervisor cases"
            id="priority-cases"
            helpTopic="campground.structure"
          />
          {visible.length ? (
            <div className={styles.caseList}>
              {visible.map(
                ({
                  dispatch,
                  classification,
                  followup,
                  ownership,
                  fieldReport,
                  caseReview,
                  deviceReview,
                  priority,
                }) => (
                  <article key={dispatch.id} className={styles.case}>
                    <div className={styles.caseHeader}>
                      <div>
                        <p className={styles.caseOverline}>
                          Dispatch {dispatch.id.slice(0, 8)} ·{" "}
                          {priority.category.replaceAll("_", " ")}
                        </p>
                        <h3>{priority.title}</h3>
                      </div>
                      <strong className={styles.ageBand}>
                        {priority.ageBand}
                      </strong>
                    </div>
                    <dl className={styles.details}>
                      <div>
                        <dt>Exception age</dt>
                        <dd>{elapsed(priority.ageMinutes)}</dd>
                      </div>
                      <div>
                        <dt>Aging source</dt>
                        <dd>
                          {priority.ageSource ??
                            "No measurable source timestamp"}
                        </dd>
                      </div>
                      <div>
                        <dt>Worker response</dt>
                        <dd>
                          {DISPATCH_ACK_LABELS[
                            classification?.acknowledgement ?? ""
                          ] ?? "Unverified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Completion</dt>
                        <dd>
                          {DISPATCH_COMPLETION_LABELS[
                            classification?.completion ?? ""
                          ] ?? "Unverified"}
                        </dd>
                      </div>
                      <div>
                        <dt>Reply deadline</dt>
                        <dd>{utc(dispatch.acknowledgementDueAt)}</dd>
                      </div>
                      <div>
                        <dt>Completion deadline</dt>
                        <dd>{utc(dispatch.completionDueAt)}</dd>
                      </div>
                      <div>
                        <dt>Last supervisor review</dt>
                        <dd>
                          {followup
                            ? `${SLA_FOLLOWUP_LABELS[followup.state] ?? followup.state} · ${utc(followup.reviewedAt)}`
                            : "No recorded review"}
                        </dd>
                      </div>
                    </dl>
                    <div className={styles.ownership}>
                      <p>
                        <strong>Case owner:</strong>{" "}
                        {!ownership?.claimedByUserId
                          ? "Unassigned"
                          : ownership.claimedByUserId === session.user.id
                            ? "You"
                            : "Another authorized supervisor"}
                        {ownership ? ` · ${utc(ownership.recordedAt)}` : ""}
                      </p>
                      {ownership ? (
                        <p>Latest ownership reason: {ownership.reason}</p>
                      ) : null}
                      {classification?.status === "current" &&
                      priority.isException &&
                      fieldEvidence ? (
                        <form
                          action={recordCaseOwnershipAction}
                          className={styles.ownerForm}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="dispatchId"
                            value={dispatch.id}
                          />
                          <input
                            type="hidden"
                            name="previousEventId"
                            value={ownership?.id ?? ""}
                          />
                          <input
                            type="hidden"
                            name="ownerIntent"
                            value={
                              ownership?.claimedByUserId === session.user.id
                                ? "release"
                                : "claim"
                            }
                          />
                          <label>
                            Ownership reason (5–300 characters)
                            <input
                              name="ownerNote"
                              minLength={5}
                              maxLength={300}
                              required
                              placeholder="What follow-up will I own?"
                            />
                          </label>
                          <button className="secondary-button" type="submit">
                            {ownership?.claimedByUserId === session.user.id
                              ? "Release my ownership"
                              : "Claim this case"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <div className={styles.ownership}>
                      <h4>Owner follow-up continuity</h4>
                      <p>
                        {caseReview
                          ? `${CONTINUITY_DECISIONS[caseReview.decision] ?? caseReview.decision} · ${utc(caseReview.reviewedAt)}`
                          : "No owner follow-up review yet"}
                        {caseReview && caseReview.subjectId !== ownership?.id
                          ? " · Source ownership changed; review is historical"
                          : ""}
                      </p>
                      {caseReview ? (
                        <p>Last follow-up note: {caseReview.note}</p>
                      ) : null}
                      {classification?.status === "current" &&
                      priority.isException &&
                      ownership?.claimedByUserId === session.user.id &&
                      continuityEvidence ? (
                        <form
                          action={recordSupervisorContinuityAction}
                          className={styles.ownerForm}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="dispatchId"
                            value={dispatch.id}
                          />
                          <input
                            type="hidden"
                            name="subjectId"
                            value={ownership.id}
                          />
                          <input
                            type="hidden"
                            name="previousReviewId"
                            value={caseReview?.id ?? ""}
                          />
                          <input
                            type="hidden"
                            name="reviewKind"
                            value="case_followup"
                          />
                          <label>
                            Follow-up decision
                            <select
                              name="reviewDecision"
                              required
                              defaultValue="supervisor_recheck"
                            >
                              {Object.entries(CONTINUITY_DECISIONS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label>
                            Follow-up explanation (5–300 characters)
                            <input
                              name="reviewNote"
                              required
                              minLength={5}
                              maxLength={300}
                              placeholder="Next action and who will recheck"
                            />
                          </label>
                          <button className="secondary-button" type="submit">
                            Record my follow-up
                          </button>
                        </form>
                      ) : (
                        <p>
                          Claim current ownership first to record a follow-up.
                        </p>
                      )}
                    </div>
                    <div className={styles.ownership}>
                      <p>
                        <strong>Worker device evidence:</strong>{" "}
                        {fieldAcceptanceLabel(fieldReport)}
                      </p>
                      {fieldReport ? (
                        <p>
                          {fieldReport.deviceKind} ·{" "}
                          {utc(fieldReport.reportedAt)}
                          {" · "}
                          {fieldReport.observation}
                        </p>
                      ) : null}
                      <p>
                        Independent field acceptance is HOLD until a separate
                        authorized reviewer confirms actual device evidence.
                      </p>
                      <h4>Supervisor device-report review</h4>
                      <p>
                        {deviceReview
                          ? `${DEVICE_REVIEW_DECISIONS[deviceReview.decision] ?? deviceReview.decision} · ${utc(deviceReview.reviewedAt)}`
                          : "Not reviewed by supervisor"}
                        {deviceReview &&
                        deviceReview.subjectId !== fieldReport?.id
                          ? " · New worker report requires recheck"
                          : ""}
                      </p>
                      {deviceReview ? (
                        <p>Last review note: {deviceReview.note}</p>
                      ) : null}
                      {fieldReport &&
                      fieldReport.reportedByUserId !== session.user.id &&
                      continuityEvidence ? (
                        <form
                          action={recordSupervisorContinuityAction}
                          className={styles.ownerForm}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="dispatchId"
                            value={dispatch.id}
                          />
                          <input
                            type="hidden"
                            name="subjectId"
                            value={fieldReport.id}
                          />
                          <input
                            type="hidden"
                            name="previousReviewId"
                            value={deviceReview?.id ?? ""}
                          />
                          <input
                            type="hidden"
                            name="reviewKind"
                            value="field_device"
                          />
                          <label>
                            Device review decision
                            <select
                              name="reviewDecision"
                              required
                              defaultValue="needs_retest"
                            >
                              {Object.entries(DEVICE_REVIEW_DECISIONS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label>
                            Review explanation (5–300 characters)
                            <input
                              name="reviewNote"
                              required
                              minLength={5}
                              maxLength={300}
                              placeholder="What needs verification on the device?"
                            />
                          </label>
                          <button className="secondary-button" type="submit">
                            Record device review
                          </button>
                        </form>
                      ) : null}
                    </div>
                    {followup ? (
                      <p className={styles.reviewNote}>
                        <strong>Recorded supervisor note:</strong>{" "}
                        {followup.note}
                      </p>
                    ) : null}
                    <p className={styles.recovery}>
                      <strong>Next step:</strong> {priority.nextStep}
                    </p>
                    <Link
                      className={styles.actionLink}
                      href={`/workspaces/management/campgrounds/service-fulfillment?campground=${encodeURIComponent(selected.campgroundId)}#fulfillment-job-${dispatch.jobId}`}
                    >
                      Review source assignment and record follow-up
                    </Link>
                    {priority.category === "history" ? (
                      <p>
                        Historical handoff — check the latest assignment before
                        taking action.
                      </p>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          ) : (
            <p role="status">
              No cases match this view in the returned campground evidence.
            </p>
          )}
          <nav aria-label="Priority case pagination" className={styles.pager}>
            {page > 1 ? (
              <Link href={`${base}&page=${page - 1}`}>Previous cases</Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={`${base}&page=${page + 1}`}>Next cases</Link>
            ) : (
              <span />
            )}
          </nav>
        </section>
      </div>
    </AppShell>
  );
}
