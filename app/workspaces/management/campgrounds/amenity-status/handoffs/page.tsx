import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { buildStaffAmenityStatusBoard } from "@/lib/amenity-status/board.mjs";
import {
  listActiveAmenityWorkOrderSummaries,
  listPublishedAmenityStatusForStaff,
  listStaffAmenityAssets,
} from "@/lib/amenity-status/postgres.mjs";
import {
  amenityFollowupOutcomes,
  canRecordHandoffFollowup,
  evaluateHandoffSla,
  handoffActorCanAct,
  amenityHandoffPriorities,
} from "@/lib/amenity-handoffs/core.mjs";
import { listAmenityHandoffs } from "@/lib/amenity-handoffs/postgres.mjs";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

import {
  createAmenityHandoffAction,
  decideAmenityHandoffAction,
  recordAmenityFollowupAction,
} from "./actions";
import styles from "./handoffs.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Amenity handoff SLA & guest follow-through · iCamp",
  description:
    "Cross-shift aging and maintenance response targets with private supervisor escalations and owner guest-information review follow-through.",
  robots: { index: false, follow: false },
};

const staffAccess = [
  "asset.read",
  "asset.manage",
  "maintenance.read",
  "maintenance.create",
  "maintenance.assign",
  "maintenance.complete",
];
const maintenanceAccess = [
  "maintenance.read",
  "maintenance.create",
  "maintenance.assign",
  "maintenance.complete",
];
const results: Record<string, string> = {
  created:
    "Handoff saved for the campground. No guest information was published.",
  updated:
    "Handoff decision recorded with an audit trail. No guest information was published.",
  conflict:
    "This handoff was changed by another staff member. Review the latest entry and try again.",
  duplicate:
    "A guest review is already open for this facility. Use the existing request below.",
  invalid:
    "Please check the facility, assigned staff member and required 8–500-character notes.",
  denied:
    "Your role cannot perform this action. Ask the authorized supervisor or campground owner.",
  migration:
    "The original campground database must apply Build 230 migration 0217 first.",
  failed:
    "The change could not be saved. No guest information was changed. Please retry or contact the campground manager.",
  followup_saved:
    "Private follow-up evidence saved. No guest publication, messaging or maintenance completion occurred.",
  duplicate_followup:
    "An identical follow-up was already saved recently. Review the latest timeline before trying again.",
};

function pretty(value: string) {
  return value.replaceAll("_", " ");
}

function stamp(value: string | Date | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Not recorded"
    : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function duration(minutes: number | null) {
  if (minutes === null) return "Unknown";
  const total = Math.abs(minutes);
  if (total < 60) return `${total}m`;
  if (total < 1440) return `${Math.floor(total / 60)}h ${total % 60}m`;
  return `${Math.floor(total / 1440)}d ${Math.floor((total % 1440) / 60)}h`;
}

const slaOrder: Record<string, number> = {
  overdue: 0,
  due_soon: 1,
  on_track: 2,
  unknown: 3,
  complete: 4,
};

export default async function AmenityHandoffPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; tab?: string; result?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/amenity-status/handoffs";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assignments = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assignments.map(async (campground) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions = access?.permissions ?? [];
        return staffAccess.some((key) => permissions.includes(key))
          ? { ...campground, permissions }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((c) => c.campgroundId === params.campground) ??
    authorized[0];
  const canReadMaintenance = maintenanceAccess.some((key) =>
    selected.permissions.includes(key),
  );
  const canEditPublications =
    selected.permissions.includes("campground.configuration") &&
    selected.permissions.includes("campground.map.publish");
  const [ledger, assets, publications, orders] = await Promise.all([
    listAmenityHandoffs({
      actorUserId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listStaffAmenityAssets(session.user.id, selected.campgroundId),
    listPublishedAmenityStatusForStaff(session.user.id, selected.campgroundId),
    canReadMaintenance
      ? listActiveAmenityWorkOrderSummaries(
          session.user.id,
          selected.campgroundId,
        )
      : Promise.resolve([]),
  ]);
  const board = buildStaffAmenityStatusBoard({
    assets,
    publications: publications.publications,
    workOrders: orders,
  });
  const reviewSuggestions = publications.migrationReady
    ? board.items.filter((item) => item.hasAsset && item.needsGuestReview)
    : [];
  const pendingReviewAssets = new Set(
    ledger.items
      .filter(
        (item) => item.kind === "guest_review" && item.status !== "closed",
      )
      .map((item) => item.assetId),
  );
  const timedItems = ledger.items.map((item) => ({
    ...item,
    sla: evaluateHandoffSla(item),
  }));
  const tab = [
    "open",
    "overdue",
    "due_soon",
    "guest_review",
    "closed",
    "all",
  ].includes(params.tab ?? "")
    ? params.tab
    : "open";
  const visible = timedItems
    .filter((item) => {
      if (tab === "guest_review")
        return item.kind === "guest_review" && item.status !== "closed";
      if (tab === "overdue") return item.sla.state === "overdue";
      if (tab === "due_soon") return item.sla.state === "due_soon";
      if (tab === "open") return item.status !== "closed";
      if (tab === "closed") return item.status === "closed";
      return true;
    })
    .sort(
      (a, b) =>
        (slaOrder[a.sla.state] ?? 9) - (slaOrder[b.sla.state] ?? 9) ||
        (a.sla.dueAt ?? "").localeCompare(b.sla.dueAt ?? ""),
    );
  const scoped = (url: string) =>
    `${url}?campground=${encodeURIComponent(selected.campgroundId)}`;

  return (
    <AppShell>
      <div className={`page-stack ${styles.page}`}>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management">Management</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={scoped("/workspaces/management/campgrounds/amenity-status")}
          >
            Amenity status
          </Link>
          <span aria-hidden="true">/</span>
          <span>Shift handoffs</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 231 · Cross-shift escalation &amp; follow-through
          </p>
          <h1>Shift handoffs, deadlines &amp; guest review</h1>
          <p className="hero-panel__lead">
            Leave a durable next-shift action, assign responsibility and
            acknowledge follow-through. Flag guest-information gaps for owner
            review. Handoffs and review decisions are private staff records;
            they never change the public service directory or certify that a
            facility is safe to enter.
          </p>
          <p>
            Response windows are internal planning targets, not guaranteed
            service levels or emergency response. Urgent issues that present a
            safety risk still require direct contact with the campground duty
            manager.
          </p>
          <p>
            Response targets: urgent 1-hour acknowledgement and 4-hour
            follow-through; important 4-hour acknowledgement and 24-hour
            follow-through; normal 24-hour acknowledgement and 72-hour
            follow-through. Guest-owner review uses the follow-through target
            from the original request, even if the handoff is reassigned.
          </p>
          <div className="hero-actions">
            <Link
              className="primary-link"
              href={scoped("/workspaces/management/campgrounds/amenity-status")}
            >
              Staff amenity board
            </Link>
            {canReadMaintenance ? (
              <Link
                className="secondary-link"
                href={scoped("/workspaces/maintenance/work-orders")}
              >
                Maintenance work orders
              </Link>
            ) : null}
            {canEditPublications ? (
              <Link
                className="secondary-link"
                href={scoped(
                  "/workspaces/management/campgrounds/maps/wayfinding/services",
                )}
              >
                Owner publication editor
              </Link>
            ) : null}
          </div>
        </section>

        {params.result && results[params.result] ? (
          <p className={styles.notice} role="status">
            {results[params.result]}
          </p>
        ) : null}
        {!ledger.migrationReady ? (
          <section className="content-panel" role="status">
            <h2>Original database update required</h2>
            <p>
              Build 230 migration 0217 has not been applied to the connected
              campground database. We cannot persist or claim shift handoffs,
              assignments or owner decisions until that database is updated.
              Existing amenity and maintenance records are unchanged.
            </p>
          </section>
        ) : null}
        {ledger.migrationReady && !ledger.followupReady ? (
          <section className="content-panel" role="status">
            <h2>Build 231 original database update required</h2>
            <p>
              Migration 0218 is not available on the connected campground
              database. Deadline indicators remain informational; supervisor
              escalation and owner follow-up forms are disabled until it is
              applied.
            </p>
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Choose campground</h2>
          <form method="get" className={styles.selector}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    value={campground.campgroundId}
                    key={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open handoffs
            </button>
          </form>
          <div className={styles.metrics} aria-label="Handoff status counts">
            <p>
              <strong>
                {ledger.migrationReady
                  ? timedItems.filter((item) => item.sla.state === "overdue")
                      .length
                  : "—"}
              </strong>
              <span>Overdue response targets</span>
            </p>
            <p>
              <strong>
                {ledger.migrationReady
                  ? timedItems.filter((item) => item.sla.state === "due_soon")
                      .length
                  : "—"}
              </strong>
              <span>Due soon</span>
            </p>
            <p>
              <strong>
                {ledger.migrationReady
                  ? ledger.items.filter((item) => item.status !== "closed")
                      .length
                  : "—"}
              </strong>
              <span>Open handoffs</span>
            </p>
            <p>
              <strong>
                {ledger.migrationReady
                  ? ledger.items.filter(
                      (item) =>
                        item.status === "open" && !item.assignedToUserId,
                    ).length
                  : "—"}
              </strong>
              <span>Unassigned</span>
            </p>
            <p>
              <strong>
                {ledger.migrationReady
                  ? ledger.items.filter(
                      (item) =>
                        item.kind === "guest_review" &&
                        item.status !== "closed",
                    ).length
                  : "—"}
              </strong>
              <span>Guest reviews awaiting decision</span>
            </p>
            <p>
              <strong>
                {publications.migrationReady ? reviewSuggestions.length : "—"}
              </strong>
              <span>Suggested guest checks</span>
            </p>
          </div>
        </section>

        {ledger.migrationReady && ledger.permissions.canCreate ? (
          <section
            className="content-panel"
            aria-labelledby="new-handoff-heading"
          >
            <h2 id="new-handoff-heading">Hand off a facility issue</h2>
            <p>
              Record what happened, what the next shift needs to do, and who
              should follow up.
            </p>
            <form action={createAmenityHandoffAction} className={styles.editor}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="kind" value="shift_handoff" />
              <label>
                Facility
                <select name="assetId" required defaultValue="">
                  <option value="" disabled>
                    Choose a facility
                  </option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.displayName} · {asset.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select name="priority" defaultValue="normal">
                  {amenityHandoffPriorities.map((priority) => (
                    <option value={priority} key={priority}>
                      {pretty(priority)}
                    </option>
                  ))}
                </select>
              </label>
              {ledger.permissions.canAssign ? (
                <label>
                  Next-shift owner
                  <select name="assignedToUserId" defaultValue="">
                    <option value="">Unassigned — supervisor to review</option>
                    {ledger.staff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={styles.wide}>
                What happened?
                <textarea
                  name="summary"
                  required
                  minLength={8}
                  maxLength={500}
                  rows={3}
                  placeholder="Facility, issue, observation and current state"
                />
              </label>
              <label className={styles.wide}>
                Next shift should...
                <textarea
                  name="nextAction"
                  required
                  minLength={8}
                  maxLength={500}
                  rows={3}
                  placeholder="Specific safe follow-up and who to notify"
                />
              </label>
              <button className="primary-button" type="submit">
                Save private handoff
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Guest-information review suggestions</h2>
          <p>
            These are comparisons with the separately published guest directory,
            not live safety or availability conclusions. The campground owner
            must verify and publish any change in the existing service editor.
          </p>
          {!publications.migrationReady ? (
            <p role="status">
              Build 228 migration 0216 is unavailable. Guest publication
              comparisons are on hold.
            </p>
          ) : !reviewSuggestions.length ? (
            <p>
              No mismatches or missing reviewed service details are currently
              identified.
            </p>
          ) : (
            <div className={styles.suggestions}>
              {reviewSuggestions.map((item) => (
                <article className={styles.suggestion} key={item.id}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {item.conflicting
                        ? `Staff condition (${pretty(item.operatingState)}) differs from the reported guest service status.`
                        : "The map location has no separately reviewed guest service update."}
                    </p>
                  </div>
                  {pendingReviewAssets.has(item.id) ? (
                    <span className={styles.tag}>Already in review queue</span>
                  ) : ledger.migrationReady && ledger.permissions.canCreate ? (
                    <form action={createAmenityHandoffAction}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="assetId" value={item.id} />
                      <input type="hidden" name="kind" value="guest_review" />
                      <input
                        type="hidden"
                        name="priority"
                        value={item.conflicting ? "urgent" : "normal"}
                      />
                      <input
                        type="hidden"
                        name="summary"
                        value={`Review guest-facing service details for ${item.name}.`}
                      />
                      <input
                        type="hidden"
                        name="nextAction"
                        value="Verify current operating condition and hours; publish separately only after owner review."
                      />
                      <button className="secondary-button" type="submit">
                        Request owner review
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {ledger.migrationReady ? (
          <section
            className="content-panel"
            aria-labelledby="handoff-queue-heading"
          >
            <h2 id="handoff-queue-heading">Shift and review queue</h2>
            <nav className={styles.tabs} aria-label="Filter handoffs">
              {[
                { key: "open", label: "Active" },
                { key: "overdue", label: "Overdue" },
                { key: "due_soon", label: "Due soon" },
                { key: "guest_review", label: "Guest review" },
                { key: "closed", label: "Closed" },
                { key: "all", label: "All" },
              ].map((item) => (
                <Link
                  key={item.key}
                  href={`${scoped(path)}&tab=${item.key}`}
                  aria-current={tab === item.key ? "page" : undefined}
                  className={tab === item.key ? styles.activeTab : styles.tab}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {!visible.length ? (
              <p role="status">
                No records in this view. New handoffs will appear here.
              </p>
            ) : null}
            <div className={styles.queue}>
              {visible.map((item) => {
                const canAcknowledge = handoffActorCanAct({
                  action: "acknowledge",
                  kind: item.kind,
                  status: item.status,
                  actorId: session.user.id,
                  assignedToUserId: item.assignedToUserId,
                  ...ledger.permissions,
                });
                const canClose = handoffActorCanAct({
                  action: "close",
                  kind: item.kind,
                  status: item.status,
                  actorId: session.user.id,
                  assignedToUserId: item.assignedToUserId,
                  ...ledger.permissions,
                });
                const canEscalate =
                  ledger.followupReady &&
                  canRecordHandoffFollowup({
                    eventKind: "escalation",
                    kind: item.kind,
                    status: item.status,
                    ...ledger.permissions,
                  });
                const canReview =
                  ledger.followupReady &&
                  canRecordHandoffFollowup({
                    eventKind: "guest_followup",
                    kind: item.kind,
                    status: item.status,
                    ...ledger.permissions,
                  });
                return (
                  <article className={styles.entry} key={item.id}>
                    <div className={styles.entryHead}>
                      <div>
                        <p className={styles.kicker}>
                          {pretty(item.kind)} · {item.assetCode} ·{" "}
                          {pretty(item.priority)}
                        </p>
                        <h3>{item.assetName}</h3>
                      </div>
                      <span
                        className={
                          item.status === "closed" ? styles.closed : styles.tag
                        }
                      >
                        {pretty(item.status)}
                      </span>
                    </div>
                    <p>
                      <strong>Situation:</strong> {item.summary}
                    </p>
                    <p>
                      <strong>Next action:</strong> {item.nextAction}
                    </p>
                    <p className={styles.meta}>
                      Created {stamp(item.createdAt)} by {item.createdByLabel} ·
                      Owner:{" "}
                      {item.assignedToLabel ??
                        (item.assignedToUserId
                          ? "Assigned staff"
                          : "Unassigned")}
                    </p>
                    <p
                      className={
                        item.sla.state === "overdue"
                          ? styles.overdue
                          : item.sla.state === "due_soon"
                            ? styles.dueSoon
                            : styles.slaStatus
                      }
                    >
                      <strong>{pretty(item.sla.phase)} target:</strong>{" "}
                      {item.sla.state === "complete"
                        ? "Closed"
                        : item.sla.state === "unknown"
                          ? "Timing unavailable"
                          : `${pretty(item.sla.state)} · ${
                              item.sla.remainingMinutes! < 0
                                ? `${duration(item.sla.remainingMinutes)} late`
                                : `${duration(item.sla.remainingMinutes)} left`
                            } · due ${stamp(item.sla.dueAt)}`}
                      {item.sla.ageMinutes !== null
                        ? ` · ${duration(item.sla.ageMinutes)} old`
                        : ""}
                    </p>
                    {item.escalationCount > 0 ? (
                      <p className={styles.meta}>
                        Escalations recorded: {item.escalationCount}
                      </p>
                    ) : null}
                    {item.acknowledgedAt ? (
                      <p className={styles.meta}>
                        Acknowledged {stamp(item.acknowledgedAt)}
                      </p>
                    ) : null}
                    {item.closedAt ? (
                      <p className={styles.meta}>
                        Closed {stamp(item.closedAt)} · {item.resolutionNote}
                      </p>
                    ) : null}
                    {item.kind === "guest_review" &&
                    canEditPublications &&
                    item.status !== "closed" ? (
                      <p>
                        <Link
                          href={scoped(
                            "/workspaces/management/campgrounds/maps/wayfinding/services",
                          )}
                        >
                          Review official published service information
                        </Link>
                      </p>
                    ) : null}
                    {item.followups.length ? (
                      <div className={styles.eventTimeline}>
                        <h4>Recent private follow-through</h4>
                        <ol>
                          {item.followups.map((event) => (
                            <li key={event.id}>
                              <strong>{pretty(event.kind)}</strong>
                              {event.outcome
                                ? ` · ${pretty(event.outcome)}`
                                : ""}
                              {` · ${stamp(event.createdAt)}`}
                              <p>{event.note}</p>
                            </li>
                          ))}
                        </ol>
                        {item.eventCount > item.followups.length ? (
                          <p className={styles.meta}>
                            Showing latest {item.followups.length} of{" "}
                            {item.eventCount} audit-backed events.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {item.status !== "closed" ? (
                      <div className={styles.actions}>
                        {canEscalate ? (
                          <form
                            action={recordAmenityFollowupAction}
                            className={styles.actionForm}
                          >
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="handoffId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={item.rowVersion}
                            />
                            <input
                              type="hidden"
                              name="eventKind"
                              value="escalation"
                            />
                            <label>
                              Supervisor escalation note
                              <textarea
                                name="note"
                                required
                                minLength={8}
                                maxLength={500}
                                rows={2}
                                placeholder="Who was contacted and what follow-up is required?"
                              />
                            </label>
                            <button type="submit" className="secondary-button">
                              Record escalation
                            </button>
                          </form>
                        ) : null}
                        {canReview ? (
                          <form
                            action={recordAmenityFollowupAction}
                            className={styles.actionForm}
                          >
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="handoffId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={item.rowVersion}
                            />
                            <input
                              type="hidden"
                              name="eventKind"
                              value="guest_followup"
                            />
                            <label>
                              Owner review outcome
                              <select
                                name="outcome"
                                required
                                defaultValue="needs_more_evidence"
                              >
                                {amenityFollowupOutcomes.map((outcome) => (
                                  <option value={outcome} key={outcome}>
                                    {pretty(outcome)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Guest-information follow-through
                              <textarea
                                name="note"
                                required
                                minLength={8}
                                maxLength={500}
                                rows={2}
                                placeholder="Evidence reviewed and next owner action; publication remains separate."
                              />
                            </label>
                            <button type="submit" className="secondary-button">
                              Save owner follow-up
                            </button>
                          </form>
                        ) : null}
                        {ledger.permissions.canAssign ? (
                          <form
                            action={decideAmenityHandoffAction}
                            className={styles.actionForm}
                          >
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="handoffId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={item.rowVersion}
                            />
                            <input type="hidden" name="action" value="assign" />
                            <label>
                              Assign issue owner
                              <select
                                name="assignedToUserId"
                                defaultValue={item.assignedToUserId ?? ""}
                                required
                              >
                                <option value="" disabled>
                                  Choose active staff
                                </option>
                                {ledger.staff.map((staff) => (
                                  <option key={staff.id} value={staff.id}>
                                    {staff.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button type="submit" className="secondary-button">
                              Save owner
                            </button>
                          </form>
                        ) : null}
                        {canAcknowledge ? (
                          <form action={decideAmenityHandoffAction}>
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="handoffId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={item.rowVersion}
                            />
                            <input
                              type="hidden"
                              name="action"
                              value="acknowledge"
                            />
                            <button type="submit" className="secondary-button">
                              Acknowledge handoff
                            </button>
                          </form>
                        ) : null}
                        {canClose ? (
                          <form
                            action={decideAmenityHandoffAction}
                            className={styles.actionForm}
                          >
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="handoffId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="rowVersion"
                              value={item.rowVersion}
                            />
                            <input type="hidden" name="action" value="close" />
                            <label>
                              {item.kind === "guest_review"
                                ? "Owner review decision"
                                : "Closeout note"}
                              <textarea
                                name="resolutionNote"
                                required
                                minLength={8}
                                maxLength={500}
                                rows={2}
                                placeholder={
                                  item.kind === "guest_review"
                                    ? "Explain what was reviewed. Publication remains a separate action."
                                    : "What was resolved, and what remains?"
                                }
                              />
                            </label>
                            <button className="primary-button" type="submit">
                              {item.kind === "guest_review"
                                ? "Record owner decision"
                                : "Close handoff"}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
