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
  assignFulfillmentAction,
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
}: {
  job: FulfillmentJob;
  campgroundId: string;
  canManageStaff: boolean;
  staff: { userId: string; label: string }[];
  forecastStatus?: string;
}) {
  const options = transitions[job.jobState] ?? [];
  const currentWorker = staff.find(
    (person) => person.userId === job.assignedUserId,
  );
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
                Assignment note (internal)
                <input
                  name="assignmentNote"
                  maxLength={300}
                  defaultValue={job.assignmentNote}
                  placeholder="Shift details or special equipment"
                />
              </label>
            </div>
            <p>
              Only active staff authorized for this campground can be assigned.
            </p>
            <button type="submit" className="primary-button">
              Save staff assignment
            </button>
          </form>
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
          <p className="eyebrow">Campground product · Build 237</p>
          <h1>Staff availability &amp; fulfillment forecasts</h1>
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
