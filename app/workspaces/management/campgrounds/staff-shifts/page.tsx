import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  shiftDepartments,
  shiftQualifications,
} from "@/lib/staff-shifts/core.mjs";
import {
  getStaffShiftDashboard,
  getStaffShiftPermissions,
} from "@/lib/staff-shifts/postgres.mjs";

import {
  createStaffShiftAction,
  recordStaffAvailabilityAction,
  recordStaffQualificationAction,
  recordStaffHandoffAction,
  recordStaffShiftEventAction,
} from "./actions";
import styles from "./staff-shifts.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Staff shifts, qualification & handoffs · iCamp",
  robots: { index: false, follow: false },
};
const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
function localTime(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(0, 16) + " UTC";
  }
}
function ActionScope({ campgroundId }: Readonly<{ campgroundId: string }>) {
  return <input type="hidden" name="campgroundId" value={campgroundId} />;
}
function NewId() {
  return <input type="hidden" name="id" value={randomUUID()} />;
}

export default async function StaffShiftsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    department?: string;
    view?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/staff-shifts";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const available = (
    await Promise.all(
      assigned.map(async (item) => ({
        ...item,
        permissions: await getStaffShiftPermissions(
          session.user.id,
          item.campgroundId,
        ),
      })),
    )
  ).filter((item) => Object.values(item.permissions).some(Boolean));
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((item) => item.campgroundId === params.campground) ??
    available[0];
  const data = await getStaffShiftDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const referenceNow = new Date(data.asOf).getTime();
  const {
    campground,
    permissions,
    roster,
    shifts,
    availability,
    qualifications,
    handoffs,
    handoffReadiness,
  } = data;
  const deptFilter = shiftDepartments.includes(params.department ?? "")
    ? params.department
    : "all";
  const viewFilter = ["all", "warnings", "mine"].includes(params.view ?? "")
    ? params.view
    : "all";
  const filtered = shifts.filter(
    (shift) =>
      (deptFilter === "all" || shift.department === deptFilter) &&
      (viewFilter !== "warnings" ||
        shift.readiness.flags.some(
          (flag) => flag !== "in_progress_time_window",
        )) &&
      (viewFilter !== "mine" || shift.staffUserId === session.user.id),
  );
  const labelFor = (staffId: string) =>
    staffId === session.user.id
      ? "You"
      : (roster.find((row) => row.id === staffId)?.label ?? "Assigned staff");
  const visibleSourceShifts = shifts.filter(
    (shift) =>
      !shift.cancelled &&
      (permissions.manage || shift.staffUserId === session.user.id),
  );
  const futureShifts = shifts.filter(
    (shift) =>
      !shift.cancelled && new Date(shift.endsAt).getTime() > referenceNow,
  );
  const outstanding = handoffs.filter(
    (handoff) =>
      handoffReadiness.find((item) => item.handoffId === handoff.id)
        ?.requiresReview,
  );
  const flagged = shifts.filter((shift) =>
    shift.readiness.flags.some((flag) => flag !== "in_progress_time_window"),
  );
  const soon = qualifications.filter(
    (q) =>
      q.decision === "verify" &&
      q.validUntil &&
      new Date(q.validUntil).getTime() < referenceNow + 30 * 24 * 3_600_000,
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <span>Staff readiness</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 190 · Private staffing operations</p>
          <h1>Shift scheduling, qualifications &amp; handoff readiness</h1>
          <p className="hero-panel__lead">
            Plan campground shifts against actual availability, verified
            certification and workload; record handoffs without inventing
            acceptance or activating outside providers.
          </p>
          <p>
            <strong>Safety boundary:</strong> Pool and waterfront physical
            supervision still require their specialized live operating evidence.
            A shift plan is not payroll authorization, statutory credential
            certification, emergency response or external dispatch. Billing and
            Omnichannel remain HELD.
          </p>
        </section>
        {params.saved ? (
          <p
            className={
              params.saved.startsWith("Not saved")
                ? styles.error
                : styles.notice
            }
            role="status"
          >
            {params.saved}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="shift-property"
            title="Campground staffing scope"
            eyebrow="RLS-restricted personnel data"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open staffing workboard
            </button>
          </form>
          <p>
            Property local time: <strong>{campground.timezone}</strong>. New
            shift/availability entry fields below use <strong>UTC</strong> to
            avoid daylight-saving ambiguity; cards display campground local
            time.
          </p>
          <div className={styles.metrics}>
            <div>
              <strong>
                {shifts.filter((shift) => !shift.cancelled).length}
              </strong>
              <span>Visible planned shifts</span>
            </div>
            <div>
              <strong>{flagged.length}</strong>
              <span>Workload/readiness flags</span>
            </div>
            <div>
              <strong>{soon.length}</strong>
              <span>Qualification expiry flags</span>
            </div>
            <div>
              <strong>{outstanding.length}</strong>
              <span>Unacknowledged handoffs</span>
            </div>
          </div>
        </section>

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="shift-create"
              title="Plan a staff shift"
              eyebrow="Manager · hard-stop checks"
              helpTopic="shell.overview"
            />
            <p>
              Scheduling rejects overlapping shifts, declared unavailability and
              sensitive department work without a verified qualification valid
              through shift end. Rest/40-hour indicators stay visible for human
              review.
            </p>
            <form action={createStaffShiftAction} className={styles.formGrid}>
              <ActionScope campgroundId={campground.id} />
              <NewId />
              <label>
                Staff member
                <select name="staffUserId" required>
                  {roster.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select name="department" required>
                  {shiftDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {pretty(dept)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Shift role
                <input
                  name="roleLabel"
                  minLength={3}
                  maxLength={100}
                  required
                  placeholder="Grounds lead"
                />
              </label>
              <label>
                Starts (UTC)
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                Ends (UTC)
                <input type="datetime-local" name="endsAt" required />
              </label>
              <label className={styles.wide}>
                Assignment note
                <textarea
                  name="assignmentNote"
                  minLength={12}
                  maxLength={1000}
                  required
                  placeholder="Location, specific responsibilities and handoff expectations"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!roster.length}
              >
                Check &amp; plan shift
              </button>
            </form>
          </section>
        ) : null}

        {permissions.self ? (
          <section className="content-panel">
            <SectionHeading
              id="shift-availability"
              title="My availability"
              eyebrow="Own declarations · immutable changes"
              helpTopic="shell.overview"
            />
            <form
              action={recordStaffAvailabilityAction}
              className={styles.formGrid}
            >
              <ActionScope campgroundId={campground.id} />
              <NewId />
              <input type="hidden" name="kind" value="unavailable" />
              <label>
                Unavailable from (UTC)
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                Unavailable through (UTC)
                <input type="datetime-local" name="endsAt" required />
              </label>
              <label className={styles.wide}>
                Reason (avoid medical/private details)
                <input
                  name="reason"
                  minLength={12}
                  maxLength={500}
                  required
                  placeholder="Not available during this time window"
                />
              </label>
              <button className="primary-button" type="submit">
                Record unavailable window
              </button>
            </form>
            {availability.filter((a) => a.staffUserId === session.user.id)
              .length ? (
              <div className={styles.stack}>
                {availability
                  .filter((a) => a.staffUserId === session.user.id)
                  .map((a) => (
                    <article key={a.id} className={styles.item}>
                      <p>
                        <strong>
                          {localTime(a.startsAt, campground.timezone)} –{" "}
                          {localTime(a.endsAt, campground.timezone)}
                        </strong>
                      </p>
                      <p>{a.reason}</p>
                      <form
                        action={recordStaffAvailabilityAction}
                        className={styles.inlineForm}
                      >
                        <ActionScope campgroundId={campground.id} />
                        <NewId />
                        <input type="hidden" name="kind" value="clear" />
                        <input
                          type="hidden"
                          name="clearsEventId"
                          value={a.id}
                        />
                        <input
                          type="hidden"
                          name="startsAt"
                          value={a.startsAt}
                        />
                        <input type="hidden" name="endsAt" value={a.endsAt} />
                        <input
                          type="hidden"
                          name="reason"
                          value="Availability restored after staff confirmation."
                        />
                        <button type="submit" className="primary-button">
                          Clear unavailability
                        </button>
                      </form>
                    </article>
                  ))}
              </div>
            ) : (
              <p>
                No outstanding unavailable periods are recorded for your staff
                account.
              </p>
            )}
          </section>
        ) : null}

        {permissions.verify ? (
          <section className="content-panel">
            <SectionHeading
              id="shift-qualifications"
              title="Independently verify or revoke a qualification"
              eyebrow="Manager · evidence and expiry"
              helpTopic="shell.overview"
            />
            <p>
              A manager cannot self-certify. Verification needs a source
              reference and expiry; revocation immediately blocks new sensitive
              assignments. Existing safety-specific facility eligibility remains
              separate.
            </p>
            <form
              action={recordStaffQualificationAction}
              className={styles.formGrid}
            >
              <ActionScope campgroundId={campground.id} />
              <NewId />
              <label>
                Staff member
                <select name="staffUserId" required defaultValue="">
                  {" "}
                  <option value="" disabled>
                    Select staff
                  </option>
                  {roster
                    .filter((row) => row.id !== session.user.id)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Qualification
                <select name="qualificationKey" required>
                  {shiftQualifications.map((key) => (
                    <option key={key} value={key}>
                      {pretty(key)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Decision
                <select name="decision" required>
                  <option value="verify">Verify</option>
                  <option value="revoke">Revoke</option>
                </select>
              </label>
              <label>
                Expiry (UTC; only required when verifying)
                <input type="datetime-local" name="validUntil" />
              </label>
              <label className={styles.wide}>
                Source reference
                <input
                  name="sourceReference"
                  minLength={8}
                  maxLength={300}
                  required
                  placeholder="Verified certificate / training record reference"
                />
              </label>
              <label className={styles.wide}>
                Independent review evidence
                <textarea
                  name="reviewNote"
                  minLength={20}
                  maxLength={800}
                  required
                  placeholder="Describe the source checked and qualification decision"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!roster.some((row) => row.id !== session.user.id)}
              >
                Record independent decision
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="shift-board"
            title="Shift workboard"
            eyebrow="Assignments, conflicts and current qualifications"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.inlineForm}>
            <input type="hidden" name="campground" value={campground.id} />
            <label>
              Department
              <select name="department" defaultValue={deptFilter}>
                <option value="all">All departments</option>
                {shiftDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {pretty(dept)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              View
              <select name="view" defaultValue={viewFilter}>
                <option value="all">All visible shifts</option>
                <option value="warnings">Only flagged shifts</option>
                <option value="mine">My shifts</option>
              </select>
            </label>
            <button className="primary-button" type="submit">
              Apply filters
            </button>
          </form>
          <div className={styles.stack}>
            {filtered.length ? (
              filtered.map((shift) => (
                <article className={styles.item} key={shift.id}>
                  <div className={styles.itemHead}>
                    <div>
                      <p className={styles.kicker}>
                        {pretty(shift.department)} · {shift.roleLabel}
                      </p>
                      <h3>{labelFor(shift.staffUserId)}</h3>
                    </div>
                    <span
                      className={
                        shift.readiness.ready ? styles.good : styles.warning
                      }
                    >
                      {shift.cancelled
                        ? "Cancelled"
                        : shift.readiness.ready
                          ? "Schedule checks ready"
                          : "Needs review"}
                    </span>
                  </div>
                  <p>
                    {localTime(shift.startsAt, campground.timezone)} –{" "}
                    {localTime(shift.endsAt, campground.timezone)}
                  </p>
                  <p>{shift.assignmentNote}</p>
                  {shift.readiness.requiredQualification ? (
                    <p>
                      Required qualification:{" "}
                      <strong>
                        {pretty(shift.readiness.requiredQualification)}
                      </strong>
                    </p>
                  ) : null}
                  <p>
                    Rolling 7-day scheduled hours: {shift.readiness.weeklyHours}
                  </p>
                  {shift.readiness.flags.length ? (
                    <ul className={styles.flags}>
                      {shift.readiness.flags.map((flag) => (
                        <li key={flag}>{pretty(flag)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.goodText}>
                      No tracked scheduling conflicts.
                    </p>
                  )}
                  {permissions.manage && !shift.cancelled ? (
                    <form
                      action={recordStaffShiftEventAction}
                      className={styles.inlineForm}
                    >
                      <ActionScope campgroundId={campground.id} />
                      <NewId />
                      <input type="hidden" name="shiftId" value={shift.id} />
                      <input type="hidden" name="kind" value="cancel" />
                      <label>
                        Reason to cancel
                        <input
                          name="reason"
                          minLength={20}
                          maxLength={600}
                          required
                          placeholder="Explain staff reassignment or cancellation"
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Cancel with audit
                      </button>
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <p>
                No shifts match this filter. Scheduling stays private to
                authorized staff.
              </p>
            )}
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="shift-current-qualifications"
            title="Current qualification decisions"
            eyebrow="Latest source-backed review only"
            helpTopic="shell.overview"
          />
          {qualifications.length ? (
            <div className={styles.stack}>
              {qualifications.map((q) => (
                <div className={styles.item} key={q.id}>
                  <strong>
                    {labelFor(q.staffUserId)} · {pretty(q.qualificationKey)}
                  </strong>
                  <p>
                    {q.decision === "revoke"
                      ? "Revoked"
                      : q.validUntil &&
                          new Date(q.validUntil).getTime() <= referenceNow
                        ? "Expired"
                        : "Verified"}{" "}
                    ·{" "}
                    {q.validUntil
                      ? `Expires ${localTime(q.validUntil, campground.timezone)}`
                      : "No active expiry"}
                  </p>
                  <p>{q.reviewNote}</p>
                  {permissions.verify ? (
                    <p>Evidence: {q.sourceReference}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p>No qualification decisions are visible for this staff scope.</p>
          )}
        </section>

        {permissions.self || permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="shift-handoffs"
              title="Record an outstanding-work handoff"
              eyebrow="Source staff or manager · no automatic acceptance"
              helpTopic="shell.overview"
            />
            <form action={recordStaffHandoffAction} className={styles.formGrid}>
              <ActionScope campgroundId={campground.id} />
              <NewId />
              <label>
                Source shift
                <select name="fromShiftId" defaultValue="" required>
                  <option value="" disabled>
                    Select source shift
                  </option>
                  {visibleSourceShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {pretty(s.department)} ·{" "}
                      {localTime(s.startsAt, campground.timezone)} ·{" "}
                      {labelFor(s.staffUserId)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Receiving shift
                <select name="toShiftId" defaultValue="">
                  <option value="">No receiving shift chosen yet</option>
                  {futureShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {pretty(s.department)} ·{" "}
                      {localTime(s.startsAt, campground.timezone)} ·{" "}
                      {labelFor(s.staffUserId)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.wide}>
                Completed / observed summary
                <textarea
                  name="summary"
                  minLength={20}
                  maxLength={1500}
                  required
                  placeholder="What happened during this shift and what was observed?"
                />
              </label>
              <label className={styles.wide}>
                Outstanding work and safety context
                <textarea
                  name="outstandingWork"
                  minLength={20}
                  maxLength={1500}
                  required
                  placeholder="Specific incomplete tasks, exceptions or safety precautions"
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  name="followUpRequired"
                  value="true"
                  defaultChecked
                />{" "}
                Follow-up required
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!visibleSourceShifts.length}
              >
                Record immutable handoff
              </button>
            </form>
            <h3 className={styles.subheading}>
              Handoff queue and independent acknowledgement
            </h3>
            <div className={styles.stack}>
              {handoffs.length ? (
                handoffs.map((h) => {
                  const state = handoffReadiness.find(
                    (row) => row.handoffId === h.id,
                  );
                  const destination = shifts.find((s) => s.id === h.toShiftId);
                  const canAck =
                    permissions.self &&
                    destination?.staffUserId === session.user.id &&
                    !destination.cancelled &&
                    !state?.acknowledged;
                  return (
                    <article key={h.id} className={styles.item}>
                      <div className={styles.itemHead}>
                        <strong>
                          {localTime(h.recordedAt, campground.timezone)} ·{" "}
                          {h.followUpRequired
                            ? "Follow-up required"
                            : "Information handoff"}
                        </strong>
                        <span
                          className={
                            state?.acknowledged ? styles.good : styles.warning
                          }
                        >
                          {state?.acknowledged
                            ? "Receiving staff acknowledged"
                            : h.toShiftId
                              ? "Awaiting acknowledgement"
                              : "Unassigned receiving shift"}
                        </span>
                      </div>
                      <p>{h.summary}</p>
                      <p>
                        <strong>Outstanding:</strong> {h.outstandingWork}
                      </p>
                      {canAck ? (
                        <form
                          action={recordStaffShiftEventAction}
                          className={styles.inlineForm}
                        >
                          <ActionScope campgroundId={campground.id} />
                          <NewId />
                          <input
                            type="hidden"
                            name="kind"
                            value="handoff_ack"
                          />
                          <input
                            type="hidden"
                            name="shiftId"
                            value={h.toShiftId ?? ""}
                          />
                          <input type="hidden" name="handoffId" value={h.id} />
                          <label>
                            My acknowledgement evidence
                            <input
                              name="reason"
                              minLength={20}
                              maxLength={600}
                              required
                              placeholder="I reviewed the outstanding work and know the next steps"
                            />
                          </label>
                          <button type="submit" className="primary-button">
                            Acknowledge as receiving staff
                          </button>
                        </form>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p>No recorded handoffs in the visible scope.</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
