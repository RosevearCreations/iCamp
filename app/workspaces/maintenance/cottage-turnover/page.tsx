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
import { getCottageHousekeepingTurnoverWorkspace } from "@/lib/cottage-turnover-operations/postgres.mjs";

import {
  configureCottageTurnoverFinalInspectionAction,
  releaseCottageTurnoverAction,
  startCottageTurnoverFinalInspectionAction,
} from "./actions";
import styles from "./cottage-turnover.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cottage housekeeping & turnover · iCamp",
  description:
    "Rental-cottage housekeeping, linen and inventory readiness, final inspection, corrective work and release.",
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

function sentence(value: string | null) {
  if (!value) return "Not started";
  return value.replaceAll("_", " ");
}

export default async function CottageHousekeepingTurnoverPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const path = "/workspaces/maintenance/cottage-turnover";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const readPermissions = [
    "accommodation.read",
    "accommodation.manage",
    "maintenance.read",
    "maintenance.complete",
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

  const workspace = await getCottageHousekeepingTurnoverWorkspace(
    session.user.id,
    selected.campgroundId,
  );

  const [canManageAccommodation, canPerformInspection] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "accommodation.manage",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "inspection.perform",
    ),
  ]);

  const openTurnovers = workspace.turnovers.filter(
    (turnover) =>
      turnover.releaseRequired &&
      !turnover.releasedAt &&
      turnover.status !== "cancelled",
  );
  const configurationRequired = openTurnovers.filter(
    (turnover) => !turnover.finalInspectionTemplateId,
  ).length;
  const correctiveWorkOpen = openTurnovers.filter(
    (turnover) => turnover.openCorrectiveWorkOrders > 0,
  ).length;
  const readyToRelease = openTurnovers.filter(
    (turnover) =>
      turnover.inspectionStatus === "signed_off" &&
      turnover.openCorrectiveWorkOrders === 0 &&
      turnover.requiredItems === turnover.checkedRequiredItems &&
      turnover.checklistIssues === 0 &&
      turnover.housekeepingInspectionResult === "pass",
  ).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Cottage housekeeping &amp; turnover</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 074 · Cottage operations</p>
          <h1>Cottage Housekeeping &amp; Turnover</h1>
          <p className="hero-panel__lead">
            Carry the existing Build 027 cleaning, linen, inventory and damage
            workflow through Build 068 final inspection and sign-off. Failed
            inspection items stay in Build 065 corrective work orders, and the
            cottage returns to canonical availability only after release.
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
            helpTopic="cottage.housekeeping"
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
                Open cottage turnover
              </button>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/management/campgrounds/accommodations"
              >
                Open Build 027 housekeeping
              </Link>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Release readiness"
            title="Cottage turnover queue"
            id="summary-heading"
            helpTopic="cottage.housekeeping"
            trailing={<span className="build-chip">Build 074</span>}
          />
          <div className={styles.metrics}>
            <div>
              <strong>{openTurnovers.length}</strong>
              <span>Open turnovers</span>
            </div>
            <div>
              <strong>{configurationRequired}</strong>
              <span>Need final inspection</span>
            </div>
            <div>
              <strong>{correctiveWorkOpen}</strong>
              <span>With corrective work</span>
            </div>
            <div>
              <strong>{readyToRelease}</strong>
              <span>Ready to release</span>
            </div>
          </div>
          <p className={styles.boundary}>
            Checkout keeps a rental cottage in canonical <code>inspection</code>{" "}
            state. Build 074 does not create a second availability flag: the
            cottage may return to <code>available</code> only after the
            authoritative turnover is released.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="config-heading">
          <SectionHeading
            eyebrow="Final inspection configuration"
            title="Bind housekeeping to a cottage inspection"
            id="config-heading"
            helpTopic="cottage.housekeeping"
          />
          <div className={styles.grid}>
            {workspace.housekeepingTemplates
              .filter(
                (template) =>
                  template.turnoverType === "departure" && template.isActive,
              )
              .map((template) => {
                const inspections = workspace.inspectionTemplates.filter(
                  (inspection) =>
                    inspection.accommodationId === template.accommodationId &&
                    inspection.isActive,
                );

                return (
                  <article className={styles.card} key={template.id}>
                    <header className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {template.cottageCode} · departure housekeeping
                        </p>
                        <h3>
                          {template.cottageName} · {template.name}
                        </h3>
                      </div>
                      <span className={styles.state}>
                        {template.finalInspectionTemplateName
                          ? "Configured"
                          : "Configuration required"}
                      </span>
                    </header>

                    {template.finalInspectionTemplateName ? (
                      <p>
                        Final inspection:{" "}
                        <strong>{template.finalInspectionTemplateName}</strong>
                        {template.finalInspectionVersionNumber
                          ? ` · v${template.finalInspectionVersionNumber}`
                          : ""}
                        {template.finalInspectionSignoffRequired
                          ? " · sign-off required"
                          : " · self-finalizing"}
                      </p>
                    ) : null}

                    {canManageAccommodation && inspections.length > 0 ? (
                      <form
                        action={configureCottageTurnoverFinalInspectionAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="housekeepingTemplateId"
                          value={template.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={template.rowVersion}
                        />
                        <label className={styles.field}>
                          <span>Final cottage inspection</span>
                          <select
                            name="inspectionTemplateId"
                            defaultValue={
                              template.finalInspectionTemplateId ??
                              inspections[0]?.id
                            }
                            required
                          >
                            {inspections.map((inspection) => (
                              <option key={inspection.id} value={inspection.id}>
                                {inspection.name} · v{inspection.versionNumber}
                                {inspection.signoffRequired
                                  ? " · sign-off"
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            {template.finalInspectionTemplateId
                              ? "Update final inspection"
                              : "Configure final inspection"}
                          </button>
                        </div>
                      </form>
                    ) : inspections.length === 0 ? (
                      <p className={styles.warning}>
                        Create and publish a Build 068 cottage inspection
                        template for this cottage before configuring final
                        release inspection.
                      </p>
                    ) : (
                      <p className={styles.help}>
                        accommodation.manage permission is required to change
                        turnover inspection configuration.
                      </p>
                    )}
                  </article>
                );
              })}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="queue-heading">
          <SectionHeading
            eyebrow="Operational queue"
            title="Housekeeping, inspection & release"
            id="queue-heading"
            helpTopic="cottage.housekeeping"
          />
          <div className={styles.turnoverList}>
            {workspace.turnovers.length === 0 ? (
              <p className={styles.empty}>
                No cottage turnover records are present for this campground.
              </p>
            ) : (
              workspace.turnovers.map((turnover) => {
                const checklistReady =
                  turnover.requiredItems === turnover.checkedRequiredItems &&
                  turnover.checklistIssues === 0;
                const housekeepingReady =
                  turnover.housekeepingInspectionResult === "pass" &&
                  turnover.linenComplete &&
                  turnover.housekeepingComplete &&
                  turnover.inventoryComplete &&
                  !turnover.damageFound &&
                  !turnover.securityIssueFound;
                const inspectionClear =
                  turnover.inspectionStatus === "signed_off" &&
                  turnover.openCorrectiveWorkOrders === 0;
                const canStart =
                  canPerformInspection &&
                  turnover.releaseRequired &&
                  !turnover.releasedAt &&
                  turnover.status !== "cancelled" &&
                  Boolean(turnover.finalInspectionTemplateId) &&
                  checklistReady &&
                  housekeepingReady &&
                  (!turnover.inspectionOccurrenceId ||
                    turnover.inspectionStatus === "rejected");
                const canRelease =
                  canManageAccommodation &&
                  turnover.releaseRequired &&
                  !turnover.releasedAt &&
                  checklistReady &&
                  housekeepingReady &&
                  inspectionClear;

                return (
                  <article className={styles.turnoverCard} key={turnover.id}>
                    <header className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {turnover.cottageCode} ·{" "}
                          {turnover.housekeepingTemplateName}
                        </p>
                        <h3>{turnover.cottageName}</h3>
                      </div>
                      <span className={styles.state}>
                        {!turnover.releaseRequired
                          ? "Legacy complete"
                          : turnover.releasedAt
                            ? "Released"
                            : sentence(turnover.status)}
                      </span>
                    </header>

                    <div className={styles.facts}>
                      <div>
                        <span>Inventory checklist</span>
                        <strong>
                          {turnover.checkedRequiredItems}/
                          {turnover.requiredItems} required
                        </strong>
                        <small>
                          {turnover.checklistIssues} issue
                          {turnover.checklistIssues === 1 ? "" : "s"}
                        </small>
                      </div>
                      <div>
                        <span>Housekeeping readiness</span>
                        <strong>
                          {turnover.housekeepingInspectionResult === "pass"
                            ? "Passed"
                            : turnover.housekeepingInspectionResult
                              ? "Follow-up required"
                              : "Not inspected"}
                        </strong>
                        <small>
                          Linen {turnover.linenComplete ? "✓" : "—"} · clean{" "}
                          {turnover.housekeepingComplete ? "✓" : "—"} ·
                          inventory {turnover.inventoryComplete ? "✓" : "—"}
                        </small>
                      </div>
                      <div>
                        <span>Final inspection</span>
                        <strong>{sentence(turnover.inspectionStatus)}</strong>
                        <small>
                          {turnover.inspectionTemplateName
                            ? `${turnover.inspectionTemplateName} · v${turnover.inspectionVersionNumber}`
                            : "No final inspection started"}
                        </small>
                      </div>
                      <div>
                        <span>Corrective work</span>
                        <strong>
                          {turnover.openCorrectiveWorkOrders} open
                        </strong>
                        <small>
                          {turnover.correctiveWorkOrders} linked total
                        </small>
                      </div>
                      <div>
                        <span>Accommodation state</span>
                        <strong>{turnover.accommodationStatusState}</strong>
                        <small>
                          Release:{" "}
                          {turnover.releasedAt
                            ? formatDate(
                                turnover.releasedAt,
                                workspace.campground.timezone,
                              )
                            : "pending"}
                        </small>
                      </div>
                    </div>

                    {!turnover.finalInspectionTemplateId &&
                    !turnover.releasedAt ? (
                      <p className={styles.warning}>
                        Configure the Build 068 final cottage inspection on the
                        departure housekeeping template above.
                      </p>
                    ) : null}

                    {!checklistReady && !turnover.releasedAt ? (
                      <p className={styles.warning}>
                        Finish the Build 027 linen/inventory checklist and
                        resolve all checklist issues before final inspection.
                      </p>
                    ) : null}

                    {checklistReady &&
                    !housekeepingReady &&
                    !turnover.releasedAt ? (
                      <p className={styles.warning}>
                        Record a passing Build 027 housekeeping/damage readiness
                        inspection before final inspection.
                      </p>
                    ) : null}

                    {turnover.inspectionStatus === "signed_off" &&
                    turnover.openCorrectiveWorkOrders > 0 ? (
                      <p className={styles.warning}>
                        Final inspection is signed off, but linked Build 065
                        corrective work must be completed or cancelled before
                        release.
                      </p>
                    ) : null}

                    <div className={styles.actions}>
                      {canStart ? (
                        <form
                          action={startCottageTurnoverFinalInspectionAction}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="turnoverId"
                            value={turnover.id}
                          />
                          <button className="primary-button" type="submit">
                            Start final cottage inspection
                          </button>
                        </form>
                      ) : null}

                      {canRelease ? (
                        <form action={releaseCottageTurnoverAction}>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="turnoverId"
                            value={turnover.id}
                          />
                          <input
                            type="hidden"
                            name="rowVersion"
                            value={turnover.rowVersion}
                          />
                          <button className="primary-button" type="submit">
                            Release cottage to availability
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="authority-heading">
          <SectionHeading
            eyebrow="Canonical authority"
            title="No duplicate operational systems"
            id="authority-heading"
            helpTopic="cottage.housekeeping"
          />
          <p className={styles.boundary}>
            Build 027 remains the cleaning, linen, inventory and initial damage
            readiness authority. Build 068 owns the versioned final inspection
            checklist and sign-off. Failed final-inspection items become Build
            065 maintenance work orders. Build 030 remains the only
            accommodation status and booking-availability authority.
          </p>
          <div className={styles.linkRow}>
            <Link
              className="primary-link primary-link--dark"
              href="/workspaces/management/campgrounds/accommodations"
            >
              Open cottage housekeeping
            </Link>
            <Link
              className="primary-link primary-link--dark"
              href="/workspaces/maintenance/inspections"
            >
              Open inspections
            </Link>
            <Link
              className="primary-link primary-link--dark"
              href="/workspaces/maintenance/work-orders"
            >
              Open corrective work
            </Link>
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
            <strong>Web/PWA:</strong> full linen, inventory, housekeeping,
            damage, visual inspection and release workflow.{" "}
            <strong>IVR/DTMF:</strong> verified staff may hear concise turnover,
            inspection and release status, with visual decisions handed to the
            secure Web/PWA. <strong>SMS/MMS:</strong> verified staff may receive
            concise status and a secure-link handoff; photos, detailed damage
            evidence and sign-off remain in the authenticated Web/PWA workflow.
          </p>
        </section>

        <AdminRefreshControl
          renderedAt={workspace.generatedAt}
          sectionKey="maintenance.cottage-housekeeping-turnover"
        />
      </div>
    </AppShell>
  );
}
