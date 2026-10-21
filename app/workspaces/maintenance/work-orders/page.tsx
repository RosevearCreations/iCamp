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
import { formatMaintenanceStatus } from "@/lib/maintenance-work-orders/core.mjs";
import { getMaintenanceWorkOrderBoard } from "@/lib/maintenance-work-orders/postgres.mjs";

import {
  addMaintenanceWorkOrderLaborAction,
  addMaintenanceWorkOrderMaterialAction,
  addMaintenanceWorkOrderNoteAction,
  assignMaintenanceWorkOrderAction,
  attachMaintenanceWorkOrderMediaAction,
  createMaintenanceWorkOrderAction,
  transitionMaintenanceWorkOrderAction,
} from "./actions";
import styles from "./work-orders.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintenance work orders · iCamp",
  description:
    "Create, assign, execute and complete campground maintenance work orders.",
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

function locationLabel(workOrder: {
  sectionName: string | null;
  assetName: string | null;
  accommodationName: string | null;
  locationDescription: string | null;
}) {
  return [
    workOrder.sectionName,
    workOrder.assetName,
    workOrder.accommodationName,
    workOrder.locationDescription,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function MaintenanceWorkOrdersPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const path = "/workspaces/maintenance/work-orders";
  const session = await requireAnyCampgroundPermission(
    "maintenance.read",
    path,
  );
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = await Promise.all(
    assigned.map(async (campground) => ({
      campground,
      allowed: await hasCampgroundPermission(
        session.user.id,
        campground.campgroundId,
        "maintenance.read",
      ),
    })),
  );
  const authorized = allowed
    .filter((entry) => entry.allowed)
    .map((entry) => entry.campground);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find(
      (campground) => campground.campgroundId === params.campground,
    ) ?? authorized[0];
  const board = await getMaintenanceWorkOrderBoard(
    session.user.id,
    selected.campgroundId,
  );
  const [canCreate, canAssign, canComplete] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.create",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.assign",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.complete",
    ),
  ]);
  const canAddEvidence = canCreate || canAssign || canComplete;
  const activeOrders = board.workOrders.filter(
    (workOrder) =>
      workOrder.status !== "completed" && workOrder.status !== "cancelled",
  );
  const overdueOrders = activeOrders.filter(
    (workOrder) => workOrder.isPastCompletionTarget,
  );
  const highPriorityOrders = activeOrders.filter((workOrder) =>
    ["emergency", "urgent"].includes(workOrder.priorityKey),
  );
  const completedOrders = board.workOrders.filter(
    (workOrder) => workOrder.status === "completed",
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Work orders</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 065 · Work Order Engine</p>
          <h1>Maintenance work orders</h1>
          <p className="hero-panel__lead">
            Create one canonical maintenance record, route it to active staff,
            capture work evidence, and preserve its complete status history.
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
            <button className="primary-button" type="submit">
              Open work-order board
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Operational queue"
            title="Work-order summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 065</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Active work orders</span>
              <strong>{activeOrders.length}</strong>
            </div>
            <div>
              <span>Past completion target</span>
              <strong>{overdueOrders.length}</strong>
            </div>
            <div>
              <span>Emergency / urgent</span>
              <strong>{highPriorityOrders.length}</strong>
            </div>
            <div>
              <span>Completed</span>
              <strong>{completedOrders.length}</strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Response and completion timestamps come from the campground&apos;s
            Build 064 priority targets. They are operating targets, not
            emergency-service guarantees.
          </p>
        </section>

        {canCreate ? (
          <section className="content-panel" aria-labelledby="create-heading">
            <SectionHeading
              eyebrow="New work"
              title="Create maintenance work order"
              id="create-heading"
              helpTopic="shell.overview"
            />
            <form
              action={createMaintenanceWorkOrderAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Title</span>
                <input name="title" minLength={3} maxLength={160} required />
              </label>
              <label className={styles.field}>
                <span>Category</span>
                <select name="categoryId" required defaultValue="">
                  <option value="" disabled>
                    Choose category
                  </option>
                  {board.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Priority</span>
                <select name="priorityPolicyId" required defaultValue="">
                  <option value="" disabled>
                    Choose priority
                  </option>
                  {board.priorities.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {titleCase(priority.priorityKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Section (optional)</span>
                <select name="sectionId" defaultValue="">
                  <option value="">No section selected</option>
                  {board.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Operational asset (optional)</span>
                <select name="assetId" defaultValue="">
                  <option value="">No asset selected</option>
                  {board.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Accommodation (optional)</span>
                <select name="accommodationId" defaultValue="">
                  <option value="">No accommodation selected</option>
                  {board.accommodations.map((accommodation) => (
                    <option key={accommodation.id} value={accommodation.id}>
                      {accommodation.code} · {accommodation.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Location description (optional)</span>
                <input
                  name="locationDescription"
                  maxLength={240}
                  placeholder="North washroom mechanical room"
                />
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Description</span>
                <textarea name="description" maxLength={4000} />
              </label>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Create work order
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="orders-heading">
          <SectionHeading
            eyebrow="Execution"
            title="Maintenance work-order board"
            id="orders-heading"
            helpTopic="shell.overview"
          />
          {board.workOrders.length === 0 ? (
            <p className={styles.empty}>
              No maintenance work orders have been created for this campground.
            </p>
          ) : (
            <div className={styles.grid}>
              {board.workOrders.map((workOrder) => {
                const closed = ["completed", "cancelled"].includes(
                  workOrder.status,
                );
                const overdue = workOrder.isPastCompletionTarget;
                return (
                  <article className={styles.card} key={workOrder.id}>
                    <header>
                      <div>
                        <p className={styles.kicker}>
                          {titleCase(workOrder.priorityKey)} ·{" "}
                          {workOrder.categoryName}
                        </p>
                        <h3>{workOrder.title}</h3>
                      </div>
                      <span className={styles.state}>
                        {formatMaintenanceStatus(workOrder.status)}
                      </span>
                    </header>

                    {workOrder.description ? (
                      <p>{workOrder.description}</p>
                    ) : null}

                    <div className={styles.details}>
                      <div>
                        <span>Location / target</span>
                        <strong>{locationLabel(workOrder)}</strong>
                      </div>
                      <div>
                        <span>Assigned to</span>
                        <strong>
                          {workOrder.assignedToLabel ?? "Unassigned"}
                        </strong>
                      </div>
                      <div>
                        <span>Response target</span>
                        <strong>
                          {formatDate(
                            workOrder.responseDueAt,
                            board.campground.timezone,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>Completion target</span>
                        <strong className={overdue ? styles.due : undefined}>
                          {formatDate(
                            workOrder.completionDueAt,
                            board.campground.timezone,
                          )}
                          {overdue ? " · past target" : ""}
                        </strong>
                      </div>
                    </div>

                    {!closed && canAssign ? (
                      <form
                        action={assignMaintenanceWorkOrderAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="workOrderId"
                          value={workOrder.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={workOrder.rowVersion}
                        />
                        <label className={styles.field}>
                          <span>Assignment</span>
                          <select
                            name="assignedToUserId"
                            defaultValue={workOrder.assignedToUserId ?? ""}
                          >
                            <option value="">Unassigned</option>
                            {board.staff.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Save assignment
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {!closed && canAssign ? (
                      <div className={styles.actionRow}>
                        {workOrder.status === "assigned" ||
                        workOrder.status === "blocked" ||
                        workOrder.status === "open" ? (
                          <form action={transitionMaintenanceWorkOrderAction}>
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="workOrderId"
                              value={workOrder.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={workOrder.rowVersion}
                            />
                            <input
                              type="hidden"
                              name="toStatus"
                              value="in_progress"
                            />
                            <button className="primary-button" type="submit">
                              Start work
                            </button>
                          </form>
                        ) : null}
                        {workOrder.status === "in_progress" ||
                        workOrder.status === "assigned" ? (
                          <form action={transitionMaintenanceWorkOrderAction}>
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="workOrderId"
                              value={workOrder.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={workOrder.rowVersion}
                            />
                            <input
                              type="hidden"
                              name="toStatus"
                              value="blocked"
                            />
                            <input
                              type="hidden"
                              name="note"
                              value="Work blocked pending follow-up."
                            />
                            <button className="primary-button" type="submit">
                              Mark blocked
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}

                    {!closed &&
                    canComplete &&
                    workOrder.status === "in_progress" ? (
                      <form
                        action={transitionMaintenanceWorkOrderAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="workOrderId"
                          value={workOrder.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={workOrder.rowVersion}
                        />
                        <input
                          type="hidden"
                          name="toStatus"
                          value="completed"
                        />
                        <label className={styles.field + " " + styles.full}>
                          <span>Completion evidence</span>
                          <textarea
                            name="completionSummary"
                            minLength={8}
                            maxLength={4000}
                            required
                            placeholder="Describe the completed repair, inspection or corrective work."
                          />
                        </label>
                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Complete work order
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {!closed && canAssign ? (
                      <form
                        action={transitionMaintenanceWorkOrderAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="workOrderId"
                          value={workOrder.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={workOrder.rowVersion}
                        />
                        <input
                          type="hidden"
                          name="toStatus"
                          value="cancelled"
                        />
                        <label className={styles.field + " " + styles.full}>
                          <span>Cancellation reason</span>
                          <input
                            name="note"
                            minLength={3}
                            maxLength={1000}
                            required
                          />
                        </label>
                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Cancel work order
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {closed ? (
                      <div className={styles.evidenceCard}>
                        <h4>
                          {workOrder.status === "completed"
                            ? "Completion evidence"
                            : "Closure evidence"}
                        </h4>
                        <p>
                          {workOrder.completionSummary ??
                            workOrder.cancellationReason ??
                            "Closed."}
                        </p>
                      </div>
                    ) : null}

                    {!closed && canAddEvidence ? (
                      <div className={styles.evidenceGrid}>
                        <form
                          action={addMaintenanceWorkOrderNoteAction}
                          className={styles.evidenceCard}
                        >
                          <h4>Add note</h4>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="workOrderId"
                            value={workOrder.id}
                          />
                          <label className={styles.field}>
                            <span>Note</span>
                            <textarea name="note" maxLength={4000} required />
                          </label>
                          <button className="primary-button" type="submit">
                            Record note
                          </button>
                        </form>

                        <form
                          action={addMaintenanceWorkOrderMaterialAction}
                          className={styles.evidenceCard}
                        >
                          <h4>Record material</h4>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="workOrderId"
                            value={workOrder.id}
                          />
                          <label className={styles.field}>
                            <span>Material</span>
                            <input name="itemName" maxLength={160} required />
                          </label>
                          <label className={styles.field}>
                            <span>Quantity</span>
                            <input
                              name="quantity"
                              type="number"
                              min="0.001"
                              max="1000000"
                              step="0.001"
                              required
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Unit</span>
                            <input
                              name="unit"
                              maxLength={40}
                              placeholder="each, L, ft"
                              required
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Unit cost (cents, optional)</span>
                            <input
                              name="unitCostCents"
                              type="number"
                              min="0"
                              max="1000000000"
                              step="1"
                            />
                          </label>
                          <button className="primary-button" type="submit">
                            Record material
                          </button>
                        </form>

                        <form
                          action={addMaintenanceWorkOrderLaborAction}
                          className={styles.evidenceCard}
                        >
                          <h4>Record labour</h4>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="workOrderId"
                            value={workOrder.id}
                          />
                          <label className={styles.field}>
                            <span>Worker</span>
                            <select name="workerUserId" defaultValue="">
                              <option value="">Me</option>
                              {board.staff.map((staff) => (
                                <option key={staff.id} value={staff.id}>
                                  {staff.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Minutes</span>
                            <input
                              name="minutes"
                              type="number"
                              min="1"
                              max="10080"
                              required
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Labour note (optional)</span>
                            <textarea name="note" maxLength={1000} />
                          </label>
                          <button className="primary-button" type="submit">
                            Record labour
                          </button>
                        </form>

                        <form
                          action={attachMaintenanceWorkOrderMediaAction}
                          className={styles.evidenceCard}
                        >
                          <h4>Attach secure media</h4>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="workOrderId"
                            value={workOrder.id}
                          />
                          <p>
                            Reference an active, validated internal Build 008
                            secure-media asset. The work order stores only the
                            link; it does not duplicate the file.
                          </p>
                          <label className={styles.field}>
                            <span>Media asset ID</span>
                            <input name="mediaAssetId" required />
                          </label>
                          <label className={styles.field}>
                            <span>Caption (optional)</span>
                            <input name="caption" maxLength={500} />
                          </label>
                          <button className="primary-button" type="submit">
                            Attach evidence
                          </button>
                        </form>
                      </div>
                    ) : null}

                    <div className={styles.evidenceGrid}>
                      <div className={styles.evidenceCard}>
                        <h4>Notes ({workOrder.notes.length})</h4>
                        {workOrder.notes.length ? (
                          <ul className={styles.compactList}>
                            {workOrder.notes.slice(0, 4).map((note) => (
                              <li key={note.id}>{note.noteText}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.empty}>No notes recorded.</p>
                        )}
                      </div>
                      <div className={styles.evidenceCard}>
                        <h4>Materials ({workOrder.materials.length})</h4>
                        {workOrder.materials.length ? (
                          <ul className={styles.compactList}>
                            {workOrder.materials.slice(0, 4).map((material) => (
                              <li key={material.id}>
                                {material.quantity} {material.unit} ·{" "}
                                {material.itemName}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.empty}>No materials recorded.</p>
                        )}
                      </div>
                      <div className={styles.evidenceCard}>
                        <h4>Labour ({workOrder.labor.length})</h4>
                        {workOrder.labor.length ? (
                          <ul className={styles.compactList}>
                            {workOrder.labor.slice(0, 4).map((labor) => (
                              <li key={labor.id}>
                                {labor.workerLabel} · {labor.minutes} min
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.empty}>No labour recorded.</p>
                        )}
                      </div>
                      <div className={styles.evidenceCard}>
                        <h4>Secure media ({workOrder.media.length})</h4>
                        {workOrder.media.length ? (
                          <ul className={styles.compactList}>
                            {workOrder.media.slice(0, 4).map((media) => (
                              <li key={media.id}>
                                {media.caption ?? media.mediaAssetId}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.empty}>No media attached.</p>
                        )}
                      </div>
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
            renderedAt={new Date().toISOString()}
            sectionKey="workspace.maintenance.work-orders"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Omnichannel & roadmap boundary"
            title="One work-order authority across channels"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA provides the full visual workbench. Voice/DTMF and SMS/MMS
            must invoke the same server-authorized work-order commands; visual
            media selection uses a secure-link or staff-assisted handoff rather
            than pretending a keypad can perform a graphical task. Build 066 now
            provides the foreman queue and escalation layer over these work
            orders. Recurring schedules remain later scope and will reuse the
            Build 007 scheduler.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
