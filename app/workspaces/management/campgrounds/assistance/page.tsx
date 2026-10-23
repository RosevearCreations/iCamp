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
  ASSISTANCE_ESCALATION_LEVELS,
  ASSISTANCE_MESSAGE_CHANNELS,
  ASSISTANCE_OUTCOMES,
} from "@/lib/camper-assistance-triage/core.mjs";
import { listAssistanceQueue } from "@/lib/camper-assistance-triage/postgres.mjs";
import {
  CAMPER_ASSISTANCE_CATEGORIES,
  CAMPER_ASSISTANCE_SEVERITIES,
} from "@/lib/camper-assistance/core.mjs";

import {
  acknowledgeAssistanceEscalationAction,
  addAssistanceStaffNoteAction,
  closeAssistanceCaseAction,
  escalateAssistanceCaseAction,
  recordAssistanceGuestMessageAction,
  resolveAssistanceEscalationAction,
  triageAssistanceCaseAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistance triage · iCamp",
  description:
    "Triage, assign, escalate, communicate and close campground camper-assistance cases.",
};

const visiblePermissions = new Set([
  "assistance.triage",
  "assistance.escalate",
  "assistance.communicate",
  "assistance.close",
  "campground.operations.manage",
]);

function label(value: string) {
  if (value === "wifi") return "Wi-Fi";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function hiddenCase(
  caseItem: { id: string; rowVersion: number },
  campgroundId: string,
) {
  return (
    <>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="caseId" value={caseItem.id} />
      <input type="hidden" name="rowVersion" value={caseItem.rowVersion} />
    </>
  );
}

export default async function AssistanceTriagePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/assistance";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions = authorization?.permissions ?? [];
        return permissions.some((permission) =>
          visiblePermissions.has(permission),
        )
          ? { ...campground, permissions }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const permissions = selected.permissions;
  const canTriage = permissions.includes("assistance.triage");
  const canEscalate = permissions.includes("assistance.escalate");
  const canCommunicate = permissions.includes("assistance.communicate");
  const canClose = permissions.includes("assistance.close");
  const queue = await listAssistanceQueue(
    session.user.id,
    selected.campgroundId,
  );

  const openCases = queue.cases.filter((item) => item.caseState !== "closed");
  const urgent = openCases.filter((item) => item.severity === "urgent").length;
  const escalated = openCases.filter(
    (item) => item.caseState === "escalated",
  ).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <span>Camper Assistance</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 078 · Operational response</p>
          <h1>Assistance Triage & Management Escalation</h1>
          <p className="hero-panel__lead">
            Preserve the camper&apos;s original report while staff reclassify,
            assign, escalate, communicate and close the operational case with
            durable evidence.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice} role="status">
            {params.saved}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="assistance-campground"
            helpTopic="camper.assistance.triage"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
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
              Open queue
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow={selected.campgroundName}
            title="Operational queue"
            id="assistance-queue-summary"
            helpTopic="camper.assistance.triage"
            trailing={<span className="build-chip">Build 078</span>}
          />
          <div className={styles.history}>
            <article>
              <strong>{openCases.length} open</strong>
              <p>
                {urgent} urgent · {escalated} escalated
              </p>
            </article>
            <article>
              <strong>Immutable intake</strong>
              <p>
                Original category, priority, text and media stay as Build 077
                evidence even when operations reclassify the case.
              </p>
            </article>
            <article>
              <strong>Emergency boundary</strong>
              <p>
                Escalation is campground management routing. It does not claim
                police, fire, ambulance or other emergency services were
                dispatched.
              </p>
            </article>
          </div>
        </section>

        {queue.cases.length === 0 ? (
          <section className="content-panel">
            <p>No camper-assistance cases are recorded for this campground.</p>
          </section>
        ) : (
          queue.cases.map((caseItem) => (
            <section className="content-panel" key={caseItem.id}>
              <SectionHeading
                eyebrow={
                  caseItem.accommodationCode + " · " + label(caseItem.caseState)
                }
                title={caseItem.summary}
                id={"assistance-case-" + caseItem.id}
                helpTopic="camper.assistance.triage"
                trailing={
                  <span className="build-chip">{label(caseItem.severity)}</span>
                }
              />

              <div className={styles.history}>
                <article>
                  <strong>Camper report</strong>
                  <p>
                    {caseItem.guestEmail} · {caseItem.accommodationCode} ·{" "}
                    {caseItem.accommodationName}
                  </p>
                  <p>
                    Submitted: {label(caseItem.submittedCategory)} ·{" "}
                    {label(caseItem.submittedSeverity)}
                  </p>
                  {caseItem.details ? <p>{caseItem.details}</p> : null}
                  <p>{caseItem.mediaCount} attachment(s)</p>
                </article>
                <article>
                  <strong>Operational classification</strong>
                  <p>
                    {label(caseItem.category)} · {label(caseItem.severity)} ·{" "}
                    {label(caseItem.caseState)}
                  </p>
                  <p>Assigned: {caseItem.assignedToLabel ?? "Unassigned"}</p>
                  <p>Contact preference: {label(caseItem.contactPreference)}</p>
                </article>
                {caseItem.caseState === "closed" ? (
                  <article>
                    <strong>Closed outcome</strong>
                    <p>
                      {label(caseItem.outcomeCode ?? "other")} ·{" "}
                      {caseItem.outcomeSummary}
                    </p>
                  </article>
                ) : null}
              </div>

              {caseItem.caseState !== "closed" && canTriage ? (
                <>
                  <h3>Triage / assignment</h3>
                  <form
                    action={triageAssistanceCaseAction}
                    className={styles.formGrid}
                  >
                    {hiddenCase(caseItem, selected.campgroundId)}
                    <label>
                      Category
                      <select name="category" defaultValue={caseItem.category}>
                        {CAMPER_ASSISTANCE_CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {label(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Priority
                      <select name="severity" defaultValue={caseItem.severity}>
                        {CAMPER_ASSISTANCE_SEVERITIES.map((value) => (
                          <option key={value} value={value}>
                            {label(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assign to
                      <select
                        name="assignedToUserId"
                        defaultValue={caseItem.assignedToUserId ?? ""}
                      >
                        <option value="">Unassigned</option>
                        {queue.staff.map((staff) => (
                          <option key={staff.userId} value={staff.userId}>
                            {staff.label}
                            {staff.roleCodes.length
                              ? " · " + staff.roleCodes.join(", ")
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.full}>
                      Triage reason / note
                      <textarea name="note" required maxLength={2000} />
                    </label>
                    <div className={styles.full}>
                      <button className="primary-button" type="submit">
                        Save triage
                      </button>
                    </div>
                  </form>

                  <h3>Internal note</h3>
                  <form
                    action={addAssistanceStaffNoteAction}
                    className={styles.formGrid}
                  >
                    {hiddenCase(caseItem, selected.campgroundId)}
                    <label className={styles.full}>
                      Staff-only note
                      <textarea name="note" required maxLength={2000} />
                    </label>
                    <div className={styles.full}>
                      <button className="secondary-button" type="submit">
                        Add internal note
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              {caseItem.caseState !== "closed" && canCommunicate ? (
                <>
                  <h3>Guest communication</h3>
                  <form
                    action={recordAssistanceGuestMessageAction}
                    className={styles.formGrid}
                  >
                    {hiddenCase(caseItem, selected.campgroundId)}
                    <label>
                      Contact record
                      <select name="channel" defaultValue="in_app">
                        {ASSISTANCE_MESSAGE_CHANNELS.map((value) => (
                          <option key={value} value={value}>
                            {label(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.full}>
                      Guest-visible update
                      <textarea name="message" required maxLength={2000} />
                    </label>
                    <p className={styles.full}>
                      In-app updates are displayed in My Stay. Choosing email,
                      SMS or phone records that staff contact channel; Build 078
                      does not falsely claim an external provider delivered it.
                    </p>
                    <div className={styles.full}>
                      <button className="primary-button" type="submit">
                        Record guest update
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              {caseItem.caseState !== "closed" && canEscalate ? (
                <>
                  <h3>Management escalation</h3>
                  {caseItem.activeEscalationId ? (
                    <div className={styles.review}>
                      <p>
                        Active: {label(caseItem.activeEscalationLevel ?? "")} ·{" "}
                        {label(caseItem.activeEscalationState ?? "")}
                      </p>
                      {caseItem.activeEscalationState === "open" ? (
                        <form action={acknowledgeAssistanceEscalationAction}>
                          {hiddenCase(caseItem, selected.campgroundId)}
                          <input
                            type="hidden"
                            name="escalationId"
                            value={caseItem.activeEscalationId}
                          />
                          <input
                            type="hidden"
                            name="escalationRowVersion"
                            value={caseItem.activeEscalationRowVersion ?? 1}
                          />
                          <button className="secondary-button" type="submit">
                            Acknowledge escalation
                          </button>
                        </form>
                      ) : null}
                      <form
                        action={resolveAssistanceEscalationAction}
                        className={styles.formGrid}
                      >
                        {hiddenCase(caseItem, selected.campgroundId)}
                        <input
                          type="hidden"
                          name="escalationId"
                          value={caseItem.activeEscalationId}
                        />
                        <input
                          type="hidden"
                          name="escalationRowVersion"
                          value={caseItem.activeEscalationRowVersion ?? 1}
                        />
                        <label className={styles.full}>
                          Resolution
                          <textarea
                            name="resolutionNote"
                            required
                            maxLength={2000}
                          />
                        </label>
                        <div className={styles.full}>
                          <button className="primary-button" type="submit">
                            Resolve escalation
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <form
                      action={escalateAssistanceCaseAction}
                      className={styles.formGrid}
                    >
                      {hiddenCase(caseItem, selected.campgroundId)}
                      <label>
                        Escalate to
                        <select name="level" defaultValue="manager">
                          {ASSISTANCE_ESCALATION_LEVELS.map((value) => (
                            <option key={value} value={value}>
                              {label(value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.full}>
                        Escalation reason
                        <textarea name="reason" required maxLength={2000} />
                      </label>
                      <div className={styles.full}>
                        <button className="primary-button" type="submit">
                          Escalate case
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : null}

              {caseItem.caseState !== "closed" &&
              canClose &&
              !caseItem.activeEscalationId ? (
                <>
                  <h3>Close with outcome</h3>
                  <form
                    action={closeAssistanceCaseAction}
                    className={styles.formGrid}
                  >
                    {hiddenCase(caseItem, selected.campgroundId)}
                    <label>
                      Outcome
                      <select name="outcomeCode" defaultValue="resolved">
                        {ASSISTANCE_OUTCOMES.map((value) => (
                          <option key={value} value={value}>
                            {label(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.full}>
                      Guest-visible outcome summary
                      <textarea
                        name="outcomeSummary"
                        required
                        maxLength={2000}
                      />
                    </label>
                    <div className={styles.full}>
                      <button className={styles.dangerButton} type="submit">
                        Close assistance case
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              <h3>Case timeline</h3>
              {caseItem.events.length === 0 ? (
                <p>No operational events recorded yet.</p>
              ) : (
                <div className={styles.history}>
                  {caseItem.events.slice(0, 12).map((event) => (
                    <article key={event.id}>
                      <strong>{label(event.eventKind)}</strong>
                      <p>{event.summary}</p>
                      <p className={styles.historyMeta}>
                        {event.actorLabel} · {event.occurredAt}
                        {event.guestVisible
                          ? " · guest visible"
                          : " · internal"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))
        )}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Channel contract"
            title="One case authority"
            id="assistance-channel-contract"
            helpTopic="shell.channels"
          />
          <p>
            Web/PWA is the full visual triage surface. Verified staff IVR/DTMF
            and SMS may invoke the same canonical case commands where the
            existing channel identity and permission controls can represent the
            action safely. Assignment review, long notes and escalation history
            may hand off to a secure Web/PWA link.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
