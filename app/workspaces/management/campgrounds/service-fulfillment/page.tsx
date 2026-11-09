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

import { updateFulfillmentAction } from "./actions";
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
}: {
  job: FulfillmentJob;
  campgroundId: string;
}) {
  const options = transitions[job.jobState] ?? [];
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
      {job.staffNote ? <p>Staff note: {job.staffNote}</p> : null}
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
  const outstanding = queue.jobs.filter(
    (job) => job.jobState !== "completed",
  ).length;

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
          <p className="eyebrow">Campground product · Build 235</p>
          <h1>Add-on scheduling &amp; fulfillment</h1>
          <p className="hero-panel__lead">
            Reservation-linked work queue for optional camping extras, with
            shared daily unit limits and staff acknowledgements.
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
          {params.result === "update-error" ? (
            <p role="alert">
              Work could not be updated. Refresh, confirm the date is inside the
              stay, and check available capacity or permissions.
            </p>
          ) : null}
          {queue.truncated ? (
            <p role="alert">
              Showing the first 250 tasks only. Narrower filters will be
              required for larger queues.
            </p>
          ) : null}
        </section>
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
          {queue.jobs.length ? (
            <div className={styles.list}>
              {queue.jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  campgroundId={selected.campgroundId}
                />
              ))}
            </div>
          ) : (
            <p>
              No active reservation add-on work is waiting in this campground.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
