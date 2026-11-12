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
import { buildRecoveryTrendAnalytics } from "@/lib/booking-charges/fulfillment-shift-core.mjs";
import { listShiftRecoveryEvidence } from "@/lib/booking-charges/fulfillment-shift-postgres.mjs";
import { buildSupervisorWorkloadForecast } from "@/lib/booking-charges/fulfillment-performance-core.mjs";
import { listFieldClosureEvidence } from "@/lib/booking-charges/fulfillment-performance-postgres.mjs";
import { listWitnessAuditEvidence } from "@/lib/booking-charges/fulfillment-witness-postgres.mjs";
import { evaluateForecastCheckpoint } from "@/lib/booking-charges/fulfillment-witness-core.mjs";

import {
  requestShiftHandoffAction,
  decideShiftHandoffAction,
  recordCaseOwnershipAction,
  recordSupervisorContinuityAction,
  recordFieldClosureAction,
  recordFieldWitnessAction,
  saveForecastCheckpointAction,
  recordOwnerShiftAuditAction,
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
  const selectedGrant = await getCampgroundAuthorization(
    session.user.id,
    selected.campgroundId,
  );
  const ownerAdmin = Boolean(selectedGrant?.roleCodes.includes("owner_admin"));
  const filter = validateFulfillmentPriorityFilter(params.filter);
  const requestedPage = validateFulfillmentPriorityPage(params.page);
  const [
    dispatchEvidence,
    supervisorEvidence,
    fieldEvidence,
    continuityEvidence,
    shiftEvidence,
    closureEvidence,
    witnessEvidence,
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
    listShiftRecoveryEvidence({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => null),
    listFieldClosureEvidence({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => null),
    listWitnessAuditEvidence({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => null),
  ]);
  const resolvedHandoffs = new Set(
    shiftEvidence?.handoffs
      .filter((event) => event.eventKind !== "request")
      .map((event) => event.requestId) ?? [],
  );
  const ownershipByDispatch = new Map(
    fieldEvidence?.ownership.map((item) => [item.dispatchId, item]) ?? [],
  );
  const pendingHandoffs =
    shiftEvidence?.handoffs.filter(
      (event) =>
        event.eventKind === "request" &&
        !resolvedHandoffs.has(event.id) &&
        ownershipByDispatch.get(event.dispatchId)?.id === event.ownerEventId,
    ) ?? [];
  const pendingByDispatch = new Map(
    pendingHandoffs.map((item) => [item.dispatchId, item]),
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
  const latestClosures = new Map<
    string,
    NonNullable<typeof closureEvidence>["events"][number]
  >();
  for (const item of closureEvidence?.events ?? []) {
    if (!latestClosures.has(item.dispatchId))
      latestClosures.set(item.dispatchId, item);
  }
  const latestWitnesses = new Map<
    string,
    NonNullable<typeof witnessEvidence>["witnesses"][number]
  >();
  for (const item of witnessEvidence?.witnesses ?? []) {
    if (!latestWitnesses.has(item.dispatchId))
      latestWitnesses.set(item.dispatchId, item);
  }
  const auditedSubjects = new Set(
    witnessEvidence?.ownerAudits.map(
      (event) => event.subjectKind + ":" + event.subjectId,
    ) ?? [],
  );
  const now = new Date().toISOString();
  const trend = shiftEvidence
    ? buildRecoveryTrendAnalytics({
        reviews: shiftEvidence.reviews,
        handoffs: shiftEvidence.handoffs,
        asOf: now,
        days: 7,
        truncated: shiftEvidence.truncated,
      })
    : null;
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
        fieldClosure: latestClosures.get(entry.dispatch.id) ?? null,
        fieldWitness: latestWitnesses.get(entry.dispatch.id) ?? null,
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
  const forecast = trend
    ? buildSupervisorWorkloadForecast({
        trend,
        openCases: attention,
        pendingHandoffs: pendingHandoffs.length,
        asOf: now,
        truncated: Boolean(
          dispatchEvidence.truncated ||
          supervisorEvidence.truncated ||
          shiftEvidence?.truncated ||
          closureEvidence?.truncated,
        ),
      })
    : null;
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
    Boolean(continuityEvidence?.truncated) ||
    Boolean(shiftEvidence?.truncated) ||
    Boolean(closureEvidence?.truncated) ||
    Boolean(witnessEvidence?.truncated);

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
          <p className="eyebrow">Build 245 · Campground supervisors only</p>
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
          {!shiftEvidence ? (
            <p role="alert" className={styles.warning}>
              Build 243 shift handoff source tables could not be verified. Trend
              history and handoff controls are unavailable until the source
              migration is installed. Existing priority review stays available.
            </p>
          ) : null}
          {!closureEvidence ? (
            <p role="alert" className={styles.warning}>
              Build 244 field-closure migration has not been verified in this
              campground database. Closure recording remains on HOLD.
            </p>
          ) : null}
          {!witnessEvidence ? (
            <p role="alert" className={styles.warning}>
              Build 245 witness, forecast checkpoint and owner audit tables are
              not available in this campground database. Recording remains on
              HOLD until independently installed and verified.
            </p>
          ) : null}
          {params.result?.startsWith("witness-") ||
          params.result?.startsWith("forecast-") ||
          params.result?.startsWith("shift-audit-") ? (
            <p
              role={params.result?.endsWith("-error") ? "alert" : "status"}
              className={
                params.result?.endsWith("-error") ? styles.warning : undefined
              }
            >
              {params.result?.endsWith("-error")
                ? "Nothing was saved. Refresh source evidence, current role and independent actor requirements."
                : "An immutable campground source event was recorded; external device verification and Master acceptance remain HOLD."}
            </p>
          ) : null}
          {params.result?.startsWith("field-closure-") ? (
            <p
              role={
                params.result === "field-closure-error" ? "alert" : "status"
              }
              className={
                params.result === "field-closure-error"
                  ? styles.warning
                  : undefined
              }
            >
              {params.result === "field-closure-error"
                ? "Field evidence was not recorded. Refresh the current worker report, supervisor review and source permissions."
                : "Supervisor field closure evidence was recorded in the campground source. Independent acceptance remains HOLD."}
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
            <a
              className="secondary-button"
              href={
                "/api/management/fulfillment-supervisor/export?campground=" +
                encodeURIComponent(selected.campgroundId) +
                "&format=trend"
              }
            >
              Download recovery trends (JSON)
            </a>
            <a
              className="secondary-button"
              href={
                "/api/management/fulfillment-supervisor/export?campground=" +
                encodeURIComponent(selected.campgroundId) +
                "&format=case_history"
              }
            >
              Download review history (JSON)
            </a>
            {ownerAdmin ? (
              <a
                className="secondary-button"
                href={
                  "/api/management/fulfillment-supervisor/shift-performance?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Owner-only shift performance report (JSON)
              </a>
            ) : null}
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
        <section className="content-panel" aria-labelledby="recovery-forecast">
          <SectionHeading
            eyebrow="Build 244 · planning estimate, not an automatic assignment"
            title="Next eight-hour supervisor workload"
            id="recovery-forecast"
            helpTopic="campground.structure"
          />
          {forecast ? (
            <>
              <form action={saveForecastCheckpointAction}>
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected.campgroundId}
                />
                <button
                  className="secondary-button"
                  type="submit"
                  disabled={!witnessEvidence}
                >
                  Save source-derived eight-hour forecast checkpoint
                </button>
              </form>
              <div
                className={styles.metrics}
                aria-label="Forecast planning evidence"
              >
                <div>
                  <strong>{forecast.openCases}</strong>
                  <span>Current open cases</span>
                </div>
                <div>
                  <strong>{forecast.expectedNewReviewEvents}</strong>
                  <span>Estimated new review events</span>
                </div>
                <div>
                  <strong>{forecast.planningLoad}</strong>
                  <span>Planning workload</span>
                </div>
              </div>
              <p className={styles.explain}>
                {forecast.methodology} Pending receiving handoffs:{" "}
                {forecast.pendingHandoffs}. Highest observed daily shift
                equivalent: {forecast.peakDailyShiftEquivalent}. This is an
                indicative workload estimate only—not a guarantee, staffing
                order, contractual service target, or field acceptance.
              </p>
              {forecast.evidenceCoverage === "PARTIAL_HOLD" ? (
                <p role="alert" className={styles.warning}>
                  Partial source evidence: this estimate may omit capped events
                  or cases.
                </p>
              ) : null}
            </>
          ) : (
            <p role="status">
              Recovery source events unavailable; forecast is on HOLD.
            </p>
          )}
        </section>
        {ownerAdmin ? (
          <section
            className="content-panel"
            aria-labelledby="field-witness-audit"
          >
            <SectionHeading
              eyebrow="Build 245 · Owner / Administrator only"
              title="Field witness and forecast accuracy audit"
              id="field-witness-audit"
              helpTopic="campground.structure"
            />
            <p className={styles.explain}>
              A second staff member's witness statement is human source
              evidence, not a signed device attestation. Owner review is an
              audited decision, not payment release, guest notification or
              Master acceptance.
            </p>
            {witnessEvidence?.checkpoints.slice(0, 10).map((point) => {
              const accuracy = shiftEvidence
                ? evaluateForecastCheckpoint({
                    checkpoint: point,
                    reviews: shiftEvidence.reviews,
                    handoffs: shiftEvidence.handoffs,
                    asOf: now,
                    truncated:
                      shiftEvidence.truncated || witnessEvidence.truncated,
                  })
                : null;
              const reviewed = auditedSubjects.has(
                "forecast_checkpoint:" + point.id,
              );
              return (
                <article className={styles.ownership} key={point.id}>
                  <h4>Forecast checkpoint · {utc(point.capturedAt)}</h4>
                  <p>
                    Estimated new reviews: {point.expectedNewReviewEvents}.
                    Observed new reviews:{" "}
                    {accuracy?.observedNewReviewEvents ?? "Pending"}. Accuracy
                    status: {accuracy?.evidenceState ?? "SOURCE_UNAVAILABLE"}.
                  </p>
                  {!reviewed &&
                  accuracy &&
                  accuracy.observedNewReviewEvents !== null ? (
                    <form
                      action={recordOwnerShiftAuditAction}
                      className={styles.ownerForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="subjectKind"
                        value="forecast_checkpoint"
                      />
                      <input type="hidden" name="subjectId" value={point.id} />
                      <label>
                        Owner audit outcome
                        <select
                          name="auditDecision"
                          defaultValue="recheck_required"
                        >
                          <option value="recheck_required">
                            Request recheck
                          </option>
                          <option value="reviewed_unverified">
                            Reviewed (source only)
                          </option>
                        </select>
                      </label>
                      <label>
                        Audit reason (8–300 characters)
                        <input
                          name="auditExplanation"
                          minLength={8}
                          maxLength={300}
                          required
                        />
                      </label>
                      <button type="submit" className="secondary-button">
                        Record owner forecast audit
                      </button>
                    </form>
                  ) : (
                    <p>
                      {reviewed
                        ? "Owner audit already recorded."
                        : "Await complete historical source evidence."}
                    </p>
                  )}
                </article>
              );
            })}
            {witnessEvidence?.witnesses
              .filter(
                (item) => latestWitnesses.get(item.dispatchId)?.id === item.id,
              )
              .slice(0, 10)
              .map((item) => (
                <article className={styles.ownership} key={item.id}>
                  <h4>
                    Field witness · dispatch {item.dispatchId.slice(0, 8)}
                  </h4>
                  <p>
                    {item.decision.replaceAll("_", " ")} ·{" "}
                    {utc(item.witnessedAt)} · non-secret source{" "}
                    {item.evidenceReference}
                  </p>
                  {!auditedSubjects.has("field_witness:" + item.id) &&
                  item.witnessedByUserId !== session.user.id ? (
                    <form
                      action={recordOwnerShiftAuditAction}
                      className={styles.ownerForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="subjectKind"
                        value="field_witness"
                      />
                      <input type="hidden" name="subjectId" value={item.id} />
                      <label>
                        Owner audit outcome
                        <select
                          name="auditDecision"
                          defaultValue="recheck_required"
                        >
                          <option value="recheck_required">
                            Request recheck
                          </option>
                          <option value="reviewed_unverified">
                            Reviewed (source only)
                          </option>
                        </select>
                      </label>
                      <label>
                        Audit reason (8–300 characters)
                        <input
                          name="auditExplanation"
                          minLength={8}
                          maxLength={300}
                          required
                        />
                      </label>
                      <button type="submit" className="secondary-button">
                        Record owner field audit
                      </button>
                    </form>
                  ) : (
                    <p>
                      Owner audit recorded or separate owner reviewer required.
                    </p>
                  )}
                </article>
              ))}
            {!witnessEvidence ? (
              <p role="alert">Build 245 private audit source is unavailable.</p>
            ) : null}
          </section>
        ) : null}
        <section className="content-panel" aria-labelledby="recovery-trends">
          <SectionHeading
            eyebrow="Source review history · trailing seven UTC dates"
            title="Supervisor recovery and handoff trends"
            id="recovery-trends"
            helpTopic="campground.structure"
          />
          {trend ? (
            <>
              <p className={styles.explain}>
                Counts are derived from source review and handoff events, not
                extrapolated cases or promises of SLA compliance. Supervisor
                resolution is not a verified field-device acceptance.
              </p>
              <div className={styles.trendScroll}>
                <table className={styles.trendTable}>
                  <caption>
                    Seven-day campground-private review and shift handoff
                    history
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">UTC date</th>
                      <th scope="col">Follow-ups resolved</th>
                      <th scope="col">Escalations</th>
                      <th scope="col">Device blockers</th>
                      <th scope="col">Handoffs requested</th>
                      <th scope="col">Accepted</th>
                      <th scope="col">Declined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.buckets.map((bucket) => (
                      <tr key={bucket.date}>
                        <th scope="row">{bucket.date}</th>
                        <td>{bucket.followupsResolved}</td>
                        <td>{bucket.escalations}</td>
                        <td>{bucket.deviceBlockers}</td>
                        <td>{bucket.handoffRequests}</td>
                        <td>{bucket.handoffAccepted}</td>
                        <td>{bucket.handoffDeclined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {trend.truncated ? (
                <p role="alert" className={styles.warning}>
                  Trend history is capped; displayed counts are incomplete.
                </p>
              ) : null}
            </>
          ) : (
            <p role="status">No verified shift trend source is available.</p>
          )}
          <h3>Receiving supervisor inbox</h3>
          <p>
            Accepting a current request explicitly claims the case in the same
            audited source transaction. Declining leaves ownership unchanged.
          </p>
          {pendingHandoffs.filter(
            (item) => item.incomingUserId === session.user.id,
          ).length ? (
            <ul className={styles.inbox}>
              {pendingHandoffs
                .filter((item) => item.incomingUserId === session.user.id)
                .map((request) => (
                  <li key={request.id}>
                    <strong>Dispatch {request.dispatchId.slice(0, 8)}</strong>
                    <p>
                      Requested {utc(request.recordedAt)} · {request.note}
                    </p>
                    <form
                      action={decideShiftHandoffAction}
                      className={styles.ownerForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <label>
                        Receiving shift decision
                        <select
                          name="handoffDecision"
                          required
                          defaultValue="accept"
                        >
                          <option value="accept">Accept and claim case</option>
                          <option value="decline">
                            Decline; leave owner unchanged
                          </option>
                        </select>
                      </label>
                      <label>
                        Reason and next shift plan (5–300 characters)
                        <input
                          name="handoffNote"
                          minLength={5}
                          maxLength={300}
                          required
                        />
                      </label>
                      <button type="submit" className="secondary-button">
                        Record my decision
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
          ) : (
            <p>No pending handoffs addressed to you.</p>
          )}
          {params.result?.startsWith("handoff-") ? (
            <p
              role={params.result === "handoff-error" ? "alert" : "status"}
              className={
                params.result === "handoff-error" ? styles.warning : undefined
              }
            >
              {params.result === "handoff-error"
                ? "Handoff was not recorded. Refresh current owner, pending request and supervisor permissions."
                : params.result === "handoff-requested"
                  ? "Shift handoff requested. Current owner stays responsible until the recipient accepts."
                  : params.result === "handoff-accepted"
                    ? "Shift handoff accepted and source case ownership updated."
                    : "Shift handoff declined; source ownership unchanged."}
            </p>
          ) : null}
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
                  fieldClosure,
                  fieldWitness,
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
                    {ownership?.claimedByUserId === session.user.id &&
                    classification?.status === "current" &&
                    priority.isException &&
                    shiftEvidence ? (
                      <div className={styles.ownership}>
                        <h4>Cross-shift owner handoff</h4>
                        {pendingByDispatch.get(dispatch.id) ? (
                          <p role="status">
                            A receiving supervisor decision is pending. You
                            remain the case owner.
                          </p>
                        ) : shiftEvidence.colleagues.length ? (
                          <form
                            action={requestShiftHandoffAction}
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
                              name="ownerEventId"
                              value={ownership.id}
                            />
                            <label>
                              Receiving supervisor
                              <select
                                name="targetUserId"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Choose an authorized coworker
                                </option>
                                {shiftEvidence.colleagues.map((person) => (
                                  <option
                                    key={person.userId}
                                    value={person.userId}
                                  >
                                    {person.email}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Shift handoff notes (5–300 characters)
                              <input
                                name="handoffNote"
                                minLength={5}
                                maxLength={300}
                                required
                                placeholder="Current recovery status and next action"
                              />
                            </label>
                            <button type="submit" className="secondary-button">
                              Request shift handoff
                            </button>
                          </form>
                        ) : (
                          <p>
                            No other authorized supervisor is available for a
                            shift handoff.
                          </p>
                        )}
                      </div>
                    ) : null}
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
                      <h4>Field-acceptance closure evidence · source only</h4>
                      <p>
                        {fieldClosure
                          ? `${fieldClosure.decision === "closure_reviewed" ? "Supervisor closure evidence recorded" : "Recheck required"} · ${utc(fieldClosure.recordedAt)} · source ${fieldClosure.evidenceReference}`
                          : "No field-closure source evidence recorded"}
                      </p>
                      <p>
                        A source closure records a supervisor&apos;s review of
                        the worker report. Independent device acceptance remains
                        HOLD until separately witnessed; it does not close the
                        job, authorize billing or notify guests.
                      </p>
                      {fieldReport &&
                      deviceReview &&
                      fieldReport.reportedByUserId !== session.user.id &&
                      deviceReview.subjectId === fieldReport.id &&
                      closureEvidence ? (
                        <form
                          action={recordFieldClosureAction}
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
                            name="fieldReportId"
                            value={fieldReport.id}
                          />
                          <input
                            type="hidden"
                            name="reviewId"
                            value={deviceReview.id}
                          />
                          <input
                            type="hidden"
                            name="previousClosureId"
                            value={fieldClosure?.id ?? ""}
                          />
                          <label>
                            Source closure decision
                            <select
                              name="closureDecision"
                              required
                              defaultValue="recheck_required"
                            >
                              <option value="recheck_required">
                                Reopen for field recheck
                              </option>
                              <option
                                value="closure_reviewed"
                                disabled={
                                  deviceReview.decision !==
                                  "reviewed_unverified"
                                }
                              >
                                Record closure review (not independent
                                acceptance)
                              </option>
                            </select>
                          </label>
                          <label>
                            Existing non-secret field evidence reference
                            <input
                              name="closureEvidenceReference"
                              required
                              minLength={5}
                              maxLength={96}
                              pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}"
                              placeholder="FIELD-REPORT-12345"
                            />
                          </label>
                          <label>
                            Closure or recheck explanation (8–300 characters)
                            <input
                              name="closureNote"
                              required
                              minLength={8}
                              maxLength={300}
                              placeholder="Current worker report reviewed on device"
                            />
                          </label>
                          <button className="secondary-button" type="submit">
                            Record immutable closure evidence
                          </button>
                        </form>
                      ) : (
                        <p>
                          Review the latest worker report independently before
                          recording field closure evidence.
                        </p>
                      )}
                      <h4>Independent human field witness · Build 245</h4>
                      <p>
                        {fieldWitness
                          ? fieldWitness.decision.replaceAll("_", " ") +
                            " · " +
                            utc(fieldWitness.witnessedAt)
                          : "No independent human witness statement recorded"}
                        . External device attestation remains HOLD.
                      </p>
                      {fieldClosure &&
                      fieldClosure.decision === "closure_reviewed" &&
                      fieldReport &&
                      deviceReview &&
                      witnessEvidence &&
                      ![
                        fieldReport.reportedByUserId,
                        deviceReview.reviewedByUserId,
                        fieldClosure.recordedByUserId,
                      ].includes(session.user.id) ? (
                        <form
                          action={recordFieldWitnessAction}
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
                            name="closureId"
                            value={fieldClosure.id}
                          />
                          <input
                            type="hidden"
                            name="previousWitnessId"
                            value={fieldWitness?.id ?? ""}
                          />
                          <label>
                            Independent source witness decision
                            <select
                              name="witnessDecision"
                              defaultValue="recheck_required"
                            >
                              <option value="recheck_required">
                                Recheck required
                              </option>
                              <option value="observed_unverified">
                                Observed personally (not device-certified)
                              </option>
                            </select>
                          </label>
                          <label>
                            Non-secret field evidence reference
                            <input
                              name="witnessEvidenceReference"
                              minLength={5}
                              maxLength={96}
                              pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}"
                              placeholder="FIELD-DEVICE-OBSERVATION-123"
                              required
                            />
                          </label>
                          <label>
                            What did we witness? (8–300 characters)
                            <input
                              name="witnessExplanation"
                              minLength={8}
                              maxLength={300}
                              required
                            />
                          </label>
                          <button type="submit" className="secondary-button">
                            Record independent witness statement
                          </button>
                        </form>
                      ) : (
                        <p>
                          A current supervisor closure and a different
                          authorized staff witness are required.
                        </p>
                      )}
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
