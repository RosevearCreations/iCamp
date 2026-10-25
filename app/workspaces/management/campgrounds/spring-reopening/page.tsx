import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import { springWinterYear } from "@/lib/spring-reopening/core.mjs";
import {
  getSpringReopeningDashboard,
  getSpringReopeningPermissions,
} from "@/lib/spring-reopening/postgres.mjs";

import {
  publishSpringTemplateAction,
  startSpringInspectionAction,
  recordSpringObservationAction,
  reviewSpringInspectionAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Spring reopening and return-to-service · iCamp",
  robots: { index: false, follow: false },
};
const show = (value: string) => value.replaceAll("_", " ");
function closureWinterYear(effectiveOn: string) {
  const year = Number(effectiveOn.slice(0, 4));
  const month = Number(effectiveOn.slice(5, 7));
  return month <= 4 ? year - 1 : year;
}

export default async function SpringReopeningPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/spring-reopening";
  const session = await requireStaff(path);
  const params = await searchParams;
  const available = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (item) => ({
        ...item,
        permissions: await getSpringReopeningPermissions(
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
    accommodations,
    assignments,
    closureEvents,
    inspections,
    observations,
    decisions,
    workOrders,
    permissions,
  } = await getSpringReopeningDashboard(session.user.id, selected.campgroundId);
  const templatesById = new Map(templates.map((item) => [item.id, item]));
  const sitesById = new Map(accommodations.map((item) => [item.id, item]));
  const assignmentsById = new Map(assignments.map((item) => [item.id, item]));
  const recentCloses = new Map<string, (typeof closureEvents)[number]>();
  for (const event of closureEvents) {
    if (!recentCloses.has(event.assignment_id))
      recentCloses.set(event.assignment_id, event);
  }
  const closedAssignments = assignments.filter(
    (item) =>
      item.occupancy_state === "winter_closed" && recentCloses.has(item.id),
  );
  const standaloneSites = accommodations.filter(
    (site) =>
      !assignments.some(
        (a) =>
          a.accommodation_id === site.id &&
          a.occupancy_state === "winter_closed",
      ),
  );
  const guideYear = springWinterYear();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Spring reopening</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 089 · Inspected return to service</p>
          <h1>Spring reopening &amp; return-to-service safety</h1>
          <p className="hero-panel__lead">
            Inspect a site after winter, record water and utility restoration,
            repair hazards, and obtain an independent approval before an
            authorized manager reopens a winter-closed seasonal/yearly
            assignment.
          </p>
          <p>
            <strong>Physical-safety boundary:</strong> Approval records human
            review, not proof of a safety test or legal compliance. It never
            turns on water, powers equipment, unlocks a gate, restores bookings,
            or clears other facility holds.
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
            id="spring-property"
            eyebrow="Campground-scope evidence"
            title="Choose a property and winter cycle"
            helpTopic="spring.reopening"
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
            {show(campground.lifecycle_state)} · Current reopening cycle: winter{" "}
            {guideYear}
          </p>
          {campground.lifecycle_state !== "active" ? (
            <p>
              <strong>Synthetic/test-only property:</strong> Camp Rosevear and
              other inactive campgrounds can practice drafts and observations,
              but cannot approve an actual physical return to service or reopen
              a long-term assignment.
            </p>
          ) : null}
          <p>
            <Link
              href={`/workspaces/management/campgrounds/winterization?campground=${campground.id}`}
            >
              Build 087 · Winter shutdown records
            </Link>
            {" · "}
            <Link
              href={`/workspaces/management/campgrounds/winter-readiness?campground=${campground.id}`}
            >
              Build 088 · Winter-open safety
            </Link>
          </p>
        </section>

        {permissions.policyManage ? (
          <section className="content-panel">
            <SectionHeading
              id="spring-policy"
              eyebrow="Version-pinned local checks"
              title="Publish a spring inspection checklist"
              helpTopic="spring.reopening"
            />
            <p>
              Water service, electrical/heat, sanitation/drainage,
              fire/emergency, grounds/access and site condition are always
              required. Add local items such as permits, fire-water sampling,
              fuel supply tests, dock inspections, or tree clearance. Mark
              optional additions with <code>[optional]</code>.
            </p>
            <form
              action={publishSpringTemplateAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campground.id} />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Checklist name
                <input
                  name="name"
                  required
                  minLength={5}
                  maxLength={160}
                  defaultValue="Spring reopening site safety inspection"
                />
              </label>
              <label className={styles.full}>
                On-site inspection instructions
                <textarea
                  name="instructions"
                  rows={3}
                  required
                  minLength={12}
                  maxLength={2000}
                  defaultValue="Inspect physical systems on site, verify local rules and clearance, record exact supporting sources and resolve defects before return-to-service review."
                />
              </label>
              <label className={styles.full}>
                Additional site-specific checks (up to 14)
                <textarea
                  name="extraSteps"
                  rows={3}
                  placeholder={
                    "Test heated water hookups and relief valves\nCheck emergency assembly signage\n[optional] Inspect dock ladders"
                  }
                />
              </label>
              <button type="submit" className="primary-button">
                Publish immutable checklist
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="spring-start"
            eyebrow="One case per winter closure"
            title="Start a site reopening inspection"
            helpTopic="spring.reopening"
          />
          <p>
            Choose a winter-closed long-term assignment and its matching site,
            or leave the assignment blank for another site without a
            winter-closed occupant. A linked case automatically pins the{" "}
            <em>latest</em> canonical winter-close event; no older approval can
            be reused if the site is closed again.
          </p>
          {closedAssignments.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Winter-closed assignment</th>
                    <th>Site</th>
                    <th>Closure cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {closedAssignments.map((assignment) => {
                    const event = recentCloses.get(assignment.id);
                    return (
                      <tr key={assignment.id}>
                        <td>
                          {assignment.occupant_display_name} ·{" "}
                          {show(assignment.assignment_kind)}
                        </td>
                        <td>
                          {sitesById.get(assignment.accommodation_id)?.code ??
                            "Unknown"}
                        </td>
                        <td>
                          {event
                            ? closureWinterYear(event.effective_on)
                            : "Unknown"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              No linked, winter-closed long-term assignments currently have a
              closure event in view.
            </p>
          )}
          {permissions.record ? (
            <form
              action={startSpringInspectionAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campground.id} />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Accommodation/site
                <select name="accommodationId" required>
                  {accommodations.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code} · {site.display_name} ·{" "}
                      {show(site.accommodation_kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Link a winter-closed assignment (same site)
                <select name="assignmentId" defaultValue="">
                  <option value="">Standalone site inspection</option>
                  {closedAssignments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {sitesById.get(item.accommodation_id)?.code} ·{" "}
                      {item.occupant_display_name}
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
                Winter close/reopening cycle
                <input
                  name="winterYear"
                  type="number"
                  min={2020}
                  max={2120}
                  required
                  defaultValue={guideYear}
                />
              </label>
              <label>
                Observed water service
                <select
                  name="waterService"
                  required
                  defaultValue="restored_verified"
                >
                  <option value="restored_verified">
                    Restored water / inspection required
                  </option>
                  <option value="not_provided_verified">
                    No water service confirmed on site
                  </option>
                </select>
              </label>
              <label className={styles.full}>
                Local return-to-service restrictions and outstanding approvals
                <textarea
                  name="operatingLimits"
                  minLength={12}
                  maxLength={1200}
                  rows={3}
                  required
                  defaultValue="Keep closed until all applicable site and system safety checks pass; verify local reopening requirements and any separate facility holds."
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!templates.length || !accommodations.length}
              >
                Start spring inspection
              </button>
            </form>
          ) : (
            <p>Your role can review evidence but cannot start inspections.</p>
          )}
          {!standaloneSites.length ? (
            <p>
              No eligible standalone sites; winter-closed assignments need
              linked inspections.
            </p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            id="spring-cases"
            eyebrow="Observed evidence and independent review"
            title="Spring inspection register"
            helpTopic="spring.reopening"
          />
          {!inspections.length ? (
            <p>
              No spring reopening cases have been started at this campground.
            </p>
          ) : null}
          {inspections.slice(0, 45).map((inspection) => {
            const template = templatesById.get(inspection.template_id);
            const site = sitesById.get(inspection.accommodation_id);
            const assignment = inspection.assignment_id
              ? assignmentsById.get(inspection.assignment_id)
              : null;
            const history = observations.filter(
              (o) => o.inspection_id === inspection.id,
            );
            const reviews = decisions.filter(
              (d) => d.inspection_id === inspection.id,
            );
            const approved = reviews.find((d) => d.decision === "approved");
            const latest = new Map<string, (typeof observations)[number]>();
            for (const event of history)
              if (!latest.has(event.step_key))
                latest.set(event.step_key, event);
            return (
              <article key={inspection.id} className="content-panel">
                <h3>
                  {site?.code ?? "Site"} · winter {inspection.winter_year} ·{" "}
                  {approved ? "APPROVED" : "Pending independent approval"}
                </h3>
                <p>
                  {site?.display_name ?? "Accommodation unavailable"} ·{" "}
                  {assignment
                    ? `${assignment.occupant_display_name} (${show(assignment.occupancy_state)})`
                    : "Standalone site"}{" "}
                  · {show(inspection.water_service)}
                </p>
                <p>
                  <strong>Local limits:</strong> {inspection.operating_limits}
                </p>
                <p>
                  <strong>Checklist:</strong>{" "}
                  {template
                    ? `v${template.version_number} · ${template.name}`
                    : "Historical policy"}
                  {" · "}
                  {reviews.length} review decision(s) · {history.length} field
                  observation(s)
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Inspection step</th>
                        <th>Requirement</th>
                        <th>Latest observation</th>
                        <th>Corrective work</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template?.steps.map((step) => {
                        const entry = latest.get(step.key);
                        return (
                          <tr key={step.key}>
                            <td>{step.label}</td>
                            <td>{step.required ? "Required" : "Optional"}</td>
                            <td>
                              {entry ? (
                                <>
                                  {show(entry.result)} · {entry.note}
                                  <br />
                                  <small>
                                    {entry.evidence_reference ??
                                      "No source linked"}
                                  </small>
                                </>
                              ) : (
                                "Awaiting on-site check"
                              )}
                            </td>
                            <td>{entry?.corrective_work_order_id ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {reviews.length ? (
                  <p>
                    <strong>Review history:</strong>{" "}
                    {reviews
                      .map((d) => `${show(d.decision)} — ${d.note}`)
                      .join(" · ")}
                  </p>
                ) : null}
                {approved ? (
                  <p>
                    <strong>Approved evidence:</strong> This case is immutable.
                    A winter-closed assignment remains closed until separately
                    reopened by authorized management through
                    <Link
                      href={`/workspaces/management/campgrounds/seasonal?campground=${campground.id}`}
                    >
                      {" "}
                      Seasonal &amp; Yearly
                    </Link>
                    . Other facility holds and bookings are unchanged.
                  </p>
                ) : (
                  <>
                    {permissions.record ? (
                      <form
                        action={recordSpringObservationAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={campground.id}
                        />
                        <input
                          type="hidden"
                          name="inspectionId"
                          value={inspection.id}
                        />
                        <input type="hidden" name="id" value={randomUUID()} />
                        <label>
                          Inspection step
                          <select name="stepKey" required>
                            {template?.steps.map((step) => (
                              <option key={step.key} value={step.key}>
                                {step.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Result
                          <select name="result" required defaultValue="pass">
                            <option value="pass">
                              Pass — source evidence required
                            </option>
                            <option value="defect">
                              Defect — corrective work order required
                            </option>
                            <option value="not_applicable">
                              Not applicable — optional step only
                            </option>
                          </select>
                        </label>
                        <label>
                          Supporting source reference
                          <input
                            name="evidenceReference"
                            maxLength={400}
                            placeholder="Photo ID, water test record, utility log..."
                          />
                        </label>
                        <label>
                          Corrective work order (defects only)
                          <select name="workOrderId" defaultValue="">
                            <option value="">None</option>
                            {workOrders
                              .filter(
                                (w) =>
                                  !w.accommodation_id ||
                                  w.accommodation_id ===
                                    inspection.accommodation_id,
                              )
                              .map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.title} · {show(w.status)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className={styles.full}>
                          What was physically observed and verified?
                          <textarea
                            name="note"
                            minLength={12}
                            maxLength={2000}
                            rows={3}
                            required
                          />
                        </label>
                        <button type="submit" className="primary-button">
                          Record append-only observation
                        </button>
                      </form>
                    ) : null}
                    {permissions.approve ? (
                      <form
                        action={reviewSpringInspectionAction}
                        className={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={campground.id}
                        />
                        <input
                          type="hidden"
                          name="inspectionId"
                          value={inspection.id}
                        />
                        <input type="hidden" name="id" value={randomUUID()} />
                        <p className={styles.full}>
                          Independent reviewer: you cannot approve a case you
                          started or inspected. All steps must have acceptable
                          evidence and every linked defect work order must be
                          completed.
                        </p>
                        <label>
                          Review outcome
                          <select
                            name="decision"
                            required
                            defaultValue="rejected"
                          >
                            <option value="rejected">
                              Reject / request correction
                            </option>
                            <option value="approved">
                              Approve documented return to service
                            </option>
                          </select>
                        </label>
                        <label className={styles.full}>
                          Review rationale and independent source check
                          <textarea
                            name="note"
                            minLength={12}
                            maxLength={2000}
                            required
                            rows={3}
                          />
                        </label>
                        <button type="submit" className="primary-button">
                          Record independent decision
                        </button>
                      </form>
                    ) : null}
                  </>
                )}
              </article>
            );
          })}
        </section>

        <section className="content-panel">
          <SectionHeading
            id="spring-boundary"
            eyebrow="Separate authorization"
            title="After spring approval"
            helpTopic="spring.reopening"
          />
          <p>
            A successful inspection is a prerequisite for the existing long-term
            assignment
            <strong> Reopen</strong> action. Management still chooses when to
            make that transition. Standalone inspections do not change
            availability, remove closure notices, issue passes, charge customers
            or control physical infrastructure. Verify all other operational
            permits and holds independently.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
