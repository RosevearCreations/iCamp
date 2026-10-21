import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  formatOccurrenceState,
  recurrenceLabel,
} from "@/lib/maintenance-scheduler/core.mjs";
import { getRecurringMaintenanceSnapshot } from "@/lib/maintenance-scheduler/postgres.mjs";

import {
  createMaintenanceScheduleAction,
  setMaintenanceScheduleActiveAction,
} from "./actions";
import styles from "./schedules.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recurring maintenance · iCamp",
  description:
    "Create recurring campground maintenance schedules and review occurrence history.",
};

type SearchParams = Promise<{
  campground?: string;
  saved?: string;
}>;

const weekdayOptions = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
] as const;

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function MaintenanceSchedulesPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const path = "/workspaces/maintenance/schedules";
  const session = await requireAnyCampgroundPermission(
    "maintenance.schedule",
    path,
  );
  const assigned = await listAssignedCampgrounds(session.user.id);
  const checked = await Promise.all(
    assigned.map(async (campground) => ({
      campground,
      allowed: await hasCampgroundPermission(
        session.user.id,
        campground.campgroundId,
        "maintenance.schedule",
      ),
    })),
  );
  const authorized = checked
    .filter((entry) => entry.allowed)
    .map((entry) => entry.campground);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find(
      (campground) => campground.campgroundId === params.campground,
    ) ?? authorized[0];

  const snapshot = await getRecurringMaintenanceSnapshot(
    session.user.id,
    selected.campgroundId,
  );
  const activeSchedules = snapshot.schedules.filter(
    (schedule) => schedule.isActive,
  ).length;
  const missedOccurrences = snapshot.occurrences.filter(
    (occurrence) => occurrence.state === "missed",
  ).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Recurring schedules</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 067 · Maintenance automation</p>
          <h1>Recurring Maintenance Scheduler</h1>
          <p className="hero-panel__lead">
            Define recurring maintenance once, let the durable Build 007
            scheduler emit discrete occurrences, and materialize each due
            occurrence into the canonical Build 065 work-order engine.
          </p>
        </section>

        {params.saved ? (
          <p className={styles.notice} role="status">
            {params.saved}
          </p>
        ) : null}

        <section className="content-panel" aria-labelledby="scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Open schedules
              </button>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/work-orders?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Open work-order board
              </Link>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Automation status"
            title="Recurring maintenance summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 067</span>}
          />
          <p>
            <strong>{activeSchedules}</strong> active schedules ·{" "}
            <strong>{snapshot.schedules.length}</strong> total schedules ·{" "}
            <strong>{missedOccurrences}</strong> missed occurrences in the
            latest history window.
          </p>
          <p className={styles.boundary}>
            Schedule definitions are immutable after creation so historical
            occurrence evidence stays interpretable. To change a definition,
            deactivate it and create a replacement.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="create-heading">
          <SectionHeading
            eyebrow="New recurrence"
            title="Create recurring maintenance"
            id="create-heading"
            helpTopic="shell.overview"
          />
          <form action={createMaintenanceScheduleAction} className="page-stack">
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Schedule title</span>
                <input name="title" minLength={3} maxLength={160} required />
              </label>
              <label className={styles.field}>
                <span>Priority</span>
                <select name="priorityPolicyId" required>
                  {snapshot.priorities.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {titleCase(priority.priorityKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Category</span>
                <select name="categoryId" required>
                  {snapshot.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>First occurrence</span>
                <input
                  name="firstOccurrenceLocal"
                  type="datetime-local"
                  required
                />
                <small className={styles.help}>
                  Interpreted in {snapshot.campground.timezone}.
                </small>
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Description</span>
                <textarea name="description" maxLength={4000} />
              </label>
            </div>

            <div className={styles.targetGrid}>
              <label className={styles.field}>
                <span>Campground section (optional)</span>
                <select name="sectionId" defaultValue="">
                  <option value="">No section</option>
                  {snapshot.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Operational asset (optional)</span>
                <select name="assetId" defaultValue="">
                  <option value="">No asset</option>
                  {snapshot.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Accommodation (optional)</span>
                <select name="accommodationId" defaultValue="">
                  <option value="">No accommodation</option>
                  {snapshot.accommodations.map((accommodation) => (
                    <option key={accommodation.id} value={accommodation.id}>
                      {accommodation.code} · {accommodation.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Location description (optional)</span>
                <input name="locationDescription" maxLength={240} />
              </label>
            </div>

            <div className={styles.recurrenceGrid}>
              <label className={styles.field}>
                <span>Recurrence</span>
                <select name="recurrenceKind" defaultValue="daily">
                  <option value="hourly">Hourly</option>
                  <option value="every_n_hours">Every N hours</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="seasonal">Seasonal / yearly</option>
                  <option value="custom">Custom minute interval</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Interval value</span>
                <input
                  name="intervalValue"
                  type="number"
                  min="1"
                  max="525600"
                  step="1"
                  placeholder="N hours or custom minutes"
                />
              </label>
              <label className={styles.field}>
                <span>Weekly weekday</span>
                <select name="weekday" defaultValue="1">
                  {weekdayOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Monthly day</span>
                <input
                  name="monthDay"
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  defaultValue="1"
                />
              </label>
              <label className={styles.field}>
                <span>Season month</span>
                <input
                  name="seasonMonth"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  defaultValue="5"
                />
              </label>
              <label className={styles.field}>
                <span>Season day</span>
                <input
                  name="seasonDay"
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  defaultValue="1"
                />
              </label>
              <label className={styles.field}>
                <span>Late after (minutes)</span>
                <input
                  name="missedAfterMinutes"
                  type="number"
                  min="0"
                  max="10080"
                  step="1"
                  defaultValue="1440"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>If scheduler is late</span>
                <select name="catchUpMode" defaultValue="create_late">
                  <option value="create_late">
                    Create the work order late
                  </option>
                  <option value="mark_missed">
                    Record a missed occurrence instead
                  </option>
                </select>
              </label>
            </div>

            <p className={styles.help}>
              Use Interval value for “Every N hours” (2–168) or “Custom”
              (60–525,600 minutes). Weekly, monthly and seasonal fields are only
              used by their matching recurrence type. The first occurrence must
              match the selected weekly/monthly/seasonal anchor.
            </p>

            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Create recurring schedule
              </button>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="schedules-heading">
          <SectionHeading
            eyebrow="Definitions"
            title="Maintenance schedules"
            id="schedules-heading"
            helpTopic="shell.overview"
          />
          {snapshot.schedules.length === 0 ? (
            <p className={styles.empty}>
              No recurring maintenance schedules have been created yet.
            </p>
          ) : (
            <div className={styles.scheduleGrid}>
              {snapshot.schedules.map((schedule) => (
                <article className={styles.scheduleCard} key={schedule.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {titleCase(schedule.priorityKey)} ·{" "}
                        {schedule.categoryName}
                      </p>
                      <h3>{schedule.title}</h3>
                    </div>
                    <span className={styles.state}>
                      {schedule.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p>
                    <strong>{recurrenceLabel(schedule)}</strong>
                  </p>
                  <p>
                    Next occurrence:{" "}
                    {formatDate(
                      schedule.nextOccurrenceAt,
                      snapshot.campground.timezone,
                    )}
                  </p>
                  <p>
                    Late handling:{" "}
                    {schedule.catchUpMode === "create_late"
                      ? "create late work order"
                      : "mark occurrence missed"}{" "}
                    after {schedule.missedAfterMinutes} minutes.
                  </p>
                  <p>
                    Target:{" "}
                    {schedule.sectionName ??
                      schedule.assetName ??
                      schedule.accommodationName ??
                      schedule.locationDescription ??
                      "Campground maintenance location"}
                  </p>
                  <form action={setMaintenanceScheduleActiveAction}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input
                      type="hidden"
                      name="scheduleId"
                      value={schedule.id}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={schedule.rowVersion}
                    />
                    <input
                      type="hidden"
                      name="isActive"
                      value={schedule.isActive ? "false" : "true"}
                    />
                    <button className="primary-button" type="submit">
                      {schedule.isActive ? "Deactivate" : "Activate"} schedule
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="history-heading">
          <SectionHeading
            eyebrow="Discrete history"
            title="Latest maintenance occurrences"
            id="history-heading"
            helpTopic="shell.overview"
          />
          {snapshot.occurrences.length === 0 ? (
            <p className={styles.empty}>
              No recurring occurrences have been processed yet.
            </p>
          ) : (
            <div className={styles.history}>
              {snapshot.occurrences.map((occurrence) => (
                <article className={styles.occurrenceRow} key={occurrence.id}>
                  <div>
                    <strong>{occurrence.scheduleTitle}</strong>
                    <p>
                      Scheduled{" "}
                      {formatDate(
                        occurrence.scheduledFor,
                        snapshot.campground.timezone,
                      )}{" "}
                      · processed{" "}
                      {formatDate(
                        occurrence.processedAt,
                        snapshot.campground.timezone,
                      )}
                    </p>
                    {occurrence.reasonCode ? (
                      <p>Reason: {titleCase(occurrence.reasonCode)}</p>
                    ) : null}
                  </div>
                  <div>
                    <span className={styles.state}>
                      {formatOccurrenceState(occurrence.state)}
                    </span>
                    {occurrence.workOrderId ? (
                      <p>
                        <Link
                          href={
                            "/workspaces/maintenance/work-orders?campground=" +
                            encodeURIComponent(selected.campgroundId)
                          }
                        >
                          Open work orders
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Administrative tracking"
            title="Data freshness and refresh"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={snapshot.generatedAt}
            sectionKey="workspace.maintenance.schedules"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Channel parity"
            title="One scheduler authority"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA provides the full visual schedule editor and occurrence
            history. Voice/DTMF and SMS/MMS may request supported activation,
            deactivation or schedule-status commands only through the same
            permission-checked maintenance scheduling service. Rich recurrence
            editing, date/time selection and occurrence history use a verified
            secure-link or staff-assisted handoff rather than fake keypad
            parity.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
