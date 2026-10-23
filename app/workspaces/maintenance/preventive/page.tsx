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
import { recurrenceLabel } from "@/lib/maintenance-scheduler/core.mjs";
import {
  formatPreventiveAssetClass,
  preventiveInstructionSteps,
} from "@/lib/preventive-maintenance/core.mjs";
import { getPreventiveMaintenanceWorkspace } from "@/lib/preventive-maintenance/postgres.mjs";

import {
  configurePreventiveMaintenanceProgramAction,
  createPreventiveMaintenanceTemplateAction,
  setPreventiveMaintenanceProgramActiveAction,
  setPreventiveMaintenanceTemplateActiveAction,
} from "./actions";
import styles from "./preventive.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preventive maintenance · iCamp",
  description:
    "Preventive service templates, recurring intervals, overdue visibility, parts history and labour history for campground facilities and equipment.",
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function assetDetail(
  asset: Awaited<
    ReturnType<typeof getPreventiveMaintenanceWorkspace>
  >["assets"][number],
) {
  if (asset.assetClass === "facility") {
    return asset.facilityType ? titleCase(asset.facilityType) : "Facility";
  }
  const identity = [asset.make, asset.model].filter(Boolean).join(" ");
  return [
    asset.equipmentType ? titleCase(asset.equipmentType) : "Equipment",
    identity || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function PreventiveMaintenancePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const path = "/workspaces/maintenance/preventive";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const readPermissions = [
    "maintenance.read",
    "maintenance.create",
    "maintenance.schedule",
    "maintenance.preventive",
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

  const workspace = await getPreventiveMaintenanceWorkspace(
    session.user.id,
    selected.campgroundId,
  );
  const canConfigure = await hasCampgroundPermission(
    session.user.id,
    selected.campgroundId,
    "maintenance.preventive",
  );

  const assetById = new Map(workspace.assets.map((asset) => [asset.id, asset]));
  const programById = new Map(
    workspace.programs.map((program) => [program.id, program]),
  );
  const now = new Date(workspace.generatedAt).getTime();
  const activePrograms = workspace.programs.filter(
    (program) => program.isActive,
  ).length;
  const overduePrograms = workspace.programs.filter(
    (program) =>
      program.isActive &&
      program.scheduleActive &&
      new Date(program.nextOccurrenceAt).getTime() < now,
  ).length;
  const completedServices = workspace.history.filter(
    (entry) => entry.workOrderStatus === "completed",
  ).length;
  const totalMaterialCostCents = workspace.history.reduce(
    (total, entry) =>
      total +
      entry.materials.reduce(
        (workOrderTotal, material) =>
          workOrderTotal +
          (material.unitCostCents == null
            ? 0
            : material.unitCostCents * material.quantity),
        0,
      ),
    0,
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Preventive maintenance</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 075 · Preventive operations</p>
          <h1>Preventive Maintenance Program</h1>
          <p className="hero-panel__lead">
            Reuse one service definition across campground facilities or
            equipment, bind it to the existing recurring scheduler, and review
            overdue work, parts and labour without creating a second work-order
            system.
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
                Open preventive maintenance
              </button>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/schedules?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Open recurring schedules
              </Link>
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
            eyebrow="Preventive status"
            title="Program summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 075</span>}
          />
          <div className={styles.metrics}>
            <div>
              <strong>{activePrograms}</strong>
              <span>Active programs</span>
            </div>
            <div>
              <strong>{overduePrograms}</strong>
              <span>Overdue preventive work</span>
            </div>
            <div>
              <strong>{completedServices}</strong>
              <span>Completed scheduled services</span>
            </div>
            <div>
              <strong>{formatMoney(totalMaterialCostCents)}</strong>
              <span>Recorded material cost</span>
            </div>
          </div>
          <p className={styles.boundary}>
            Build 067 owns service intervals and durable occurrence generation.
            Build 065 owns work-order completion, parts/materials and labour.
            Build 075 only binds those canonical authorities into a preventive
            program.
          </p>
        </section>

        {canConfigure ? (
          <section className="content-panel" aria-labelledby="template-heading">
            <SectionHeading
              eyebrow="Reusable service definition"
              title="Create service template"
              id="template-heading"
              helpTopic="shell.overview"
            />
            <form
              action={createPreventiveMaintenanceTemplateAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Template name</span>
                <input name="name" minLength={3} maxLength={160} required />
              </label>
              <label className={styles.field}>
                <span>Target asset class</span>
                <select name="targetAssetClass" defaultValue="either">
                  <option value="either">Facility or equipment</option>
                  <option value="facility">Facility</option>
                  <option value="equipment">Equipment</option>
                </select>
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Description</span>
                <textarea name="description" maxLength={4000} />
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Service instructions</span>
                <textarea
                  name="serviceInstructions"
                  minLength={3}
                  maxLength={8000}
                  placeholder={
                    "One service step per line, for example:\nInspect belt condition\nChange engine oil\nLubricate fittings"
                  }
                  required
                />
              </label>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Create service template
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="templates-heading">
          <SectionHeading
            eyebrow="Service definitions"
            title="Preventive templates"
            id="templates-heading"
            helpTopic="shell.overview"
          />
          {workspace.templates.length === 0 ? (
            <p className={styles.empty}>
              No preventive-maintenance templates have been created yet.
            </p>
          ) : (
            <div className={styles.templateGrid}>
              {workspace.templates.map((template) => (
                <article className={styles.templateCard} key={template.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {formatPreventiveAssetClass(template.targetAssetClass)}
                      </p>
                      <h3>{template.name}</h3>
                    </div>
                    <span className={styles.state}>
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {template.description ? <p>{template.description}</p> : null}
                  <ol className={styles.instructions}>
                    {preventiveInstructionSteps(
                      template.serviceInstructions,
                    ).map((step, index) => (
                      <li key={`${template.id}-${index}`}>{step}</li>
                    ))}
                  </ol>
                  {canConfigure ? (
                    <form action={setPreventiveMaintenanceTemplateActiveAction}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <input
                        type="hidden"
                        name="rowVersion"
                        value={template.rowVersion}
                      />
                      <input
                        type="hidden"
                        name="nextState"
                        value={template.isActive ? "inactive" : "active"}
                      />
                      <button className="primary-button" type="submit">
                        {template.isActive
                          ? "Deactivate template"
                          : "Activate template"}
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {canConfigure ? (
          <section className="content-panel" aria-labelledby="program-heading">
            <SectionHeading
              eyebrow="Asset service plan"
              title="Bind template to recurring schedule"
              id="program-heading"
              helpTopic="shell.overview"
            />
            <p className={styles.help}>
              The recurring schedule must already target the exact same
              canonical asset. Create or replace the service interval in Build
              067 first, then bind it here.
            </p>
            <form
              action={configurePreventiveMaintenanceProgramAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Facility or equipment</span>
                <select name="assetId" required defaultValue="">
                  <option value="">Choose asset</option>
                  {workspace.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} · {assetDetail(asset)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Service template</span>
                <select name="templateId" required defaultValue="">
                  <option value="">Choose template</option>
                  {workspace.templates
                    .filter((template) => template.isActive)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ·{" "}
                        {formatPreventiveAssetClass(template.targetAssetClass)}
                      </option>
                    ))}
                </select>
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Recurring maintenance schedule</span>
                <select name="maintenanceScheduleId" required defaultValue="">
                  <option value="">Choose asset-targeted schedule</option>
                  {workspace.schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.assetName} · {schedule.title} ·{" "}
                      {recurrenceLabel(schedule)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Program notes</span>
                <textarea name="notes" maxLength={2000} />
              </label>
              <label className={styles.checkbox}>
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked
                  aria-label="Create program active"
                />{" "}
                Active after creation
              </label>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Create preventive program
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="programs-heading">
          <SectionHeading
            eyebrow="Service plans"
            title="Preventive programs"
            id="programs-heading"
            helpTopic="shell.overview"
          />
          {workspace.programs.length === 0 ? (
            <p className={styles.empty}>
              No preventive-maintenance programs have been configured yet.
            </p>
          ) : (
            <div className={styles.programGrid}>
              {workspace.programs.map((program) => {
                const asset = assetById.get(program.assetId);
                const overdue =
                  program.isActive &&
                  program.scheduleActive &&
                  new Date(program.nextOccurrenceAt).getTime() < now;
                return (
                  <article className={styles.programCard} key={program.id}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {formatPreventiveAssetClass(program.assetClass)}
                        </p>
                        <h3>{program.assetName}</h3>
                      </div>
                      <span className={styles.state}>
                        {!program.isActive
                          ? "Inactive"
                          : overdue
                            ? "Overdue"
                            : program.scheduleActive
                              ? "Scheduled"
                              : "Schedule paused"}
                      </span>
                    </div>
                    <p>
                      <strong>{program.templateName}</strong>
                    </p>
                    <p>
                      Interval: <strong>{recurrenceLabel(program)}</strong> ·
                      Next service{" "}
                      <strong>
                        {formatDate(
                          program.nextOccurrenceAt,
                          workspace.campground.timezone,
                        )}
                      </strong>
                    </p>
                    {overdue ? (
                      <p className={styles.warning}>
                        Overdue preventive work: the canonical recurring
                        schedule is past its next occurrence.
                      </p>
                    ) : null}
                    {asset?.assetClass === "equipment" &&
                    asset.meterKind !== "none" ? (
                      <p>
                        Current {titleCase(asset.meterKind)}:{" "}
                        <strong>{asset.meterValue ?? "Not recorded"}</strong>
                      </p>
                    ) : null}
                    {program.notes ? <p>{program.notes}</p> : null}
                    <ol className={styles.instructions}>
                      {preventiveInstructionSteps(
                        program.serviceInstructions,
                      ).map((step, index) => (
                        <li key={`${program.id}-${index}`}>{step}</li>
                      ))}
                    </ol>
                    {canConfigure ? (
                      <form
                        action={setPreventiveMaintenanceProgramActiveAction}
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
                          name="rowVersion"
                          value={program.rowVersion}
                        />
                        <input
                          type="hidden"
                          name="nextState"
                          value={program.isActive ? "inactive" : "active"}
                        />
                        <button className="primary-button" type="submit">
                          {program.isActive
                            ? "Deactivate program"
                            : "Activate program"}
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="history-heading">
          <SectionHeading
            eyebrow="Canonical service evidence"
            title="Parts & labour history"
            id="history-heading"
            helpTopic="shell.overview"
          />
          <p className={styles.boundary}>
            Build 065 owns work-order completion and its append-only
            parts/material and labour evidence. Build 075 reads that history
            through the Build 067 schedule occurrence instead of maintaining a
            second service ledger.
          </p>
          {workspace.history.length === 0 ? (
            <p className={styles.empty}>
              No preventive schedule occurrences have been recorded yet.
            </p>
          ) : (
            <div className={styles.history}>
              {workspace.history.map((entry) => {
                const program = programById.get(entry.programId);
                const labourMinutes = entry.labor.reduce(
                  (total, labour) => total + labour.minutes,
                  0,
                );
                const materialCostCents = entry.materials.reduce(
                  (total, material) =>
                    total +
                    (material.unitCostCents == null
                      ? 0
                      : material.unitCostCents * material.quantity),
                  0,
                );
                return (
                  <article
                    className={styles.historyRow}
                    key={entry.occurrenceId}
                  >
                    <div>
                      <strong>
                        {program?.assetName ?? "Preventive maintenance"}
                      </strong>
                      <p>
                        {program?.templateName ?? "Service"} ·{" "}
                        {titleCase(entry.occurrenceState)}
                      </p>
                      {entry.workOrderTitle ? (
                        <p>{entry.workOrderTitle}</p>
                      ) : null}
                      {entry.completionSummary ? (
                        <p>{entry.completionSummary}</p>
                      ) : null}
                      {entry.materials.length > 0 ? (
                        <div className={styles.parts}>
                          <strong>Parts/materials</strong>
                          {entry.materials.map((material, index) => (
                            <span
                              key={`${entry.occurrenceId}-material-${index}`}
                            >
                              {material.itemName}: {material.quantity}{" "}
                              {material.unit}
                              {material.unitCostCents == null
                                ? ""
                                : ` @ ${formatMoney(material.unitCostCents)}`}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.historyMeta}>
                      <span className={styles.state}>
                        {entry.workOrderStatus
                          ? titleCase(entry.workOrderStatus)
                          : titleCase(entry.occurrenceState)}
                      </span>
                      <p>
                        Scheduled{" "}
                        {formatDate(
                          entry.scheduledFor,
                          workspace.campground.timezone,
                        )}
                      </p>
                      <p>{labourMinutes} labour minutes</p>
                      <p>{formatMoney(materialCostCents)} materials</p>
                    </div>
                  </article>
                );
              })}
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
            sectionKey="workspace.maintenance.preventive-maintenance"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Channel & operational boundary"
            title="One preventive-maintenance authority"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA provides the full visual template, program, due-date,
            parts/material and labour workflow. Verified IVR/DTMF or SMS/MMS
            flows may provide concise next-service, overdue and open-work facts
            from the same canonical records, with secure Web/PWA handoff for
            configuration and detailed evidence. iCamp records maintenance
            planning and evidence; it does not replace manufacturer service
            instructions, licensed-trade requirements or workplace-safety
            procedures.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
