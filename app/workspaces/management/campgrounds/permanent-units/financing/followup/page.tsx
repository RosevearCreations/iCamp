import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import { getFollowupDashboard } from "@/lib/permanent-unit-followup/postgres.mjs";
import {
  createTaskAction,
  evidenceAction,
  reassessmentAction,
  closureAction,
} from "./actions";
import styles from "../../../reservations/reservations.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance owner follow-up and closure · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/followup";
function Reference({ label = "Evidence source" }: { label?: string }) {
  return (
    <label>
      {label}
      <input name="evidenceReference" minLength={8} maxLength={400} required />
    </label>
  );
}
function Notes({ label = "Restricted rationale" }: { label?: string }) {
  return (
    <label>
      {label}
      <textarea name="note" minLength={12} maxLength={800} required />
    </label>
  );
}
export default async function FollowupPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(path),
    params = await searchParams;
  const available = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (c) => ({
        ...c,
        allowed: await hasCampgroundPermission(
          session.user.id,
          c.campgroundId,
          "permanent_unit.transfer",
        ),
      })),
    )
  ).filter((c) => c.allowed);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((c) => c.campgroundId === params.campground) ?? available[0];
  const data = await getFollowupDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const hidden = (
    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/ageing">
            Exception ageing
          </Link>
          <span>/</span>
          <span>Owner follow-up</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 099 · Restricted finance records</p>
          <h1>
            Owner follow-up, independent reassessment &amp; closure evidence
          </h1>
          <p className="hero-panel__lead">
            Track one assigned owner task per accepted escalation, append
            source-linked progress, require independent re-review, and document
            administrative closure.
          </p>
          <p>
            <strong>
              Administrative closure never clears an exception hold, approves
              lending, signs an agreement or contacts an applicant.
            </strong>{" "}
            All actions are recorded manually and remain private to authorized
            campground staff.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={`${styles.notice} ${styles.error}`}>
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="followup-camp"
            eyebrow="Private scope"
            title="Campground"
            helpTopic="permanent.followup"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open
            </button>
          </form>
          <p>
            {data.tasks.length} tasks · {data.evidence.length} evidence items ·{" "}
            {data.closures.length} administrative closures
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="followup-queue"
            eyebrow="Manual continuity"
            title="Accepted escalation task queue"
            helpTopic="permanent.followup"
          />
          {!data.escalations.length ? (
            <p>
              No owner escalations yet. Return to{" "}
              <Link href="/workspaces/management/campgrounds/permanent-units/financing/ageing">
                ageing and escalation
              </Link>
              .
            </p>
          ) : null}
          {data.escalations.map((esc) => {
            const response = data.responses.find(
              (r) => r.escalation_id === esc.id,
            );
            const task = data.tasks.find((t) => t.escalation_id === esc.id);
            if (response?.response !== "accepted_followup" && !task)
              return null;
            const evidence = data.evidence
              .filter((e) => e.task_id === task?.id)
              .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
            const reassessments = data.reassessments
              .filter((r) => r.task_id === task?.id)
              .sort((a, b) => b.reassessed_at.localeCompare(a.reassessed_at));
            const latest = reassessments[0],
              closure = data.closures.find((c) => c.task_id === task?.id);
            const owner = task?.assigned_owner_user_id === session.user.id;
            return (
              <article key={esc.id} className="content-panel">
                <h3>
                  {esc.priority} owner escalation · {esc.id.slice(0, 8)}
                </h3>
                <p>{esc.requested_action}</p>
                {!task && response ? (
                  <form action={createTaskAction} className={styles.formGrid}>
                    {hidden}
                    <input type="hidden" name="escalationId" value={esc.id} />
                    <input
                      type="hidden"
                      name="ownerResponseId"
                      value={response.id}
                    />
                    <input
                      type="hidden"
                      name="assignedOwnerUserId"
                      value={esc.target_owner_user_id}
                    />
                    <label>
                      Task source reference
                      <input
                        name="taskReference"
                        minLength={8}
                        maxLength={400}
                        required
                      />
                    </label>
                    <label>
                      Owner follow-up due (UTC)
                      <input type="datetime-local" name="dueAt" required />
                    </label>
                    <label>
                      Action plan
                      <textarea
                        name="actionPlan"
                        minLength={12}
                        maxLength={800}
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record independent task assignment
                    </button>
                  </form>
                ) : null}
                {task ? (
                  <>
                    <p>
                      <strong>Assigned owner:</strong>{" "}
                      {task.assigned_owner_user_id.slice(0, 8)} ·{" "}
                      <strong>Due:</strong>{" "}
                      {new Date(task.due_at).toLocaleString("en-CA", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC · <strong>Status:</strong>{" "}
                      {closure ? closure.outcome : "Open"}
                    </p>
                    <p>
                      <strong>Plan:</strong> {task.action_plan}
                    </p>
                    {evidence.map((ev) => (
                      <p key={ev.id}>
                        <strong>{ev.evidence_kind}</strong> ·{" "}
                        {ev.evidence_reference} · {ev.note}
                      </p>
                    ))}
                    {!closure && owner ? (
                      <form action={evidenceAction} className={styles.formGrid}>
                        {hidden}
                        <input type="hidden" name="taskId" value={task.id} />
                        <label>
                          Owner progress
                          <select name="evidenceKind">
                            <option value="action_taken">Action taken</option>
                            <option value="pending_dependency">
                              Pending dependency
                            </option>
                            <option value="blocked">Blocked</option>
                          </select>
                        </label>
                        <Reference />
                        <Notes label="Action, dependency or blocker details" />
                        <button className="primary-button" type="submit">
                          Append private owner evidence
                        </button>
                      </form>
                    ) : null}
                    {!closure && evidence.length ? (
                      <form
                        action={reassessmentAction}
                        className={styles.formGrid}
                      >
                        {hidden}
                        <input type="hidden" name="taskId" value={task.id} />
                        <label>
                          Evidence to reassess
                          <select name="evidenceId" required>
                            {evidence.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                {ev.evidence_kind} · {ev.evidence_reference}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Independent review outcome
                          <select name="reassessment">
                            <option value="continue_followup">
                              Continue follow-up
                            </option>
                            <option value="recommend_admin_closure">
                              Recommend administrative closure (completed action
                              only)
                            </option>
                          </select>
                        </label>
                        <Reference />
                        <Notes label="Independent review reasoning" />
                        <button className="primary-button" type="submit">
                          Record independent reassessment
                        </button>
                      </form>
                    ) : null}
                    {!closure && latest ? (
                      <form action={closureAction} className={styles.formGrid}>
                        {hidden}
                        <input type="hidden" name="taskId" value={task.id} />
                        <input
                          type="hidden"
                          name="reassessmentId"
                          value={latest.id}
                        />
                        <p>
                          Latest reassessment:{" "}
                          <strong>{latest.reassessment}</strong>
                        </p>
                        <label>
                          Administrative disposition
                          <select name="outcome">
                            <option value="returned_to_operator">
                              Return to operator follow-up
                            </option>
                            {latest.reassessment ===
                            "recommend_admin_closure" ? (
                              <option value="administrative_followup_complete">
                                Administrative follow-up complete
                              </option>
                            ) : null}
                          </select>
                        </label>
                        <Reference />
                        <Notes label="Owner closure decision evidence" />
                        <button className="primary-button" type="submit">
                          Record independent administrative closure
                        </button>
                      </form>
                    ) : null}
                    {closure ? (
                      <p role="status">
                        <strong>Recorded closure:</strong> {closure.outcome};
                        underlying finance/hold evidence is unchanged.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
