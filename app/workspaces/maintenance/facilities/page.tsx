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
  facilityIssueKinds,
  facilityUpkeepKinds,
  formatFacilityState,
  formatFacilityUpkeepKind,
} from "@/lib/facility-upkeep/core.mjs";
import { getFacilityUpkeepWorkspace } from "@/lib/facility-upkeep/postgres.mjs";

import {
  configureFacilityUpkeepProgramAction,
  recordFacilityUpkeepSnapshotAction,
  reportFacilityUpkeepIssueAction,
  startFacilityUpkeepInspectionAction,
} from "./actions";
import styles from "./facilities.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Washroom, shower & laundry upkeep · iCamp",
  description:
    "Scheduled cleaning, inspection, supply status and corrective maintenance for campground comfort facilities.",
};

type SearchParams = Promise<{
  campground?: string;
  saved?: string;
}>;

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null, timezone: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function FacilityUpkeepPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const path = "/workspaces/maintenance/facilities";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const readPermissions = [
    "maintenance.read",
    "maintenance.create",
    "maintenance.assign",
    "maintenance.complete",
    "maintenance.schedule",
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

  const workspace = await getFacilityUpkeepWorkspace(
    session.user.id,
    selected.campgroundId,
  );

  const [canConfigure, canPerform, canCreate, canComplete] = await Promise.all([
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
      "maintenance.create",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.complete",
    ),
  ]);

  const canRecord = canCreate || canComplete;
  const programByAsset = new Map(
    workspace.programs.map((program) => [program.assetId, program]),
  );
  const latestSnapshotByProgram = new Map<
    string,
    (typeof workspace.snapshots)[number]
  >();
  for (const snapshot of workspace.snapshots) {
    if (!latestSnapshotByProgram.has(snapshot.programId)) {
      latestSnapshotByProgram.set(snapshot.programId, snapshot);
    }
  }

  const activePrograms = workspace.programs.filter(
    (program) => program.isActive,
  ).length;
  const serviceDue = [...latestSnapshotByProgram.values()].filter(
    (snapshot) =>
      snapshot.cleanlinessState !== "clean" ||
      snapshot.fixtureState !== "operational",
  ).length;
  const supplyAttention = [...latestSnapshotByProgram.values()].filter(
    (snapshot) =>
      snapshot.supplyState === "low" || snapshot.supplyState === "out",
  ).length;
  const openIssues = workspace.issues.filter((issue) => !issue.resolved).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Washroom, shower & laundry upkeep</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 070 · Facility upkeep</p>
          <h1>Washroom, Shower & Laundry Upkeep</h1>
          <p className="hero-panel__lead">
            Schedule cleaning and inspection, record supply and facility
            condition, and escalate defects into the existing maintenance
            work-order engine without creating a second scheduler, checklist or
            issue-closure system.
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
                Open facility upkeep
              </button>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/work-orders?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Work orders
              </Link>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/inspections?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Inspections
              </Link>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/schedules?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Recurring schedules
              </Link>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Management visibility"
            title="Comfort-facility upkeep summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 070</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Eligible facilities</span>
              <strong>{workspace.facilities.length}</strong>
            </div>
            <div>
              <span>Active programs</span>
              <strong>{activePrograms}</strong>
            </div>
            <div>
              <span>Service attention</span>
              <strong>{serviceDue}</strong>
            </div>
            <div>
              <span>Supply attention</span>
              <strong>{supplyAttention}</strong>
            </div>
            <div>
              <span>Open issues</span>
              <strong>{openIssues}</strong>
            </div>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="programs-heading">
          <SectionHeading
            eyebrow="Scheduled cleaning & inspection"
            title="Facility upkeep programs"
            id="programs-heading"
            helpTopic="shell.overview"
          />
          <p className={styles.boundary}>
            Each program binds an existing facility asset to one Build 067
            recurring maintenance schedule and one published Build 068
            inspection template. Generated cleaning work remains a normal Build
            065 maintenance work order.
          </p>

          {workspace.facilities.length === 0 ? (
            <p className={styles.empty}>
              No eligible washroom/building operational assets exist at this
              campground yet.
            </p>
          ) : (
            <div className={styles.facilityGrid}>
              {workspace.facilities.map((facility) => {
                const program = programByAsset.get(facility.id) ?? null;
                const templates = workspace.templates.filter(
                  (template) =>
                    template.assetId === facility.id &&
                    (template.isActive ||
                      template.id === program?.inspectionTemplateId),
                );
                const schedules = workspace.schedules.filter(
                  (schedule) =>
                    schedule.assetId === facility.id &&
                    (schedule.isActive ||
                      schedule.id === program?.maintenanceScheduleId),
                );
                const defaultKind =
                  program?.facilityKind ??
                  (facility.facilityType === "washroom"
                    ? "washroom"
                    : "combined");

                return (
                  <article className={styles.facilityCard} key={facility.id}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {titleCase(facility.facilityType)}
                        </p>
                        <h3>{facility.name}</h3>
                      </div>
                      <span className={styles.state}>
                        {titleCase(facility.operatingState)}
                      </span>
                    </div>

                    {canConfigure ? (
                      <form
                        action={configureFacilityUpkeepProgramAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="assetId"
                          value={facility.id}
                        />
                        {program ? (
                          <input
                            type="hidden"
                            name="rowVersion"
                            value={program.rowVersion}
                          />
                        ) : null}

                        <label className={styles.field}>
                          <span>Facility upkeep type</span>
                          <select
                            name="facilityKind"
                            defaultValue={defaultKind}
                            required
                          >
                            {facilityUpkeepKinds.map((kind) => (
                              <option
                                key={kind}
                                value={kind}
                                disabled={
                                  kind === "washroom" &&
                                  facility.facilityType !== "washroom"
                                }
                              >
                                {formatFacilityUpkeepKind(kind)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Published inspection template</span>
                          <select
                            name="inspectionTemplateId"
                            defaultValue={program?.inspectionTemplateId ?? ""}
                            required
                          >
                            <option value="">Choose template</option>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name} · v{template.versionNumber}
                                {template.signoffRequired ? " · signed" : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Recurring cleaning schedule</span>
                          <select
                            name="maintenanceScheduleId"
                            defaultValue={program?.maintenanceScheduleId ?? ""}
                            required
                          >
                            <option value="">Choose schedule</option>
                            {schedules.map((schedule) => (
                              <option key={schedule.id} value={schedule.id}>
                                {schedule.title} ·{" "}
                                {titleCase(schedule.recurrenceKind)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Program notes</span>
                          <textarea
                            name="notes"
                            maxLength={2000}
                            defaultValue={program?.notes ?? ""}
                          />
                        </label>

                        <label className={styles.checkbox}>
                          <input
                            name="isActive"
                            type="checkbox"
                            defaultChecked={program?.isActive ?? true}
                          />{" "}
                          Program active
                        </label>

                        <div className={styles.actions}>
                          <button
                            className="primary-button"
                            type="submit"
                            disabled={
                              templates.length === 0 || schedules.length === 0
                            }
                          >
                            {program ? "Update program" : "Create program"}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {templates.length === 0 || schedules.length === 0 ? (
                      <div className={styles.callout}>
                        <strong>Configuration prerequisite</strong>
                        <p>
                          This facility needs a published inspection template
                          and recurring maintenance schedule targeting the same
                          asset before an upkeep program can be activated.
                        </p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="operations-heading">
          <SectionHeading
            eyebrow="Daily operations"
            title="Cleaning, inspection, supplies & defects"
            id="operations-heading"
            helpTopic="shell.overview"
          />

          {workspace.programs.length === 0 ? (
            <p className={styles.empty}>
              Configure a facility upkeep program before recording operational
              evidence.
            </p>
          ) : (
            <div className={styles.programGrid}>
              {workspace.programs.map((program) => {
                const latest = latestSnapshotByProgram.get(program.id) ?? null;

                return (
                  <article className={styles.programCard} key={program.id}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {formatFacilityUpkeepKind(program.facilityKind)}
                        </p>
                        <h3>{program.assetName}</h3>
                      </div>
                      <span className={styles.state}>
                        {program.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p>
                      Inspection:{" "}
                      <strong>{program.inspectionTemplateName}</strong> v
                      {program.inspectionVersionNumber}
                      {program.inspectionSignoffRequired
                        ? " · independent sign-off"
                        : ""}
                    </p>
                    <p>
                      Schedule:{" "}
                      <strong>{program.maintenanceScheduleTitle}</strong> ·{" "}
                      {titleCase(program.recurrenceKind)}
                    </p>
                    <p>
                      Next cleaning:{" "}
                      {formatDate(
                        program.nextOccurrenceAt,
                        workspace.campground.timezone,
                      )}
                    </p>
                    {!program.scheduleActive ? (
                      <p className={styles.warning}>
                        Linked recurring schedule is currently inactive.
                      </p>
                    ) : null}

                    {latest ? (
                      <div className={styles.snapshotSummary}>
                        <strong>Latest status</strong>
                        <span>
                          Cleanliness:{" "}
                          {formatFacilityState(latest.cleanlinessState)}
                        </span>
                        <span>
                          Fixtures: {formatFacilityState(latest.fixtureState)}
                        </span>
                        <span>
                          Supplies: {formatFacilityState(latest.supplyState)}
                        </span>
                        <small>
                          {formatDate(
                            latest.recordedAt,
                            workspace.campground.timezone,
                          )}
                        </small>
                      </div>
                    ) : (
                      <p className={styles.help}>
                        No facility status snapshot has been recorded yet.
                      </p>
                    )}

                    {canPerform && program.isActive ? (
                      <form action={startFacilityUpkeepInspectionAction}>
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="programId"
                          value={program.id}
                        />
                        <button className="primary-button" type="submit">
                          Start scheduled inspection
                        </button>
                      </form>
                    ) : null}

                    {canRecord && program.isActive ? (
                      <form
                        action={recordFacilityUpkeepSnapshotAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="programId"
                          value={program.id}
                        />

                        <label className={styles.field}>
                          <span>Cleanliness</span>
                          <select name="cleanlinessState" defaultValue="clean">
                            <option value="clean">Clean</option>
                            <option value="service_due">Service due</option>
                            <option value="closed_for_service">
                              Closed for service
                            </option>
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Fixtures / machines</span>
                          <select
                            name="fixtureState"
                            defaultValue="operational"
                          >
                            <option value="operational">Operational</option>
                            <option value="attention">Needs attention</option>
                            <option value="out_of_service">
                              Out of service
                            </option>
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Consumable supplies</span>
                          <select name="supplyState" defaultValue="stocked">
                            <option value="stocked">Stocked</option>
                            <option value="low">Low</option>
                            <option value="out">Out</option>
                            <option value="not_applicable">
                              Not applicable
                            </option>
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Status notes</span>
                          <textarea name="notes" maxLength={2000} />
                        </label>

                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Record facility status
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {canCreate && program.isActive ? (
                      <form
                        action={reportFacilityUpkeepIssueAction}
                        className={styles.issueForm}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="programId"
                          value={program.id}
                        />

                        <strong>Escalate a defect or supply issue</strong>

                        <label className={styles.field}>
                          <span>Issue type</span>
                          <select name="issueKind" defaultValue="fixture">
                            {facilityIssueKinds.map((kind) => (
                              <option key={kind} value={kind}>
                                {titleCase(kind)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Maintenance category</span>
                          <select name="categoryId" required>
                            <option value="">Choose category</option>
                            {workspace.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Priority</span>
                          <select name="priorityPolicyId" required>
                            <option value="">Choose priority</option>
                            {workspace.priorities.map((priority) => (
                              <option key={priority.id} value={priority.id}>
                                {titleCase(priority.priorityKey)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Issue title</span>
                          <input
                            name="title"
                            minLength={3}
                            maxLength={160}
                            required
                          />
                        </label>

                        <label className={styles.field}>
                          <span>Description</span>
                          <textarea name="description" maxLength={4000} />
                        </label>

                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Create maintenance work order
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="snapshots-heading">
          <SectionHeading
            eyebrow="Supplies & condition evidence"
            title="Facility status history"
            id="snapshots-heading"
            helpTopic="shell.overview"
          />
          {workspace.snapshots.length === 0 ? (
            <p className={styles.empty}>
              No facility status snapshots have been recorded yet.
            </p>
          ) : (
            <div className={styles.history}>
              {workspace.snapshots.map((snapshot) => (
                <article className={styles.historyRow} key={snapshot.id}>
                  <div>
                    <strong>{snapshot.assetName}</strong>
                    <p>
                      {formatFacilityUpkeepKind(snapshot.facilityKind)} ·{" "}
                      {formatFacilityState(snapshot.cleanlinessState)} ·{" "}
                      {formatFacilityState(snapshot.fixtureState)} ·{" "}
                      {formatFacilityState(snapshot.supplyState)}
                    </p>
                    {snapshot.notes ? <p>{snapshot.notes}</p> : null}
                  </div>
                  <div>
                    <p>
                      {formatDate(
                        snapshot.recordedAt,
                        workspace.campground.timezone,
                      )}
                    </p>
                    {snapshot.workOrderId ? (
                      <p>
                        Scheduled work:{" "}
                        <strong>
                          {formatFacilityState(
                            snapshot.workOrderStatus ?? "unknown",
                          )}
                        </strong>
                      </p>
                    ) : (
                      <p>Ad hoc status check</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="inspection-heading">
          <SectionHeading
            eyebrow="Inspection evidence"
            title="Cleaning & facility inspection history"
            id="inspection-heading"
            helpTopic="shell.overview"
          />
          {workspace.inspections.length === 0 ? (
            <p className={styles.empty}>
              No facility inspection evidence has been recorded yet.
            </p>
          ) : (
            <div className={styles.history}>
              {workspace.inspections.map((inspection) => (
                <article className={styles.historyRow} key={inspection.id}>
                  <div>
                    <strong>{inspection.assetName}</strong>
                    <p>
                      {inspection.inspectionTemplateName} v
                      {inspection.versionNumber} ·{" "}
                      {formatFacilityState(inspection.inspectionStatus)}
                    </p>
                  </div>
                  <div>
                    <p>
                      Started{" "}
                      {formatDate(
                        inspection.startedAt,
                        workspace.campground.timezone,
                      )}
                    </p>
                    {inspection.scheduledFor ? (
                      <p>
                        Scheduled{" "}
                        {formatDate(
                          inspection.scheduledFor,
                          workspace.campground.timezone,
                        )}
                      </p>
                    ) : (
                      <p>Ad hoc inspection</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="issues-heading">
          <SectionHeading
            eyebrow="Issue escalation & closure"
            title="Facility corrective-work register"
            id="issues-heading"
            helpTopic="shell.overview"
          />
          <p className={styles.boundary}>
            Every issue is a canonical maintenance work order. It is resolved
            only when that work order reaches Completed or Cancelled; Build 070
            does not maintain a second issue-status field.
          </p>
          {workspace.issues.length === 0 ? (
            <p className={styles.empty}>
              No facility corrective issues have been reported yet.
            </p>
          ) : (
            <div className={styles.history}>
              {workspace.issues.map((issue) => (
                <article className={styles.historyRow} key={issue.id}>
                  <div>
                    <strong>{issue.assetName}</strong>
                    <p>
                      {titleCase(issue.issueKind)} ·{" "}
                      {titleCase(issue.priorityKey)}
                    </p>
                    <p>{issue.workOrderTitle}</p>
                  </div>
                  <div>
                    <span className={styles.state}>
                      {issue.resolved
                        ? "Resolved"
                        : formatFacilityState(issue.workOrderStatus)}
                    </span>
                    <p>
                      {formatDate(
                        issue.createdAt,
                        workspace.campground.timezone,
                      )}
                    </p>
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
            renderedAt={workspace.generatedAt}
            sectionKey="workspace.maintenance.facility-upkeep"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Channel & operational boundary"
            title="One maintenance authority"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA provides the complete visual program, supply, checklist and
            corrective-work review. Verified IVR/DTMF or SMS workflows may
            report a facility defect or request supported status facts through
            the existing communications and identity controls, while rich
            checklist configuration and evidence review use a secure-link or
            staff-assisted handoff. iCamp records upkeep operations; it does not
            replace required public-health, accessibility, electrical, plumbing,
            laundry-equipment or workplace-safety procedures.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
