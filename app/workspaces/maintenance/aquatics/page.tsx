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
  formatAquaticFacilityType,
  formatAquaticPublicState,
} from "@/lib/aquatics/core.mjs";
import { getAquaticsWorkspace } from "@/lib/aquatics/postgres.mjs";

import {
  configureAquaticProgramAction,
  startAquaticInspectionAction,
  transitionAquaticFacilityAction,
} from "./actions";
import styles from "./aquatics.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pool & water-park operations · iCamp",
  description:
    "Recurring aquatic maintenance checks, signed inspection evidence and safety-sensitive operating controls.",
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

export default async function AquaticsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const path = "/workspaces/maintenance/aquatics";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const permissions = await Promise.all(
          ["aquatics.read", "aquatics.manage", "aquatics.reopen"].map(
            (permission) =>
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

  const workspace = await getAquaticsWorkspace(
    session.user.id,
    selected.campgroundId,
  );
  const [canManage, canReopen, canPerform] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "aquatics.manage",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "aquatics.reopen",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.perform",
    ),
  ]);

  const programByAsset = new Map(
    workspace.programs.map((program) => [program.assetId, program]),
  );
  const openCount = workspace.facilities.filter(
    (facility) => facility.publicState === "open",
  ).length;
  const limitedCount = workspace.facilities.filter(
    (facility) => facility.publicState === "limited",
  ).length;
  const closedCount = workspace.facilities.filter(
    (facility) => facility.publicState === "closed",
  ).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Pool & water-park operations</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 069 · Aquatic operations</p>
          <h1>Pool & Water-Park Maintenance Operations</h1>
          <p className="hero-panel__lead">
            Bind each aquatic facility to the existing recurring maintenance
            scheduler and signed inspection system, then control
            open/limited/closed operation through the canonical asset status
            engine.
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
                Open aquatic operations
              </button>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/inspections?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Open inspections
              </Link>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/schedules?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Open recurring schedules
              </Link>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Management visibility"
            title="Aquatic operating summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 069</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Aquatic facilities</span>
              <strong>{workspace.facilities.length}</strong>
            </div>
            <div>
              <span>Open</span>
              <strong>{openCount}</strong>
            </div>
            <div>
              <span>Limited</span>
              <strong>{limitedCount}</strong>
            </div>
            <div>
              <span>Closed/restricted</span>
              <strong>{closedCount}</strong>
            </div>
            <div>
              <span>Configured programs</span>
              <strong>{workspace.programs.length}</strong>
            </div>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="programs-heading">
          <SectionHeading
            eyebrow="Recurring checks"
            title="Aquatic operating programs"
            id="programs-heading"
            helpTopic="shell.overview"
          />
          <p className={styles.boundary}>
            Each program binds one Pool/Water-Park asset to one active Build
            067 recurring maintenance schedule and one active Build 068
            inspection template whose current version requires independent
            sign-off. No second scheduler, checklist engine or operating-state
            model is created here.
          </p>

          {workspace.facilities.length === 0 ? (
            <p className={styles.empty}>
              No Pool or Water-Park operational assets exist at this campground.
            </p>
          ) : (
            <div className={styles.facilityGrid}>
              {workspace.facilities.map((facility) => {
                const program = programByAsset.get(facility.id) ?? null;
                const templates = workspace.templates.filter(
                  (template) =>
                    template.assetId === facility.id &&
                    template.signoffRequired &&
                    (template.isActive ||
                      template.id === program?.inspectionTemplateId),
                );
                const schedules = workspace.schedules.filter(
                  (schedule) =>
                    schedule.assetId === facility.id &&
                    (schedule.isActive ||
                      schedule.id === program?.maintenanceScheduleId),
                );
                const canConfigure =
                  canManage && templates.length > 0 && schedules.length > 0;

                return (
                  <article className={styles.facilityCard} key={facility.id}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {formatAquaticFacilityType(facility.facilityType)}
                        </p>
                        <h3>{facility.name}</h3>
                      </div>
                      <span className={styles.state}>
                        {formatAquaticPublicState(facility.publicState)}
                      </span>
                    </div>

                    {canManage ? (
                      <form
                        action={configureAquaticProgramAction}
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
                          <span>Signed inspection template</span>
                          <select
                            name="inspectionTemplateId"
                            defaultValue={program?.inspectionTemplateId ?? ""}
                            required
                          >
                            <option value="">Choose template</option>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name} · v{template.versionNumber}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span>Recurring maintenance schedule</span>
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
                          <span>Reopen inspection freshness (minutes)</span>
                          <input
                            name="reopenInspectionMaxAgeMinutes"
                            type="number"
                            min="15"
                            max="10080"
                            step="1"
                            defaultValue={
                              program?.reopenInspectionMaxAgeMinutes ?? 240
                            }
                            required
                          />
                        </label>

                        <label className={styles.field}>
                          <span>Program notes</span>
                          <textarea
                            name="notes"
                            maxLength={2000}
                            defaultValue={program?.notes ?? ""}
                          />
                        </label>

                        <label>
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
                            disabled={!canConfigure}
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
                          This facility needs an active independent-signoff
                          inspection template and an active recurring maintenance
                          schedule before an aquatic operating program can be
                          activated.
                        </p>
                        <div className={styles.actions}>
                          <Link
                            href={
                              "/workspaces/maintenance/inspections?campground=" +
                              encodeURIComponent(selected.campgroundId)
                            }
                          >
                            Inspection templates
                          </Link>
                          <Link
                            href={
                              "/workspaces/maintenance/schedules?campground=" +
                              encodeURIComponent(selected.campgroundId)
                            }
                          >
                            Recurring schedules
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="controls-heading">
          <SectionHeading
            eyebrow="Safety-sensitive controls"
            title="Operating state & signed inspection"
            id="controls-heading"
            helpTopic="shell.overview"
          />
          {workspace.programs.length === 0 ? (
            <p className={styles.empty}>
              Configure an aquatic operating program before using these
              controls.
            </p>
          ) : (
            <div className={styles.programGrid}>
              {workspace.programs.map((program) => (
                <article className={styles.programCard} key={program.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {formatAquaticFacilityType(program.facilityType)}
                      </p>
                      <h3>{program.assetName}</h3>
                    </div>
                    <span className={styles.state}>
                      {formatAquaticPublicState(program.publicState)}
                    </span>
                  </div>

                  <p>
                    Inspection: <strong>{program.inspectionTemplateName}</strong>{" "}
                    v{program.inspectionVersionNumber}
                  </p>
                  <p>
                    Schedule: <strong>{program.maintenanceScheduleTitle}</strong>{" "}
                    · {titleCase(program.recurrenceKind)}
                  </p>
                  <p>
                    Next check:{" "}
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

                  {canPerform && program.isActive ? (
                    <form action={startAquaticInspectionAction}>
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
                        Start signed safety inspection
                      </button>
                    </form>
                  ) : null}

                  {canManage || canReopen ? (
                    <form
                      action={transitionAquaticFacilityAction}
                      className={styles.decisionGrid}
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
                      <input
                        type="hidden"
                        name="assetRowVersion"
                        value={program.assetRowVersion}
                      />

                      <label className={styles.field}>
                        <span>Operating decision</span>
                        <select name="publicState" required>
                          <option value="">Choose action</option>
                          {canManage && program.publicState === "open" ? (
                            <option value="limited">
                              Move to limited operation
                            </option>
                          ) : null}
                          {canManage && program.publicState !== "closed" ? (
                            <option value="closed">Close facility</option>
                          ) : null}
                          {canReopen && program.publicState !== "open" ? (
                            <option value="open">
                              Reopen from signed inspection
                            </option>
                          ) : null}
                        </select>
                      </label>

                      <label className={styles.field}>
                        <span>Reason</span>
                        <input
                          name="reason"
                          minLength={8}
                          maxLength={1000}
                          required
                        />
                      </label>

                      <div className={styles.actions}>
                        <button className="primary-button" type="submit">
                          Record operating decision
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <p className={styles.help}>
                    Reopening is high-risk and fails closed unless there is a
                    fresh independently signed inspection after the latest
                    restriction and every failed checklist item has resolved
                    corrective work.
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="evidence-heading">
          <SectionHeading
            eyebrow="Inspection & maintenance evidence"
            title="Aquatic check history"
            id="evidence-heading"
            helpTopic="shell.overview"
          />
          {workspace.evidence.length === 0 ? (
            <p className={styles.empty}>
              No aquatic inspection evidence has been recorded yet.
            </p>
          ) : (
            <div className={styles.history}>
              {workspace.evidence.map((evidence) => (
                <article className={styles.evidenceRow} key={evidence.id}>
                  <div>
                    <strong>{evidence.assetName}</strong>
                    <p>
                      {evidence.inspectionTemplateName} v
                      {evidence.versionNumber} ·{" "}
                      {titleCase(evidence.inspectionStatus)}
                    </p>
                    <p>
                      Started{" "}
                      {formatDate(
                        evidence.startedAt,
                        workspace.campground.timezone,
                      )}
                      {evidence.scheduledFor
                        ? " · scheduled check " +
                          formatDate(
                            evidence.scheduledFor,
                            workspace.campground.timezone,
                          )
                        : " · ad hoc safety inspection"}
                    </p>
                  </div>
                  <div>
                    {evidence.workOrderId ? (
                      <p>
                        Work order:{" "}
                        <strong>
                          {titleCase(evidence.workOrderStatus ?? "unknown")}
                        </strong>
                      </p>
                    ) : (
                      <p>No recurring work order linked.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="decisions-heading">
          <SectionHeading
            eyebrow="Operating evidence"
            title="Restriction & reopen history"
            id="decisions-heading"
            helpTopic="shell.overview"
          />
          {workspace.decisions.length === 0 ? (
            <p className={styles.empty}>
              No aquatic operating decisions have been recorded yet.
            </p>
          ) : (
            <div className={styles.history}>
              {workspace.decisions.map((decision) => (
                <article className={styles.decisionRow} key={decision.id}>
                  <div>
                    <strong>{decision.assetName}</strong>
                    <p>
                      {titleCase(decision.decisionKey)} ·{" "}
                      {titleCase(decision.fromState)} →{" "}
                      {titleCase(decision.toState)}
                    </p>
                    <p>{decision.reason}</p>
                  </div>
                  <div>
                    <p>
                      {formatDate(
                        decision.decidedAt,
                        workspace.campground.timezone,
                      )}
                    </p>
                    {decision.signedInspectionOccurrenceId ? (
                      <p>Signed inspection evidence attached.</p>
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
            renderedAt={workspace.generatedAt}
            sectionKey="workspace.maintenance.aquatics"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Safety & channel boundary"
            title="One operational authority"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            iCamp records recurring maintenance, inspection evidence and staff
            decisions; it does not replace certified pool/water-park safety
            systems, legally required water testing, trained operators,
            lifeguards or emergency procedures. Web/PWA provides the full
            program, checklist and reopen review. IVR/DTMF and SMS may report a
            defect, request status, or initiate supported restricted-state
            commands through verified staff identity, but high-risk reopening
            requires the same signed evidence and authorization and otherwise
            uses a secure-link or staff-assisted handoff.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
