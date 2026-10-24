import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import { winterOperatingYear } from "@/lib/winterization/core.mjs";
import {
  getWinterizationDashboard,
  getWinterizationPermissions,
} from "@/lib/winterization/postgres.mjs";

import {
  publishWinterizationTemplateAction,
  startWinterizationRunAction,
  recordWinterizationStepAction,
  reviewWinterizationRunAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seasonal & yearly winterization · iCamp",
  robots: { index: false, follow: false },
};

const show = (value: string) => value.replaceAll("_", " ");

export default async function WinterizationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/winterization";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const available = (
    await Promise.all(
      assigned.map(async (item) => ({
        ...item,
        permissions: await getWinterizationPermissions(
          session.user.id,
          item.campgroundId,
        ),
      })),
    )
  ).filter((item) => item.permissions.read);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((item) => item.campgroundId === params.campground) ??
    available[0];
  const {
    campground,
    templates,
    assignments,
    runs,
    steps,
    reviews,
    workOrders,
    permissions,
  } = await getWinterizationDashboard(session.user.id, selected.campgroundId);
  const templateById = new Map(templates.map((item) => [item.id, item]));
  const assignmentById = new Map(assignments.map((item) => [item.id, item]));

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Winterization</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 087 · Seasonal & yearly shutdown</p>
          <h1>Winterization checklist & maintenance sign-off</h1>
          <p className="hero-panel__lead">
            Publish a campground-specific shutdown checklist, link it to an
            existing seasonal or yearly assignment, record physical work with
            evidence, and obtain a maintenance-lead/foreman sign-off.
          </p>
          <p>
            This is a human-recorded operational workflow. iCamp does not shut
            off water, drain lines, insulate pipes, control heaters or confirm
            physical freeze protection. Trained staff must perform and inspect
            the actual work under the campground&apos;s local plan.
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
            id="winterization-scope"
            eyebrow="Campground-specific records"
            title="Choose campground & operating winter"
            helpTopic="winterization.shutdown"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={campground.id}>
                {available.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open campground
            </button>
          </form>
          <p>
            <strong>{campground.name}</strong> ·{" "}
            {show(campground.lifecycle_state)} · Current winter season:{" "}
            {winterOperatingYear()}.
          </p>
          {campground.lifecycle_state !== "active" ? (
            <p>
              <strong>Simulation only:</strong> an inactive Camp Rosevear or
              another test campground may record draft and step evidence, but
              cannot sign off a claimed physical shutdown.
            </p>
          ) : null}
        </section>

        {permissions.templateManage ? (
          <section className="content-panel">
            <SectionHeading
              id="winterization-templates"
              eyebrow="Immutable versions"
              title="Publish a shutdown checklist"
              helpTopic="winterization.shutdown"
            />
            <p>
              Water supply shutoff and water-line draining are always required.
              Add local utilities, hose storage, exterior fixtures or other
              tasks, one per line. Prefix a line with <code>[optional]</code>{" "}
              only when the step truly can be omitted.
            </p>
            <form
              action={publishWinterizationTemplateAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campground.id} />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Version name{" "}
                <input
                  name="name"
                  minLength={5}
                  maxLength={160}
                  defaultValue="Standard campground winter shutdown"
                  required
                />
              </label>
              <label className={styles.full}>
                Local safety instructions
                <textarea
                  name="instructions"
                  minLength={12}
                  maxLength={2000}
                  rows={3}
                  defaultValue="Follow the approved on-site utility isolation and freeze-protection procedure; verify shutoff points directly."
                  required
                />
              </label>
              <label className={styles.full}>
                Additional campground utility steps (up to 14)
                <textarea
                  name="extraSteps"
                  rows={5}
                  placeholder={
                    "Disconnect and store exterior hoses\nInspect and protect exposed fixture fittings\n[optional] Record seasonal meter reading"
                  }
                />
              </label>
              <button type="submit" className="primary-button">
                Publish new checklist version
              </button>
            </form>
            <p>
              Published versions cannot be edited. Publish a new version if
              campground procedures change; existing winterization runs retain
              their original snapshot.
            </p>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="winterization-run-start"
            eyebrow="Build 047 long-term assignments"
            title="Start an assignment winterization run"
            helpTopic="winterization.shutdown"
          />
          <p>
            Only active seasonal/yearly assignments may start a winterization
            run. One run per assignment per winter year. Winterization sign-off
            does not itself close the site; management changes the canonical
            assignment state separately.
          </p>
          {permissions.record ? (
            <form
              action={startWinterizationRunAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campground.id} />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Assignment
                <select name="assignmentId" required>
                  {assignments
                    .filter((item) => item.occupancy_state !== "winter_closed")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.display_name} ·{" "}
                        {item.assignment_kind} ·{" "}
                        {item.winterization_required
                          ? "Winterization required"
                          : "Voluntary"}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Checklist version
                <select name="templateId" required>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      v{item.version_number} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Winter season year
                <input
                  type="number"
                  name="winterYear"
                  min={2020}
                  max={2120}
                  defaultValue={winterOperatingYear()}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={
                  !templates.length ||
                  !assignments.some(
                    (item) => item.occupancy_state !== "winter_closed",
                  )
                }
              >
                Start winterization
              </button>
            </form>
          ) : (
            <p>Winterization recording permission is needed to start a run.</p>
          )}
        </section>

        <section className="content-panel">
          <SectionHeading
            id="winterization-progress"
            eyebrow="Append-only evidence and decisions"
            title="Winterization work & maintenance sign-off"
            helpTopic="winterization.shutdown"
          />
          {!runs.length ? (
            <p>
              No winterization runs have been started for this campground yet.
            </p>
          ) : null}
          {runs.slice(0, 35).map((run) => {
            const template = templateById.get(run.template_id);
            const assignment = assignmentById.get(run.assignment_id);
            const approved = reviews.some(
              (review) =>
                review.run_id === run.id && review.decision === "approved",
            );
            const reviewed = reviews.filter(
              (review) => review.run_id === run.id,
            );
            return (
              <article key={run.id} className="content-panel">
                <h3>
                  {assignment
                    ? `${assignment.code} · ${assignment.display_name}`
                    : run.assignment_id}{" "}
                  · Winter {run.winter_year}
                </h3>
                <p>
                  Checklist v{template?.version_number ?? "?"}:{" "}
                  {template?.name ?? "Historical version"} ·{" "}
                  {approved
                    ? "Signed off"
                    : reviewed[0]?.decision === "rejected"
                      ? "Corrective follow-up"
                      : "Awaiting evidence/sign-off"}
                </p>
                {template ? (
                  <>
                    <p>{template.instructions}</p>
                    {template.steps.map((item) => {
                      const latest = steps.find(
                        (step) =>
                          step.run_id === run.id && step.step_key === item.key,
                      );
                      return (
                        <div key={item.key}>
                          <p>
                            <strong>{item.label}</strong> ·{" "}
                            {item.required ? "Required" : "Optional"} · Latest:{" "}
                            {latest ? show(latest.result) : "No evidence"}
                          </p>
                          {latest ? (
                            <p>
                              <small>
                                Source: {latest.evidence_reference ?? "None"} ·{" "}
                                {latest.note}
                              </small>
                            </p>
                          ) : null}
                          {permissions.record && !approved ? (
                            <form
                              action={recordWinterizationStepAction}
                              className={styles.inlineForm}
                            >
                              <input
                                type="hidden"
                                name="campgroundId"
                                value={campground.id}
                              />
                              <input
                                type="hidden"
                                name="id"
                                value={randomUUID()}
                              />
                              <input
                                type="hidden"
                                name="runId"
                                value={run.id}
                              />
                              <input
                                type="hidden"
                                name="stepKey"
                                value={item.key}
                              />
                              <label>
                                Result
                                <select name="result" defaultValue="pass">
                                  <option value="pass">
                                    Completed and physically verified
                                  </option>
                                  <option value="needs_work">
                                    Needs corrective work
                                  </option>
                                  {!item.required ? (
                                    <option value="not_applicable">
                                      Not applicable (optional only)
                                    </option>
                                  ) : null}
                                </select>
                              </label>
                              <label>
                                Evidence reference (required for pass)
                                <input
                                  name="evidenceReference"
                                  minLength={8}
                                  maxLength={400}
                                  placeholder="Photo ID / operator log / inspection sheet"
                                />
                              </label>
                              <label>
                                Work order (required for needs work)
                                <select name="workOrderId" defaultValue="">
                                  <option value="">No work order</option>
                                  {workOrders.map((order) => (
                                    <option key={order.id} value={order.id}>
                                      {order.title} · {order.status}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Observed work / exception note
                                <input
                                  name="note"
                                  minLength={12}
                                  maxLength={2000}
                                  placeholder="What was physically checked?"
                                  required
                                />
                              </label>
                              <button
                                type="submit"
                                className="secondary-button"
                              >
                                Record step evidence
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <p>
                    Historical template version not in current display; open the
                    source record to inspect.
                  </p>
                )}
                {permissions.signoff && !approved ? (
                  <form
                    action={reviewWinterizationRunAction}
                    className={styles.inlineForm}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campground.id}
                    />
                    <input type="hidden" name="id" value={randomUUID()} />
                    <input type="hidden" name="runId" value={run.id} />
                    <label>
                      Foreman decision
                      <select name="decision" defaultValue="approved">
                        <option value="approved">
                          Sign off after verifying all current evidence
                        </option>
                        <option value="rejected">
                          Reject for corrective follow-up
                        </option>
                      </select>
                    </label>
                    <label>
                      Physical inspection / sign-off note
                      <input
                        name="note"
                        minLength={12}
                        maxLength={2000}
                        required
                        placeholder="Record who verified the site and source inspection"
                      />
                    </label>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={campground.lifecycle_state !== "active"}
                    >
                      Record maintenance review
                    </button>
                  </form>
                ) : null}
                {reviewed.map((review) => (
                  <p key={review.id}>
                    <small>
                      {review.decision} · {review.note} · {review.reviewed_at}
                    </small>
                  </p>
                ))}
              </article>
            );
          })}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="winterization-boundary"
            eyebrow="Safety & lifecycle boundary"
            title="Winter close remains a separate authorized action"
            helpTopic="winterization.shutdown"
          />
          <p>
            For an assignment marked as requiring winterization, the Build 047
            winter-close action is blocked at the database until this
            winter&apos;s checklist has all acceptable latest evidence and an
            authorized maintenance/foreman approval.
          </p>
          <p>
            <Link
              href={`/workspaces/management/campgrounds/winter-readiness?campground=${encodeURIComponent(campground.id)}`}
            >
              Build 088 cold-weather readiness
            </Link>{" "}
            applies only to eligible non-shutdown sites. Independent
            spring-opening inspections and return-to-service authorization
            remain in <strong>Build 089</strong>.
          </p>
          <Link
            href={`/workspaces/management/campgrounds/seasonal?campground=${encodeURIComponent(campground.id)}`}
            className="secondary-button"
          >
            Open seasonal/yearly assignment desk
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
