import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  formatCampsiteType,
  formatCleanupState,
} from "@/lib/campsite-departure-cleanup/core.mjs";
import { getCampsiteDepartureCleanupWorkspace } from "@/lib/campsite-departure-cleanup/postgres.mjs";

import {
  clearCampsiteDepartureCleanupTaskAction,
  configureCampsiteDepartureCleanupProgramAction,
  startCampsiteDepartureCleanupInspectionAction,
} from "./actions";
import styles from "./departure-cleanup.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Departure campsite cleanup · iCamp",
  description:
    "Automatic post-checkout campsite cleanup, site-type inspection checklists, corrective work and rebooking clearance.",
};

type SearchParams = Promise<{
  campground?: string;
  saved?: string;
}>;

function formatDate(value: string | null, timezone: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function DepartureCampsiteCleanupPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const path = "/workspaces/maintenance/departure-cleanup";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const readPermissions = [
    "maintenance.read",
    "maintenance.create",
    "maintenance.complete",
    "maintenance.schedule",
    "inspection.perform",
    "inspection.signoff",
    "inspection.template.manage",
    "reservation.read",
    "reservation.modify",
  ];

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const permissions = await Promise.all(
          readPermissions.map((permission) =>
            hasCampgroundPermission(
              session.user.id,
              campground.campgroundId,
              permission,
            ),
          ),
        );
        return permissions.some(Boolean) ? campground : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find(
      (campground) => campground.campgroundId === params.campground,
    ) ?? authorized[0];

  const workspace = await getCampsiteDepartureCleanupWorkspace(
    session.user.id,
    selected.campgroundId,
  );

  const [
    canConfigure,
    canPerform,
    canComplete,
    canSignoff,
    canManageAccommodation,
  ] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.schedule",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.perform",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.complete",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.signoff",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "accommodation.manage",
    ),
  ]);

  const programByAccommodation = new Map(
    workspace.programs.map((program) => [program.accommodationId, program]),
  );
  const openTasks = workspace.tasks.filter((task) => !task.clearedAt);
  const configurationRequired = openTasks.filter(
    (task) => !task.programId,
  ).length;
  const blockedForRebooking = openTasks.filter(
    (task) =>
      task.blockRebookingUntilClear &&
      task.accommodationStatusState === "inspection",
  ).length;
  const correctiveWorkOpen = openTasks.filter(
    (task) => task.openCorrectiveWorkOrders > 0,
  ).length;
  const canClear = canComplete || canSignoff;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Departure campsite cleanup</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 073 · Departure operations</p>
          <h1>Departure Campsite Cleanup</h1>
          <p className="hero-panel__lead">
            Checkout automatically hands campsites into a site-type cleanup
            queue. Build 068 remains the checklist and sign-off authority,
            Build 065 remains corrective-work authority, and Build 030 remains
            the only booking-availability state authority.
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
                Open cleanup queue
              </button>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/inspections"
              >
                Open inspections
              </Link>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Automatic handoff"
            title="Departure cleanup readiness"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 073</span>}
          />
          <div className={styles.metrics}>
            <div>
              <strong>{openTasks.length}</strong>
              <span>Open cleanup tasks</span>
            </div>
            <div>
              <strong>{configurationRequired}</strong>
              <span>Configuration required</span>
            </div>
            <div>
              <strong>{blockedForRebooking}</strong>
              <span>Blocked for rebooking</span>
            </div>
            <div>
              <strong>{correctiveWorkOpen}</strong>
              <span>With corrective work open</span>
            </div>
          </div>
          <p className={styles.boundary}>
            Physical checkout remains complete even when cleanup configuration
            is missing. A campsite stays in canonical{" "}
            <code>inspection</code> status by default; only a configured
            non-blocking program permits immediate return to{" "}
            <code>available</code>. Cleanup clearance never invents a second
            booking-state flag.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="programs-heading">
          <SectionHeading
            eyebrow="Site-type configuration"
            title="Cleanup inspection programs"
            id="programs-heading"
            helpTopic="shell.overview"
          />
          <div className={styles.grid}>
            {workspace.campsites.map((campsite) => {
              const program = programByAccommodation.get(campsite.id);
              const templates = workspace.templates.filter(
                (template) =>
                  template.accommodationId === campsite.id &&
                  template.isActive,
              );

              return (
                <article className={styles.card} key={campsite.id}>
                  <header className={styles.cardHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {formatCampsiteType(campsite.campsiteType)} campsite
                      </p>
                      <h3>
                        {campsite.code} · {campsite.name}
                      </h3>
                    </div>
                    <span className={styles.state}>
                      {campsite.statusState}
                    </span>
                  </header>

                  {canConfigure && templates.length > 0 ? (
                    <form
                      action={
                        configureCampsiteDepartureCleanupProgramAction
                      }
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="accommodationId"
                        value={campsite.id}
                      />
                      <input
                        type="hidden"
                        name="campsiteType"
                        value={campsite.campsiteType}
                      />
                      <input
                        type="hidden"
                        name="rowVersion"
                        value={program?.rowVersion ?? ""}
                      />
                      <label className={styles.field}>
                        <span>Departure cleanup checklist</span>
                        <select
                          name="inspectionTemplateId"
                          defaultValue={
                            program?.inspectionTemplateId ?? templates[0]?.id
                          }
                          required
                        >
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name} · v{template.versionNumber}
                              {template.signoffRequired
                                ? " · sign-off"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Program notes</span>
                        <textarea
                          name="notes"
                          defaultValue={program?.notes ?? ""}
                          maxLength={2000}
                        />
                      </label>
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          name="blockRebookingUntilClear"
                          defaultChecked={
                            program?.blockRebookingUntilClear ?? true
                          }
                        />{" "}
                        Block rebooking until cleanup and inspection clear
                      </label>
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={program?.isActive ?? true}
                        />{" "}
                        Program active
                      </label>
                      <div className={styles.actions}>
                        <button className="primary-button" type="submit">
                          {program ? "Update program" : "Configure program"}
                        </button>
                      </div>
                    </form>
                  ) : templates.length === 0 ? (
                    <p className={styles.warning}>
                      Create and publish a Build 068 site inspection template
                      for this campsite before activating departure cleanup.
                    </p>
                  ) : (
                    <p className={styles.help}>
                      maintenance.schedule permission is required to change
                      cleanup configuration.
                    </p>
                  )}

                  {program ? (
                    <p className={styles.help}>
                      Current program: {program.inspectionTemplateName} · v
                      {program.inspectionVersionNumber} ·{" "}
                      {program.blockRebookingUntilClear
                        ? "rebooking blocked until clear"
                        : "rebooking may resume before cleanup clear"}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="queue-heading">
          <SectionHeading
            eyebrow="Post-checkout work"
            title="Departure cleanup queue"
            id="queue-heading"
            helpTopic="shell.overview"
          />
          <div className={styles.taskList}>
            {workspace.tasks.length === 0 ? (
              <p className={styles.empty}>
                No campsite departure cleanup tasks have been created yet.
              </p>
            ) : (
              workspace.tasks.map((task) => {
                const state = formatCleanupState(task);
                const mayClear =
                  canClear &&
                  task.inspectionStatus === "signed_off" &&
                  task.openCorrectiveWorkOrders === 0 &&
                  (!task.blockRebookingUntilClear ||
                    canManageAccommodation) &&
                  !task.clearedAt;

                return (
                  <article className={styles.taskCard} key={task.id}>
                    <header className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {formatCampsiteType(task.campsiteType)} · checkout{" "}
                          {formatDate(
                            task.checkedOutAt,
                            workspace.campground.timezone,
                          )}
                        </p>
                        <h3>
                          {task.campsiteCode} · {task.campsiteName}
                        </h3>
                      </div>
                      <span className={styles.state}>{state}</span>
                    </header>

                    <div className={styles.taskFacts}>
                      <span>
                        Canonical site state:{" "}
                        <strong>{task.accommodationStatusState}</strong>
                      </span>
                      <span>
                        Rebooking policy:{" "}
                        <strong>
                          {task.blockRebookingUntilClear
                            ? "blocked until clear"
                            : "not blocked by cleanup"}
                        </strong>
                      </span>
                      <span>
                        Inspection:{" "}
                        <strong>{task.inspectionStatus ?? "not started"}</strong>
                      </span>
                      <span>
                        Corrective work:{" "}
                        <strong>
                          {task.openCorrectiveWorkOrders} open /{" "}
                          {task.correctiveWorkOrders} total
                        </strong>
                      </span>
                    </div>

                    {!task.programId && !task.clearedAt ? (
                      <p className={styles.warning}>
                        Cleanup configuration is required. Checkout is already
                        complete; this handoff remains safely blocked by the
                        canonical inspection state.
                      </p>
                    ) : null}

                    {!task.inspectionOccurrenceId &&
                    task.programId &&
                    canPerform &&
                    !task.clearedAt ? (
                      <form
                        action={
                          startCampsiteDepartureCleanupInspectionAction
                        }
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="taskId"
                          value={task.id}
                        />
                        <button className="primary-button" type="submit">
                          Start campsite cleanup inspection
                        </button>
                      </form>
                    ) : null}

                    {task.inspectionOccurrenceId && !task.clearedAt ? (
                      <div className={styles.actions}>
                        <Link
                          className="primary-link primary-link--dark"
                          href={
                            "/workspaces/maintenance/inspections?campground=" +
                            encodeURIComponent(selected.campgroundId)
                          }
                        >
                          Complete / review inspection
                        </Link>
                        {task.openCorrectiveWorkOrders > 0 ? (
                          <Link
                            className="primary-link primary-link--dark"
                            href={
                              "/workspaces/maintenance/work-orders?campground=" +
                              encodeURIComponent(selected.campgroundId)
                            }
                          >
                            Open corrective work orders
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {mayClear ? (
                      <form
                        action={clearCampsiteDepartureCleanupTaskAction}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="taskId"
                          value={task.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={task.rowVersion}
                        />
                        <button className="primary-button" type="submit">
                          Clear departure cleanup
                        </button>
                      </form>
                    ) : null}

                    {task.clearedAt ? (
                      <p className={styles.help}>
                        Cleared{" "}
                        {formatDate(
                          task.clearedAt,
                          workspace.campground.timezone,
                        )}
                        .
                      </p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="channels-heading">
          <SectionHeading
            eyebrow="Omnichannel boundary"
            title="Safe remote handling"
            id="channels-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA is the full visual checklist and evidence surface. IVR/DTMF
            and SMS/MMS may expose concise cleanup queue, inspection and
            clearance status through the same canonical records, but visual
            condition decisions, checklist evidence and corrective-work review
            fall back to the secure Web/PWA workflow.
          </p>
        </section>

        <AdminRefreshControl
          renderedAt={workspace.generatedAt}
          sectionKey="maintenance.departure-campsite-cleanup"
        />
      </div>
    </AppShell>
  );
}
