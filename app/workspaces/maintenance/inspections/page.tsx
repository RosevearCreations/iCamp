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
import { requireStaff } from "@/lib/auth/current-session";
import {
  formatInspectionStatus,
  formatInspectionTargetKind,
} from "@/lib/inspections/core.mjs";
import { getInspectionWorkspace } from "@/lib/inspections/postgres.mjs";

import {
  createInspectionTemplateAction,
  publishInspectionTemplateVersionAction,
  recordInspectionResultAction,
  setInspectionTemplateActiveAction,
  signOffInspectionAction,
  startInspectionAction,
  submitInspectionAction,
} from "./actions";
import styles from "./inspections.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inspection templates & sign-off · iCamp",
  description:
    "Versioned campground inspection checklists, execution, corrective work and independent sign-off.",
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

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function resultFor(
  occurrence: Awaited<
    ReturnType<typeof getInspectionWorkspace>
  >["occurrences"][number],
  itemId: string,
) {
  return occurrence.results.find((result) => result.templateItemId === itemId);
}

export default async function InspectionWorkspacePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const path = "/workspaces/maintenance/inspections";
  const session = await requireStaff(path);
  const assigned = await listAssignedCampgrounds(session.user.id);
  const checked = await Promise.all(
    assigned.map(async (campground) => {
      const permissions = await Promise.all(
        [
          "inspection.perform",
          "inspection.signoff",
          "inspection.template.manage",
        ].map((permission) =>
          hasCampgroundPermission(
            session.user.id,
            campground.campgroundId,
            permission,
          ),
        ),
      );
      return {
        campground,
        allowed: permissions.some(Boolean),
      };
    }),
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

  const workspace = await getInspectionWorkspace(
    session.user.id,
    selected.campgroundId,
  );
  const [canManageTemplates, canPerform, canSignoff] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.template.manage",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.perform",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.signoff",
    ),
  ]);

  const inProgress = workspace.occurrences.filter(
    (occurrence) => occurrence.status === "in_progress",
  );
  const awaitingSignoff = workspace.occurrences.filter(
    (occurrence) => occurrence.status === "submitted",
  );
  const failedResults = workspace.occurrences.flatMap((occurrence) =>
    occurrence.results.filter((result) => result.resultValue === "fail"),
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Inspections</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 068 · Inspection governance</p>
          <h1>Versioned Inspection Templates & Sign-Off</h1>
          <p className="hero-panel__lead">
            Publish immutable checklist versions, execute inspections against
            assets/sites/cottages, create corrective maintenance from failures,
            and require independent sign-off where configured.
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
                Open inspections
              </button>
              <Link
                className="primary-link primary-link--dark"
                href={
                  "/workspaces/maintenance/work-orders?campground=" +
                  encodeURIComponent(selected.campgroundId)
                }
              >
                Open work orders
              </Link>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Inspection status"
            title="Inspection summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 068</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Active templates</span>
              <strong>
                {
                  workspace.templates.filter((template) => template.isActive)
                    .length
                }
              </strong>
            </div>
            <div>
              <span>In progress</span>
              <strong>{inProgress.length}</strong>
            </div>
            <div>
              <span>Awaiting sign-off</span>
              <strong>{awaitingSignoff.length}</strong>
            </div>
            <div>
              <span>Failed checklist results</span>
              <strong>{failedResults.length}</strong>
            </div>
          </div>
        </section>

        {canManageTemplates ? (
          <section className="content-panel" aria-labelledby="create-heading">
            <SectionHeading
              eyebrow="Template authority"
              title="Create inspection template"
              id="create-heading"
              helpTopic="shell.overview"
            />
            <form
              action={createInspectionTemplateAction}
              className="page-stack"
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Template name</span>
                  <input name="name" minLength={3} maxLength={160} required />
                </label>
                <label className={styles.field}>
                  <span>Target kind</span>
                  <select name="targetKind" defaultValue="asset">
                    <option value="asset">Operational asset</option>
                    <option value="site">Campsite</option>
                    <option value="cottage">Rental cottage</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Asset target</span>
                  <select name="assetId" defaultValue="">
                    <option value="">No asset</option>
                    {workspace.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Site/cottage target</span>
                  <select name="accommodationId" defaultValue="">
                    <option value="">No accommodation</option>
                    <optgroup label="Campsites">
                      {workspace.sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.code} · {site.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Rental cottages">
                      {workspace.cottages.map((cottage) => (
                        <option key={cottage.id} value={cottage.id}>
                          {cottage.code} · {cottage.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className={styles.field + " " + styles.full}>
                  <span>Template description</span>
                  <textarea name="description" maxLength={2000} />
                </label>
                <label className={styles.field + " " + styles.full}>
                  <span>Version 1 instructions</span>
                  <textarea name="versionInstructions" maxLength={4000} />
                </label>
                <label className={styles.field}>
                  <span>Corrective-work category</span>
                  <select name="failureCategoryId" required>
                    {workspace.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Corrective-work priority</span>
                  <select name="failurePriorityPolicyId" required>
                    {workspace.priorities.map((priority) => (
                      <option key={priority.id} value={priority.id}>
                        {titleCase(priority.priorityKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field + " " + styles.full}>
                  <span>Checklist items — one per line</span>
                  <textarea
                    name="itemsText"
                    minLength={1}
                    required
                    placeholder={
                      "Check enclosure condition\nCheck electrical connection\nCheck safety signage"
                    }
                  />
                </label>
                <label>
                  <input
                    name="signoffRequired"
                    type="checkbox"
                    defaultChecked
                  />{" "}
                  Require independent sign-off
                </label>
              </div>
              <p className={styles.help}>
                Choose exactly one target matching the selected kind. Published
                versions are immutable; later changes create a new version.
                Failed checklist items create Build 065 corrective work orders
                using the selected category and priority.
              </p>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Create template & publish version 1
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="templates-heading">
          <SectionHeading
            eyebrow="Versioned definitions"
            title="Inspection templates"
            id="templates-heading"
            helpTopic="shell.overview"
          />
          {workspace.templates.length === 0 ? (
            <p className={styles.empty}>
              No inspection templates have been created yet.
            </p>
          ) : (
            <div className={styles.grid}>
              {workspace.templates.map((template) => (
                <article className={styles.templateCard} key={template.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {formatInspectionTargetKind(template.targetKind)} ·{" "}
                        {template.targetLabel}
                      </p>
                      <h3>{template.name}</h3>
                    </div>
                    <span className={styles.state}>
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {template.description ? <p>{template.description}</p> : null}
                  <p>
                    Current version:{" "}
                    <strong>
                      {template.currentVersion
                        ? "v" + template.currentVersion.versionNumber
                        : "None"}
                    </strong>{" "}
                    · {template.currentVersion?.items.length ?? 0} items ·{" "}
                    {template.currentVersion?.signoffRequired
                      ? "independent sign-off required"
                      : "inspector finalizes"}
                  </p>

                  {canPerform && template.isActive ? (
                    <form action={startInspectionAction}>
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
                      <button className="primary-button" type="submit">
                        Start inspection
                      </button>
                    </form>
                  ) : null}

                  {canManageTemplates ? (
                    <>
                      <form action={setInspectionTemplateActiveAction}>
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
                          name="isActive"
                          value={template.isActive ? "false" : "true"}
                        />
                        <button className="primary-button" type="submit">
                          {template.isActive ? "Deactivate" : "Activate"}{" "}
                          template
                        </button>
                      </form>

                      <form
                        action={publishInspectionTemplateVersionAction}
                        className={styles.versionCard}
                      >
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
                        <strong>Publish next immutable version</strong>
                        <label className={styles.field}>
                          <span>Version instructions</span>
                          <textarea
                            name="versionInstructions"
                            maxLength={4000}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Corrective-work category</span>
                          <select name="failureCategoryId" required>
                            {workspace.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Corrective-work priority</span>
                          <select name="failurePriorityPolicyId" required>
                            {workspace.priorities.map((priority) => (
                              <option key={priority.id} value={priority.id}>
                                {titleCase(priority.priorityKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Checklist items — one per line</span>
                          <textarea name="itemsText" required />
                        </label>
                        <label>
                          <input
                            name="signoffRequired"
                            type="checkbox"
                            defaultChecked={
                              template.currentVersion?.signoffRequired ?? true
                            }
                          />{" "}
                          Require independent sign-off
                        </label>
                        <button className="primary-button" type="submit">
                          Publish new version
                        </button>
                      </form>
                    </>
                  ) : null}

                  <div className={styles.versionHistory}>
                    <strong>Version history</strong>
                    <ul className={styles.historyList}>
                      {template.versions.map((version) => (
                        <li key={version.id}>
                          v{version.versionNumber} · {version.items.length}{" "}
                          items ·{" "}
                          {version.signoffRequired
                            ? "sign-off required"
                            : "inspector finalizes"}{" "}
                          · corrective{" "}
                          {version.failureCategoryName ?? "category"}/
                          {titleCase(version.failurePriorityKey ?? "priority")}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          className="content-panel"
          aria-labelledby="occurrences-heading"
        >
          <SectionHeading
            eyebrow="Inspection execution"
            title="Inspection occurrences"
            id="occurrences-heading"
            helpTopic="shell.overview"
          />
          {workspace.occurrences.length === 0 ? (
            <p className={styles.empty}>
              No inspections have been started yet.
            </p>
          ) : (
            <div className={styles.occurrences}>
              {workspace.occurrences.map((occurrence) => {
                const editable =
                  canPerform &&
                  occurrence.status === "in_progress" &&
                  occurrence.inspectorUserId === session.user.id;
                const items = occurrence.version?.items ?? [];

                return (
                  <article
                    className={styles.occurrenceCard}
                    key={occurrence.id}
                  >
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {formatInspectionTargetKind(occurrence.targetKind)} ·{" "}
                          {occurrence.targetLabel}
                        </p>
                        <h3>
                          {occurrence.templateName} v{occurrence.versionNumber}
                        </h3>
                      </div>
                      <span className={styles.state}>
                        {formatInspectionStatus(occurrence.status)}
                      </span>
                    </div>
                    <p>
                      Started{" "}
                      {formatDate(
                        occurrence.startedAt,
                        workspace.campground.timezone,
                      )}
                      .{" "}
                      {occurrence.signoffRequired
                        ? "Independent sign-off required."
                        : "Inspector submission finalizes this inspection."}
                    </p>

                    <div className={styles.items}>
                      {items.map((item) => {
                        const result = resultFor(occurrence, item.id);
                        return (
                          <article className={styles.itemCard} key={item.id}>
                            <strong>
                              {item.position}. {item.label}
                            </strong>
                            {editable ? (
                              <form
                                action={recordInspectionResultAction}
                                className={styles.itemResult}
                              >
                                <input
                                  type="hidden"
                                  name="campgroundId"
                                  value={selected.campgroundId}
                                />
                                <input
                                  type="hidden"
                                  name="occurrenceId"
                                  value={occurrence.id}
                                />
                                <input
                                  type="hidden"
                                  name="templateItemId"
                                  value={item.id}
                                />
                                <label className={styles.field}>
                                  <span>Result</span>
                                  <select
                                    name="resultValue"
                                    defaultValue={result?.resultValue ?? "pass"}
                                  >
                                    <option value="pass">Pass</option>
                                    <option value="fail">Fail</option>
                                    <option value="not_applicable">
                                      Not applicable
                                    </option>
                                  </select>
                                </label>
                                <label className={styles.field}>
                                  <span>Note</span>
                                  <input
                                    name="note"
                                    maxLength={2000}
                                    defaultValue={result?.note ?? ""}
                                  />
                                </label>
                                <div className={styles.actions}>
                                  <button
                                    className="primary-button"
                                    type="submit"
                                  >
                                    Save result
                                  </button>
                                </div>
                              </form>
                            ) : result ? (
                              <div>
                                <p>
                                  Result:{" "}
                                  <strong>
                                    {titleCase(result.resultValue)}
                                  </strong>
                                </p>
                                {result.note ? <p>{result.note}</p> : null}
                                {result.correctiveAction ? (
                                  <p className={styles.corrective}>
                                    Corrective work order created.
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <p className={styles.empty}>
                                No result recorded.
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>

                    {editable ? (
                      <form action={submitInspectionAction}>
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="occurrenceId"
                          value={occurrence.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={occurrence.rowVersion}
                        />
                        <button className="primary-button" type="submit">
                          Submit inspection
                        </button>
                      </form>
                    ) : null}

                    {occurrence.status === "submitted" &&
                    canSignoff &&
                    occurrence.inspectorUserId !== session.user.id ? (
                      <form
                        action={signOffInspectionAction}
                        className={styles.signoffCard}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="occurrenceId"
                          value={occurrence.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={occurrence.rowVersion}
                        />
                        <strong>Independent sign-off</strong>
                        <label className={styles.field}>
                          <span>Decision</span>
                          <select name="decision" defaultValue="approved">
                            <option value="approved">Approve</option>
                            <option value="rejected">Reject</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Sign-off / rejection note</span>
                          <textarea name="note" maxLength={2000} />
                        </label>
                        <button className="primary-button" type="submit">
                          Record sign-off
                        </button>
                      </form>
                    ) : null}

                    {occurrence.signoff ? (
                      <p>
                        Sign-off:{" "}
                        <strong>
                          {titleCase(occurrence.signoff.decision)}
                        </strong>
                        {" · "}
                        {formatDate(
                          occurrence.signoff.signedAt,
                          workspace.campground.timezone,
                        )}
                        {occurrence.signoff.note
                          ? " · " + occurrence.signoff.note
                          : ""}
                      </p>
                    ) : null}
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
            sectionKey="workspace.maintenance.inspections"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Omnichannel & visual boundary"
            title="Structured inspection parity"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA provides full template/version management, checklist review,
            corrective-work visibility and sign-off. Guided IVR/DTMF and SMS may
            complete structured checklist answers or report a defect through the
            same permission-checked inspection commands, while template editing,
            long evidence and independent sign-off review use a secure link or
            staff-assisted handoff. Future graphical/style work is separately
            governed by the standard multi-theme token ruleset now recorded in
            the roadmap; inspection business markup must remain
            theme-independent.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
