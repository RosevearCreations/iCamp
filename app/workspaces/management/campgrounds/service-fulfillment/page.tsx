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
  listCampgroundFulfillment,
  type FulfillmentJob,
} from "@/lib/booking-charges/fulfillment-postgres.mjs";
import { FULFILLMENT_FORECAST_LABELS } from "@/lib/booking-charges/fulfillment-forecast-core.mjs";
import { getCampgroundFulfillmentForecast } from "@/lib/booking-charges/fulfillment-forecast-postgres.mjs";
import {
  DISPATCH_ACK_LABELS,
  DISPATCH_COMPLETION_LABELS,
} from "@/lib/booking-charges/fulfillment-dispatch-core.mjs";
import {
  listCampgroundDispatchEvidence,
  listCampgroundSlaFollowups,
  type FulfillmentAssignmentTransition,
  type FulfillmentDispatchEvidence,
  type FulfillmentSlaFollowup,
} from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";
import {
  needsSlaFollowup,
  SLA_EXCEPTION_LABELS,
  SLA_FOLLOWUP_LABELS,
} from "@/lib/booking-charges/fulfillment-followup-core.mjs";

import {
  acknowledgeFulfillmentDispatchAction,
  assignFulfillmentAction,
  dispatchFulfillmentAction,
  recordFulfillmentSlaFollowupAction,
  reviewFulfillmentExceptionAction,
  updateFulfillmentForecastSettingsAction,
  updateFulfillmentAction,
} from "./actions";
import styles from "../services/services.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add-On Fulfillment Queue · iCamp",
  description: "Tenant-scoped reservation service scheduling and fulfillment.",
  robots: { index: false, follow: false },
};

const transitions: Record<string, { state: string; title: string }[]> = {
  queued: [
    { state: "scheduled", title: "Schedule service" },
    { state: "blocked", title: "Mark blocked" },
  ],
  scheduled: [
    { state: "in_progress", title: "Start work" },
    { state: "blocked", title: "Mark blocked" },
  ],
  in_progress: [
    { state: "completed", title: "Mark complete" },
    { state: "blocked", title: "Mark blocked" },
  ],
  blocked: [{ state: "scheduled", title: "Reschedule" }],
  completed: [],
};

function JobCard({
  job,
  campgroundId,
  canManageStaff,
  staff,
  forecastStatus,
  dispatchHistory,
  assignmentTransitions,
  slaFollowups,
  currentUserId,
}: {
  job: FulfillmentJob;
  campgroundId: string;
  canManageStaff: boolean;
  staff: { userId: string; label: string }[];
  forecastStatus?: string;
  dispatchHistory: FulfillmentDispatchEvidence[];
  assignmentTransitions: FulfillmentAssignmentTransition[];
  slaFollowups: Map<string, FulfillmentSlaFollowup[]>;
  currentUserId: string;
}) {
  const options = transitions[job.jobState] ?? [];
  const currentWorker = staff.find(
    (person) => person.userId === job.assignedUserId,
  );
  const latestDispatch = dispatchHistory[0];
  const lastServiceDate = new Date(
    Date.parse(`${job.departureDate}T00:00:00Z`) - 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  return (
    <article className={styles.item}>
      <div className={styles.itemHeader}>
        <div>
          <h3>
            {job.displayName} × {job.quantity}
          </h3>
          <p>
            Reservation {job.reservationReference} · {job.reservationStatus} ·{" "}
            {job.serviceCode}
          </p>
        </div>
        <strong>{job.jobState.replaceAll("_", " ")}</strong>
      </div>
      <p>
        Stay: {job.arrivalDate} to {job.departureDate} (departure excluded) ·
        Planned: {job.serviceDate}, {job.serviceWindow}
      </p>
      <p>
        Daily limit: {job.dailyCapacity ?? "unlimited"} units · Updated:{" "}
        {job.updatedAt.slice(0, 16).replace("T", " ")} UTC
      </p>
      <p>
        Assigned to:{" "}
        {job.assignedUserId
          ? canManageStaff
            ? (currentWorker?.label ?? "Former or unavailable staff member")
            : "Campground staff member"
          : "Unassigned"}
      </p>
      {job.staffNote ? <p>Staff note: {job.staffNote}</p> : null}
      {forecastStatus ? (
        <p>
          Shift outlook:{" "}
          <strong>
            {FULFILLMENT_FORECAST_LABELS[forecastStatus] ?? forecastStatus}
          </strong>
        </p>
      ) : null}
      {latestDispatch ? (
        <div className={styles.dispatchEvidence}>
          <h4>Dispatch handoff and service-level evidence</h4>
          <p>
            Issued{" "}
            {latestDispatch.dispatch.dispatchedAt
              .slice(0, 16)
              .replace("T", " ")}{" "}
            UTC
            {latestDispatch.classification?.status === "superseded"
              ? " · Superseded by a task or assignment change"
              : " · Current assignment handoff"}
          </p>
          <p>
            Worker response due:{" "}
            {latestDispatch.dispatch.acknowledgementDueAt
              .slice(0, 16)
              .replace("T", " ")}{" "}
            UTC ·{" "}
            <strong>
              {DISPATCH_ACK_LABELS[
                latestDispatch.classification?.acknowledgement ?? ""
              ] ?? "Awaiting evidence"}
            </strong>
          </p>
          <p>
            Completion target:{" "}
            {latestDispatch.dispatch.completionDueAt
              ? `${latestDispatch.dispatch.completionDueAt.slice(0, 16).replace("T", " ")} UTC`
              : "Not set"}{" "}
            ·{" "}
            <strong>
              {DISPATCH_COMPLETION_LABELS[
                latestDispatch.classification?.completion ?? ""
              ] ?? "No evidence"}
            </strong>
          </p>
          {latestDispatch.dispatch.responseNote ? (
            <p>Worker reply: {latestDispatch.dispatch.responseNote}</p>
          ) : null}
          {latestDispatch.classification?.canAcknowledge &&
          latestDispatch.dispatch.assignedUserId === currentUserId ? (
            <form
              action={acknowledgeFulfillmentDispatchAction}
              className={styles.form}
            >
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <input
                type="hidden"
                name="dispatchId"
                value={latestDispatch.dispatch.id}
              />
              <div className={styles.fields}>
                <label>
                  My acknowledgement
                  <select name="response" required>
                    <option value="accepted">I received this assignment</option>
                    <option value="needs_support">
                      I need supervisor support
                    </option>
                  </select>
                </label>
                <label>
                  Worker note (required when asking for support)
                  <input
                    name="ackNote"
                    maxLength={300}
                    placeholder="Relevant handoff details"
                  />
                </label>
              </div>
              <p>
                This records receipt of the assignment, not attendance,
                completion, permission to contact guests or permission to
                operate a gate.
              </p>
              <button type="submit" className="secondary-button">
                Record my acknowledgement
              </button>
            </form>
          ) : null}
          {dispatchHistory.length > 1 ? (
            <details>
              <summary>Earlier handoff evidence</summary>
              <ol className={styles.reviewHistory}>
                {dispatchHistory.slice(1).map((entry) => (
                  <li key={entry.dispatch.id}>
                    {entry.dispatch.dispatchedAt.slice(0, 16).replace("T", " ")}{" "}
                    UTC ·{" "}
                    {entry.classification?.status === "superseded"
                      ? "Superseded"
                      : "Current"}{" "}
                    ·{" "}
                    {DISPATCH_ACK_LABELS[
                      entry.classification?.acknowledgement ?? ""
                    ] ?? "Unknown"}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}
      {canManageStaff &&
      dispatchHistory.some((entry) =>
        needsSlaFollowup(entry.classification),
      ) ? (
        <div className={styles.dispatchEvidence}>
          <h4>Supervisor SLA exception follow-up</h4>
          <p>
            These decisions document investigation and resolution; they do not
            change the job, send a message, adjust payroll or override a missed
            deadline.
          </p>
          {dispatchHistory
            .filter((entry) => needsSlaFollowup(entry.classification))
            .map((entry) => {
              const history = slaFollowups.get(entry.dispatch.id) ?? [];
              const last = history[0];
              return (
                <details key={entry.dispatch.id}>
                  <summary>
                    Dispatch {entry.dispatch.id.slice(0, 8)} ·{" "}
                    {last
                      ? (SLA_FOLLOWUP_LABELS[last.state] ?? last.state)
                      : "Awaiting supervisor follow-up"}
                  </summary>
                  <p>
                    Evidence:{" "}
                    {[
                      entry.classification?.acknowledgement,
                      entry.classification?.completion,
                    ].join(" / ")}
                    . Superseded assignments remain historical.
                  </p>
                  {history.length ? (
                    <ol className={styles.reviewHistory}>
                      {history.map((review) => (
                        <li key={review.id}>
                          <strong>
                            {SLA_FOLLOWUP_LABELS[review.state] ?? review.state}
                          </strong>{" "}
                          · {review.reviewedAt.slice(0, 16).replace("T", " ")}{" "}
                          UTC
                          <p>
                            {review.signals
                              .map(
                                (signal) =>
                                  SLA_EXCEPTION_LABELS[signal] ?? signal,
                              )
                              .join(" · ")}
                          </p>
                          <p>{review.note}</p>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <form
                    action={recordFulfillmentSlaFollowupAction}
                    className={styles.form}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="dispatchId"
                      value={entry.dispatch.id}
                    />
                    <input
                      type="hidden"
                      name="previousReviewId"
                      value={last?.id ?? ""}
                    />
                    <div className={styles.fields}>
                      <label>
                        Supervisor decision
                        <select name="reviewState" required>
                          <option value="investigating">Investigating</option>
                          <option value="awaiting_worker">
                            Awaiting worker clarification
                          </option>
                          <option value="resolved">
                            Resolved with documented evidence
                          </option>
                          {last?.state === "resolved" ? (
                            <option value="reopened">Reopen review</option>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        Findings and next steps
                        <input
                          name="reviewNote"
                          maxLength={500}
                          required
                          placeholder="Record what happened and who will follow up"
                        />
                      </label>
                    </div>
                    <button type="submit" className="secondary-button">
                      Record supervisor follow-up
                    </button>
                  </form>
                </details>
              );
            })}
        </div>
      ) : null}
      {canManageStaff &&
      job.assignedUserId &&
      ["scheduled", "in_progress"].includes(job.jobState) ? (
        <details>
          <summary>Issue dispatch handoff to assigned worker</summary>
          <form action={dispatchFulfillmentAction} className={styles.form}>
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input type="hidden" name="jobId" value={job.id} />
            <input
              type="hidden"
              name="assignedUserId"
              value={job.assignedUserId}
            />
            <input type="hidden" name="rowVersion" value={job.rowVersion} />
            <input
              type="hidden"
              name="assignmentVersion"
              value={job.assignmentVersion}
            />
            <div className={styles.fields}>
              <label>
                Worker acknowledgement target (minutes)
                <input
                  type="number"
                  name="acknowledgementMinutes"
                  min={5}
                  max={10080}
                  required
                  placeholder="Set a campground target"
                />
              </label>
              <label>
                Completion target (UTC; optional)
                <input type="datetime-local" name="completionTargetUtc" />
              </label>
            </div>
            <p>
              Supervisor-set targets are recorded, not inferred. A new handoff
              requires the current job and assignment versions; repeated
              submission of the same version is rejected. No worker notification
              or guest communication is sent automatically.
            </p>
            <button type="submit" className="primary-button">
              Record dispatch handoff
            </button>
          </form>
        </details>
      ) : null}
      {canManageStaff && job.jobState !== "completed" ? (
        <details>
          <summary>Assign or transfer this work</summary>
          <form action={assignFulfillmentAction} className={styles.form}>
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="rowVersion" value={job.rowVersion} />
            <input
              type="hidden"
              name="assignmentVersion"
              value={job.assignmentVersion}
            />
            <div className={styles.fields}>
              <label>
                Authorized staff member
                <select
                  name="assignedUserId"
                  defaultValue={job.assignedUserId ?? ""}
                >
                  <option value="">Unassigned</option>
                  {job.assignedUserId && !currentWorker ? (
                    <option value={job.assignedUserId} disabled>
                      Former or unavailable staff member
                    </option>
                  ) : null}
                  {staff.map((person) => (
                    <option value={person.userId} key={person.userId}>
                      {person.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assignment note (reason required when changing an assigned
                worker)
                <input
                  name="assignmentNote"
                  maxLength={300}
                  defaultValue={job.assignedUserId ? "" : job.assignmentNote}
                  placeholder="Shift details or special equipment"
                />
              </label>
            </div>
            <p>
              Only active staff authorized for this campground can be assigned.
              Changing or removing an existing worker requires a reason. The
              prior dispatch becomes stale and a new handoff must be issued
              manually; nothing is automatically sent to a worker or guest.
            </p>
            <button type="submit" className="primary-button">
              Save staff assignment
            </button>
          </form>
        </details>
      ) : null}
      {canManageStaff && assignmentTransitions.length ? (
        <details>
          <summary>Assignment and reassignment history</summary>
          <ol className={styles.reviewHistory}>
            {assignmentTransitions.map((event) => (
              <li key={event.id}>
                <strong>
                  {event.previousUserId
                    ? event.assignedUserId
                      ? "Reassigned worker"
                      : "Unassigned worker"
                    : "Assigned worker"}
                </strong>{" "}
                · revision {event.assignmentVersion} ·{" "}
                {event.recordedAt.slice(0, 16).replace("T", " ")} UTC
                {event.reason ? <p>Reason: {event.reason}</p> : null}
              </li>
            ))}
          </ol>
          <p>
            History begins with migration 0224; earlier changes are not
            invented.
          </p>
        </details>
      ) : null}
      {job.jobState === "blocked" && canManageStaff ? (
        <details>
          <summary>Supervisor exception review</summary>
          {job.reviewHistory.length ? (
            <ol className={styles.reviewHistory}>
              {job.reviewHistory.map((review, index) => (
                <li key={`${review.reviewedAt}-${index}`}>
                  <strong>{review.state.replaceAll("_", " ")}</strong> ·{" "}
                  {review.reviewedAt.slice(0, 16).replace("T", " ")} UTC
                  <p>{review.note}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              Awaiting first supervisor review for this blocked work version.
            </p>
          )}
          <form
            action={reviewFulfillmentExceptionAction}
            className={styles.form}
          >
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="rowVersion" value={job.rowVersion} />
            <div className={styles.fields}>
              <label>
                Review decision
                <select name="reviewState" required>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="follow_up_required">Follow-up required</option>
                  <option value="ready_to_reschedule">
                    Ready to reschedule
                  </option>
                </select>
              </label>
              <label>
                Review reason and next steps
                <input name="reviewNote" maxLength={500} required />
              </label>
            </div>
            <p>
              Reviews are retained with the blocked task version. A review does
              not automatically reschedule work or contact a guest.
            </p>
            <button type="submit" className="secondary-button">
              Record exception review
            </button>
          </form>
        </details>
      ) : null}
      {options.length ? (
        <details>
          <summary>Schedule or record work outcome</summary>
          <form action={updateFulfillmentAction} className={styles.form}>
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="rowVersion" value={job.rowVersion} />
            <div className={styles.fields}>
              <label>
                Next step
                <select name="nextState" required>
                  {options.map((option) => (
                    <option key={option.state} value={option.state}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Service date
                <input
                  name="serviceDate"
                  type="date"
                  required
                  min={job.arrivalDate}
                  max={lastServiceDate}
                  defaultValue={job.serviceDate}
                />
              </label>
              <label>
                Time window
                <select name="serviceWindow" defaultValue={job.serviceWindow}>
                  <option value="anytime">Any time</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
              <label>
                Staff note (required if blocked)
                <input
                  name="staffNote"
                  maxLength={500}
                  defaultValue={job.staffNote}
                  placeholder="Work details, constraints or blocker"
                />
              </label>
            </div>
            <p>
              Work updates are internal only. They do not send guest messages,
              change a charge, or open a gate.
            </p>
            <button type="submit" className="primary-button">
              Save work update
            </button>
          </form>
        </details>
      ) : (
        <p>
          Completed tasks are read-only. Financial reconciliation remains
          separate.
        </p>
      )}
    </article>
  );
}

export default async function ServiceFulfillmentPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; result?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/service-fulfillment";
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
        return grant?.permissions.includes("reservation.modify") ? item : null;
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
  const queue = await listCampgroundFulfillment({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const forecast = await getCampgroundFulfillmentForecast({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
    activeStaffIds: queue.staff.map((person) => person.userId),
  });
  const dispatchEvidence = await listCampgroundDispatchEvidence({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const supervisorEvidence = queue.canManageStaff
    ? await listCampgroundSlaFollowups({
        userId: session.user.id,
        campgroundId: selected.campgroundId,
      })
    : { transitions: [], followups: [], truncated: false };
  const transitionsByJob = new Map<string, FulfillmentAssignmentTransition[]>();
  for (const item of supervisorEvidence.transitions) {
    const history = transitionsByJob.get(item.jobId) ?? [];
    history.push(item);
    transitionsByJob.set(item.jobId, history);
  }
  const followupsByDispatch = new Map<string, FulfillmentSlaFollowup[]>();
  for (const item of supervisorEvidence.followups) {
    const history = followupsByDispatch.get(item.dispatchId) ?? [];
    history.push(item);
    followupsByDispatch.set(item.dispatchId, history);
  }
  const dispatchesByJob = new Map<string, FulfillmentDispatchEvidence[]>();
  for (const item of dispatchEvidence.entries) {
    const history = dispatchesByJob.get(item.dispatch.jobId) ?? [];
    history.push(item);
    dispatchesByJob.set(item.dispatch.jobId, history);
  }
  const latestDispatches = [...dispatchesByJob.values()].map(
    (history) => history[0],
  );
  const overdueAcknowledgements = latestDispatches.filter(
    (item) =>
      item.classification?.status === "current" &&
      item.classification.acknowledgement === "overdue",
  ).length;
  const supportRequests = latestDispatches.filter(
    (item) =>
      item.classification?.status === "current" &&
      item.classification.acknowledgement === "support_requested",
  ).length;
  const overdueCompletions = latestDispatches.filter(
    (item) =>
      item.classification?.status === "current" &&
      item.classification.completion === "overdue",
  ).length;
  const outstanding = queue.jobs.filter(
    (job) => job.jobState !== "completed",
  ).length;
  const blocked = queue.jobs.filter((job) => job.jobState === "blocked");
  const routine = queue.jobs.filter((job) => job.jobState !== "blocked");
  const totalActiveJobs = queue.loads.reduce(
    (total, person) => total + person.activeJobs,
    0,
  );

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/campground">Campground</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/workspaces/management/campgrounds/services?campground=${encodeURIComponent(selected.campgroundId)}`}
          >
            Services
          </Link>
          <span aria-hidden="true">/</span>
          <span>Fulfillment</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Campground product · Build 239</p>
          <h1>Staff assignments, dispatch and SLA follow-up</h1>
          <p className="hero-panel__lead">
            Assign reservation-linked extras to campground staff, balance the
            work queue and review shift coverage, recorded unavailability and
            campground-approved capacity limits before dispatch decisions.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Authorized campground"
            title="Work queue scope"
            id="fulfillment-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
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
            <button className="secondary-button" type="submit">
              Open queue
            </button>
          </form>
          <p>
            <strong>{queue.campgroundName}</strong> · {outstanding} outstanding
            out of {queue.jobs.length} visible tasks.
          </p>
          <p>
            <Link
              href={`/workspaces/management/campgrounds/worker-inbox?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Open my worker dispatch inbox (mobile-friendly)
            </Link>
          </p>
          {params.result === "updated" ? (
            <p role="status" className={styles.notice}>
              Work update recorded and audited.
            </p>
          ) : null}
          {params.result === "assigned" ? (
            <p role="status" className={styles.notice}>
              Staff assignment saved and audited.
            </p>
          ) : null}
          {params.result === "dispatched" ? (
            <p role="status" className={styles.notice}>
              Assignment handoff and its explicit response target were recorded.
            </p>
          ) : null}
          {params.result === "sla-reviewed" ? (
            <p role="status" className={styles.notice}>
              Supervisor SLA review saved with an immutable audit trail.
            </p>
          ) : null}
          {params.result === "sla-review-error" ? (
            <p role="alert">
              SLA follow-up was not saved. Refresh the latest dispatch and
              review history, check the exception evidence and try again.
            </p>
          ) : null}
          {params.result === "acknowledged" ? (
            <p role="status" className={styles.notice}>
              Worker acknowledgement saved as an immutable receipt.
            </p>
          ) : null}
          {params.result === "dispatch-error" ||
          params.result === "ack-error" ? (
            <p role="alert">
              Handoff or acknowledgement was not saved. Refresh and confirm the
              current assignment, permissions, version and deadline; a receipt
              may already exist for this dispatch.
            </p>
          ) : null}
          {params.result === "reviewed" ? (
            <p role="status" className={styles.notice}>
              Exception review recorded. Work remains blocked until separately
              rescheduled.
            </p>
          ) : null}
          {params.result === "forecast-saved" ? (
            <p role="status" className={styles.notice}>
              Campground forecast assumptions saved and audited.
            </p>
          ) : null}
          {params.result === "forecast-error" ? (
            <p role="alert">
              Forecast settings were not saved. Refresh the page and check
              permissions, local time ranges and the current settings version.
            </p>
          ) : null}
          {params.result === "assignment-error" ||
          params.result === "review-error" ? (
            <p role="alert">
              The supervisor update could not be saved. Refresh and confirm the
              task version, current employee access and campground permissions.
            </p>
          ) : null}
          {params.result === "update-error" ? (
            <p role="alert">
              Work could not be updated. Refresh, confirm the date is inside the
              stay, and check available capacity or permissions.
            </p>
          ) : null}
          {queue.truncated ? (
            <p role="alert">
              Showing the first 250 tasks, with blocked work prioritized. Staff
              workload totals below cover all active reservations; remaining
              tasks require a later queue page.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Campground worker and supervisor · Build 238"
            title="Dispatch handoff and fulfillment SLA evidence"
            id="dispatch-sla"
            helpTopic="campground.structure"
          />
          <p>
            These are explicit campground work handoffs—not automatic messages,
            guaranteed staffing or guest-facing promises. A worker records
            receipt only for work currently assigned to their account.
            Supervisors see campground-wide receipts; other workers see only
            their own dispatches.
          </p>
          {queue.canManageStaff ? (
            <p>
              Current visible dispatches: {latestDispatches.length} · Worker
              acknowledgement overdue:{" "}
              <strong>{overdueAcknowledgements}</strong> · Support requested:{" "}
              <strong>{supportRequests}</strong> · Completion target overdue:{" "}
              <strong>{overdueCompletions}</strong>.
            </p>
          ) : (
            <p>
              Only personally assigned dispatch receipts are visible in this
              view.
            </p>
          )}
          {dispatchEvidence.truncated ||
          supervisorEvidence.truncated ||
          queue.truncated ? (
            <p role="alert">
              Dispatch or job evidence is truncated. These counts are for the
              visible records, not a complete campground SLA audit.
            </p>
          ) : null}
          <p>
            Response and completion timestamps are recorded in UTC. A missed
            target is evidence for supervisor follow-up, never automatic
            payroll, billing, a penalty or a Comms Hub escalation.
          </p>
        </section>
        {queue.canManageStaff ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Campground supervisor"
              title="Staff load and assignment coverage"
              id="staff-load"
              helpTopic="campground.structure"
            />
            <p>
              {totalActiveJobs} active task(s), including unassigned and blocked
              work. Counts include all active campground reservations, not only
              the visible queue. Unit totals describe workload, not staff hours
              or a promised completion time.
            </p>
            {queue.loadsTruncated || queue.staffTruncated ? (
              <p role="alert">
                More than 500 staff/load rows exist. Contact platform support
                for a paginated roster before making coverage decisions.
              </p>
            ) : null}
            {queue.loads.length ? (
              <div className={styles.tableScroller}>
                <table className={styles.loadTable}>
                  <caption>
                    Active campground add-on load by assigned staff
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Staff</th>
                      <th scope="col">Active tasks</th>
                      <th scope="col">Service units</th>
                      <th scope="col">Blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.loads.map((person) => (
                      <tr key={person.assignedUserId ?? "unassigned"}>
                        <th scope="row">{person.label}</th>
                        <td>{person.activeJobs}</td>
                        <td>{person.units}</td>
                        <td>{person.blockedJobs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No open add-on tasks are assigned or waiting.</p>
            )}
          </section>
        ) : null}
        {queue.canManageStaff && !forecast.canForecast ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Shift privacy"
              title="Forecast access requires scheduling permission"
              id="fulfillment-forecast-access"
              helpTopic="campground.structure"
            />
            <p>
              Assignment supervision alone does not disclose employee shift or
              availability records. An authorized campground owner can grant
              separate scheduling permission to the appropriate manager.
            </p>
          </section>
        ) : null}
        {forecast.canForecast ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Campground-only shift intelligence · Build 237"
              title="Availability, shift conflicts and capacity outlook"
              id="fulfillment-forecast"
              helpTopic="campground.structure"
            />
            <p>
              Local time zone: <strong>{forecast.timezone}</strong>. This
              read-only outlook covers the next {forecast.horizonDays} days of
              current reservation add-ons. It uses recorded shifts,
              cancellations and employee unavailability; a missing shift means{" "}
              <em>not on record</em>, not proof someone cannot work.
            </p>
            <details>
              <summary>
                Configure local service windows and workload limits
              </summary>
              <form
                action={updateFulfillmentForecastSettingsAction}
                className={styles.form}
              >
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected.campgroundId}
                />
                <input
                  type="hidden"
                  name="forecastRowVersion"
                  value={forecast.settings?.rowVersion ?? 0}
                />
                <p>
                  A campground scheduling manager must enter its own actual
                  service-window times. Windows must be ordered, nonoverlapping
                  and fall between 04:00 and 23:59 local time. Nothing is
                  assumed for an unconfigured campground.
                </p>
                <div className={styles.fields}>
                  {(["morning", "afternoon", "evening"] as const).map(
                    (window) => {
                      const startKey = `${window}Start` as const;
                      const endKey = `${window}End` as const;
                      return (
                        <div className={styles.windowGroup} key={window}>
                          <strong>
                            {window.charAt(0).toUpperCase() + window.slice(1)}
                          </strong>
                          <label>
                            Start
                            <input
                              type="time"
                              name={startKey}
                              defaultValue={forecast.settings?.[startKey] ?? ""}
                              min="04:00"
                              max="23:59"
                              step={60}
                              required
                            />
                          </label>
                          <label>
                            End
                            <input
                              type="time"
                              name={endKey}
                              defaultValue={forecast.settings?.[endKey] ?? ""}
                              min="04:00"
                              max="23:59"
                              step={60}
                              required
                            />
                          </label>
                        </div>
                      );
                    },
                  )}
                  <label>
                    Maximum units per employee per service window (optional)
                    <input
                      type="number"
                      name="maxUnitsPerStaffWindow"
                      min={1}
                      max={1000}
                      step={1}
                      defaultValue={
                        forecast.settings?.maxUnitsPerStaffWindow ?? ""
                      }
                      placeholder="Leave blank for coverage only"
                    />
                  </label>
                </div>
                <p>
                  Units measure add-on quantities, not hours or employee
                  productivity. Changing this limit records a planning decision;
                  it does not alter booked charges or employee shifts.
                </p>
                <button type="submit" className="primary-button">
                  Save campground forecast assumptions
                </button>
              </form>
            </details>
            <p>
              <Link
                href={`/workspaces/management/campgrounds/staff-shifts?campground=${encodeURIComponent(selected.campgroundId)}`}
              >
                Review source shifts and staff availability
              </Link>
            </p>
            {forecast.settings ? null : (
              <p role="status">
                No campground service-window policy is configured. Coverage is
                unknown until the owner sets and saves the local times.
              </p>
            )}
            {forecast.truncated ? (
              <p role="alert">
                Only the first 250 forecast groups are visible. Additional
                worker/date groups require pagination before full coverage
                review.
              </p>
            ) : null}
            {forecast.rows.length ? (
              <div className={styles.tableScroller}>
                <table className={styles.loadTable}>
                  <caption>
                    Current 30-day campground staff coverage and workload
                    warnings
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Local service date</th>
                      <th scope="col">Window</th>
                      <th scope="col">Assigned staff</th>
                      <th scope="col">Jobs / units</th>
                      <th scope="col">Planning evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.rows.map((row, index) => (
                      <tr
                        key={`${row.serviceDate}-${row.serviceWindow}-${row.assignedUserId ?? "unassigned"}-${index}`}
                      >
                        <td>{row.serviceDate}</td>
                        <td>{row.serviceWindow}</td>
                        <th scope="row">
                          {row.assignedUserId
                            ? (queue.staff.find(
                                (person) =>
                                  person.userId === row.assignedUserId,
                              )?.label ?? "Former or unavailable staff")
                            : "Unassigned"}
                        </th>
                        <td>
                          {row.jobs} / {row.units}
                          {row.maxUnitsPerStaffWindow === null
                            ? ""
                            : ` (limit ${row.maxUnitsPerStaffWindow})`}
                        </td>
                        <td>
                          {FULFILLMENT_FORECAST_LABELS[row.status] ??
                            row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No active add-on demand falls in the next 30 local days.</p>
            )}
            <p>
              Forecasts are advisory, not employee attendance or safety
              clearance. Only campground-authorized supervisors may make an
              actual assignment, and no forecast automatically dispatches work
              or sends guest messages.
            </p>
          </section>
        ) : null}
        {blocked.length ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Attention needed"
              title="Blocked service exception review"
              id="fulfillment-exceptions"
              helpTopic="campground.structure"
            />
            <p>
              Blocked work is shown first. Supervisors can record
              acknowledgement, required follow-up or readiness to reschedule.
              Every review is tied to the current blocked task version and never
              changes a reservation or sends a guest communication by itself.
            </p>
            <div className={styles.list}>
              {blocked.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  campgroundId={selected.campgroundId}
                  canManageStaff={queue.canManageStaff}
                  staff={queue.staff}
                  dispatchHistory={dispatchesByJob.get(job.id) ?? []}
                  assignmentTransitions={transitionsByJob.get(job.id) ?? []}
                  slaFollowups={followupsByDispatch}
                  currentUserId={session.user.id}
                  forecastStatus={
                    forecast.rows.find(
                      (row) =>
                        row.serviceDate === job.serviceDate &&
                        row.serviceWindow === job.serviceWindow &&
                        row.assignedUserId === job.assignedUserId,
                    )?.status
                  }
                />
              ))}
            </div>
          </section>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Reservations"
            title="Scheduled services and outstanding work"
            id="fulfillment-jobs"
            helpTopic="campground.structure"
          />
          <p>
            Arrival day is the initial service date. A staff member can schedule
            within the stay, advance work, or record a blocker. Cancelled
            reservations are excluded. Guest contact and payment details are not
            shown.
          </p>
          {routine.length ? (
            <div className={styles.list}>
              {routine.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  campgroundId={selected.campgroundId}
                  canManageStaff={queue.canManageStaff}
                  staff={queue.staff}
                  dispatchHistory={dispatchesByJob.get(job.id) ?? []}
                  assignmentTransitions={transitionsByJob.get(job.id) ?? []}
                  slaFollowups={followupsByDispatch}
                  currentUserId={session.user.id}
                  forecastStatus={
                    forecast.rows.find(
                      (row) =>
                        row.serviceDate === job.serviceDate &&
                        row.serviceWindow === job.serviceWindow &&
                        row.assignedUserId === job.assignedUserId,
                    )?.status
                  }
                />
              ))}
            </div>
          ) : (
            <p>No non-blocked add-on work is waiting in this campground.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
