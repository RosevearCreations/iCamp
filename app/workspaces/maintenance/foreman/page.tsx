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
  formatEscalationTrigger,
  formatMaintenanceResponsibility,
} from "@/lib/maintenance-foreman/core.mjs";
import { getMaintenanceForemanQueue } from "@/lib/maintenance-foreman/postgres.mjs";
import { formatMaintenanceStatus } from "@/lib/maintenance-work-orders/core.mjs";

import {
  acknowledgeMaintenanceEscalationAction,
  assignFromForemanQueueAction,
  raiseMaintenanceEscalationAction,
  resolveMaintenanceEscalationAction,
  updateMaintenanceEscalationPolicyAction,
} from "./actions";
import styles from "./foreman.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintenance foreman queue · iCamp",
  description:
    "Triage, assign and escalate campground maintenance work through explicit responsibility levels.",
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

export default async function MaintenanceForemanPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const path = "/workspaces/maintenance/foreman";
  const session = await requireAnyCampgroundPermission(
    "maintenance.triage",
    path,
  );
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = await Promise.all(
    assigned.map(async (campground) => ({
      campground,
      allowed: await hasCampgroundPermission(
        session.user.id,
        campground.campgroundId,
        "maintenance.triage",
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

  const queue = await getMaintenanceForemanQueue(
    session.user.id,
    selected.campgroundId,
  );
  const [canAssign, canEscalate] = await Promise.all([
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.assign",
    ),
    hasCampgroundPermission(
      session.user.id,
      selected.campgroundId,
      "maintenance.escalate",
    ),
  ]);

  const overdue = queue.workOrders.filter(
    (workOrder) =>
      workOrder.hasResponseOverdue || workOrder.hasCompletionOverdue,
  ).length;
  const blocked = queue.workOrders.filter(
    (workOrder) => workOrder.status === "blocked",
  ).length;
  const emergencyUrgent = queue.workOrders.filter((workOrder) =>
    ["emergency", "urgent"].includes(workOrder.priorityKey),
  ).length;
  const assignableStaff = queue.staff.filter((staff) => staff.assignable);

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Foreman queue</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 066 · Maintenance operations</p>
          <h1>Foreman queue & escalation</h1>
          <p className="hero-panel__lead">
            Triage canonical Build 065 work orders through explicit crew,
            foreman, main-foreman and management responsibility boundaries.
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
                Open foreman queue
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
            eyebrow="Triage"
            title="Queue summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 066</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Active work</span>
              <strong>{queue.workOrders.length}</strong>
            </div>
            <div>
              <span>Emergency / urgent</span>
              <strong>{emergencyUrgent}</strong>
            </div>
            <div>
              <span>Overdue signals</span>
              <strong>{overdue}</strong>
            </div>
            <div>
              <span>Blocked</span>
              <strong>{blocked}</strong>
            </div>
            <div>
              <span>Active escalations</span>
              <strong>{queue.activeEscalations.length}</strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Your current responsibility level is{" "}
            <strong>
              {formatMaintenanceResponsibility(
                queue.actorResponsibilityLevel,
              )}
            </strong>
            . Assignment targets are filtered by that hierarchy before the
            database independently enforces the same boundary.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="roster-heading">
          <SectionHeading
            eyebrow="Responsibility model"
            title="Maintenance roster"
            id="roster-heading"
            helpTopic="shell.overview"
          />
          <div className={styles.roster}>
            {queue.staff.map((staff) => (
              <article className={styles.rosterCard} key={staff.id}>
                <strong>{staff.label}</strong>
                <p>
                  {formatMaintenanceResponsibility(
                    staff.responsibilityLevel,
                  )}
                </p>
                <p>
                  {staff.assignable
                    ? "Assignable from your responsibility level."
                    : "Visible for coordination; assignment is above your authority."}
                </p>
              </article>
            ))}
          </div>
        </section>

        {canEscalate ? (
          <section className="content-panel" aria-labelledby="policy-heading">
            <SectionHeading
              eyebrow="Escalation rules"
              title="Campground escalation policy"
              id="policy-heading"
              helpTopic="shell.overview"
            />
            <div className={styles.policyGrid}>
              {queue.policies.map((policy) => (
                <form
                  action={updateMaintenanceEscalationPolicyAction}
                  className={styles.policyCard}
                  key={policy.id}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="policyId" value={policy.id} />
                  <input
                    type="hidden"
                    name="rowVersion"
                    value={policy.rowVersion}
                  />
                  <h3>{formatEscalationTrigger(policy.triggerKey)}</h3>
                  <label className={styles.field}>
                    <span>Escalate to</span>
                    <select
                      name="targetLevel"
                      defaultValue={policy.targetLevel}
                    >
                      <option value="foreman">Foreman</option>
                      <option value="main_foreman">Main Foreman</option>
                      <option value="manager">Manager</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Additional threshold (minutes)</span>
                    <input
                      name="thresholdMinutes"
                      type="number"
                      min="0"
                      max="43200"
                      step="1"
                      defaultValue={policy.thresholdMinutes}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Instructions</span>
                    <textarea
                      name="instructions"
                      maxLength={1000}
                      defaultValue={policy.instructions ?? ""}
                    />
                  </label>
                  <label>
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={policy.isActive}
                    />{" "}
                    Active
                  </label>
                  <button className="primary-button" type="submit">
                    Save escalation rule
                  </button>
                </form>
              ))}
            </div>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="queue-heading">
          <SectionHeading
            eyebrow="Priority queue"
            title="Foreman work-order triage"
            id="queue-heading"
            helpTopic="shell.overview"
          />
          {queue.workOrders.length === 0 ? (
            <p className={styles.empty}>
              No active maintenance work orders require triage.
            </p>
          ) : (
            <div className={styles.queue}>
              {queue.workOrders.map((workOrder) => {
                const assigned = queue.staff.find(
                  (staff) => staff.id === workOrder.assignedToUserId,
                );
                const activeTriggerKeys = new Set(
                  workOrder.activeEscalations.map(
                    (escalation) => escalation.triggerKey,
                  ),
                );

                return (
                  <article className={styles.queueCard} key={workOrder.id}>
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

                    <p>
                      Assigned to:{" "}
                      <strong>{assigned?.label ?? "Unassigned"}</strong>
                    </p>
                    <p>
                      Response target:{" "}
                      {formatDate(
                        workOrder.responseDueAt,
                        queue.campground.timezone,
                      )}{" "}
                      · Completion target:{" "}
                      {formatDate(
                        workOrder.completionDueAt,
                        queue.campground.timezone,
                      )}
                    </p>

                    {workOrder.signals.length ? (
                      <div className={styles.signalRow}>
                        {workOrder.signals.map((signal) => (
                          <span className={styles.signal} key={signal.triggerKey}>
                            {formatEscalationTrigger(signal.triggerKey)} →{" "}
                            {formatMaintenanceResponsibility(
                              signal.targetLevel,
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.empty}>
                        No current escalation signal.
                      </p>
                    )}

                    {canAssign ? (
                      <form
                        action={assignFromForemanQueueAction}
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
                            {assignableStaff.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.label} ·{" "}
                                {formatMaintenanceResponsibility(
                                  staff.responsibilityLevel,
                                )}
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

                    <div className={styles.actions}>
                      {workOrder.signals
                        .filter(
                          (signal) =>
                            !activeTriggerKeys.has(signal.triggerKey),
                        )
                        .map((signal) => (
                          <form
                            action={raiseMaintenanceEscalationAction}
                            key={signal.triggerKey}
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
                              name="triggerKey"
                              value={signal.triggerKey}
                            />
                            <button className="primary-button" type="submit">
                              Raise{" "}
                              {formatEscalationTrigger(signal.triggerKey)}
                            </button>
                          </form>
                        ))}
                    </div>

                    {workOrder.activeEscalations.length ? (
                      <div className={styles.escalations}>
                        {workOrder.activeEscalations.map((escalation) => (
                          <article
                            className={styles.escalationCard}
                            key={escalation.id}
                          >
                            <h4>
                              {formatEscalationTrigger(escalation.triggerKey)}
                            </h4>
                            <p>
                              {titleCase(escalation.state)} · target{" "}
                              {formatMaintenanceResponsibility(
                                escalation.targetLevel,
                              )}{" "}
                              · raised{" "}
                              {formatDate(
                                escalation.raisedAt,
                                queue.campground.timezone,
                              )}
                            </p>
                            <div className={styles.escalationActions}>
                              {escalation.state === "open" ? (
                                <form
                                  action={
                                    acknowledgeMaintenanceEscalationAction
                                  }
                                  className={styles.field}
                                >
                                  <input
                                    type="hidden"
                                    name="campgroundId"
                                    value={selected.campgroundId}
                                  />
                                  <input
                                    type="hidden"
                                    name="escalationId"
                                    value={escalation.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="rowVersion"
                                    value={escalation.rowVersion}
                                  />
                                  <span>Acknowledgement note (optional)</span>
                                  <input name="note" maxLength={2000} />
                                  <button
                                    className="primary-button"
                                    type="submit"
                                  >
                                    Acknowledge
                                  </button>
                                </form>
                              ) : null}
                              {canEscalate ? (
                                <form
                                  action={resolveMaintenanceEscalationAction}
                                  className={styles.field}
                                >
                                  <input
                                    type="hidden"
                                    name="campgroundId"
                                    value={selected.campgroundId}
                                  />
                                  <input
                                    type="hidden"
                                    name="escalationId"
                                    value={escalation.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="rowVersion"
                                    value={escalation.rowVersion}
                                  />
                                  <span>Resolution note</span>
                                  <input
                                    name="note"
                                    minLength={3}
                                    maxLength={2000}
                                    required
                                  />
                                  <button
                                    className="primary-button"
                                    type="submit"
                                  >
                                    Resolve escalation
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
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
            renderedAt={queue.generatedAt}
            sectionKey="workspace.maintenance.foreman"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Channel parity"
            title="One authority, channel-appropriate controls"
            id="boundary-heading"
            helpTopic="shell.channels"
          />
          <p className={styles.boundary}>
            Web/PWA provides the full visual triage queue and policy editor.
            Voice/DTMF and SMS/MMS may acknowledge, assign or escalate only
            through the same permission-checked server commands. Policy editing,
            long evidence and complex queue review use a verified secure-link or
            staff-assisted handoff rather than pretending a keypad is a visual
            management console.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
