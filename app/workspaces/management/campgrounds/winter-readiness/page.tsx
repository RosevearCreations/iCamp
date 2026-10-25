import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import { winterOperatingYear } from "@/lib/cold-readiness/core.mjs";
import {
  getReadinessDashboard,
  getReadinessPermissions,
} from "@/lib/cold-readiness/postgres.mjs";

import {
  publishReadinessTemplateAction,
  startReadinessAssessmentAction,
  recordReadinessObservationAction,
  reviewReadinessAssessmentAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cold-weather winter-readiness compliance · iCamp",
  robots: { index: false, follow: false },
};
const show = (value: string) => value.replaceAll("_", " ");

export default async function WinterReadinessPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/winter-readiness";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const available = (
    await Promise.all(
      assigned.map(async (item) => ({
        ...item,
        permissions: await getReadinessPermissions(
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
    assessments,
    observations,
    decisions,
    workOrders,
    permissions,
  } = await getReadinessDashboard(session.user.id, selected.campgroundId);
  const templateById = new Map(templates.map((item) => [item.id, item]));
  const siteById = new Map(accommodations.map((item) => [item.id, item]));
  const eligibleSites = accommodations.filter(
    (site) =>
      !assignments.some(
        (a) =>
          a.accommodation_id === site.id &&
          (a.winterization_required || a.occupancy_state === "winter_closed"),
      ),
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Cold-weather readiness</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 088 · Alternative winter-open safety evidence
          </p>
          <h1>Cold-weather winter-readiness &amp; approval</h1>
          <p className="hero-panel__lead">
            Where campground policy and local rules permit a site to remain
            open, document protection of water lines, heating and power,
            wastewater systems and safe winter access. An independent reviewer
            must approve the current evidence.
          </p>
          <p>
            <strong>No automatic winter opening:</strong> This is a
            human-recorded compliance review. It does not approve reservations,
            turn on heat or water, certify code compliance, dispatch emergency
            services, or override a seasonal/yearly assignment that must be shut
            down under Build 087.
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
            id="readiness-scope"
            eyebrow="Property evidence"
            title="Campground &amp; winter operating season"
            helpTopic="winter.readiness"
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
            {show(campground.lifecycle_state)} · Winter {winterOperatingYear()}
          </p>
          {campground.lifecycle_state !== "active" ? (
            <p>
              <strong>Test-only campground:</strong> Camp Rosevear and other
              inactive properties can practice checklists, assessments and
              observations, but cannot approve a claim that physical winter
              safety inspections occurred.
            </p>
          ) : null}
        </section>

        {permissions.policyManage ? (
          <section className="content-panel">
            <SectionHeading
              id="readiness-policy"
              eyebrow="Immutable published versions"
              title="Publish cold-weather assessment checklist"
              helpTopic="winter.readiness"
            />
            <p>
              Water freeze protection, heat/power, sanitation and safe winter
              access remain mandatory. Add local safety tasks such as heated
              hookups, backup power, snow-plow routes, heat-trace monitoring or
              storm communications, one per line. Only truly optional additions
              can use <code>[optional]</code>.
            </p>
            <form
              action={publishReadinessTemplateAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campground.id} />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Policy name
                <input
                  name="name"
                  minLength={5}
                  maxLength={160}
                  required
                  defaultValue="Cold-weather operating safety inspection"
                />
              </label>
              <label className={styles.full}>
                Local approval and safety instructions
                <textarea
                  name="instructions"
                  minLength={12}
                  maxLength={2000}
                  required
                  rows={3}
                  defaultValue="Verify the actual winter protection measures on site under the current local operating plan; attach inspection and maintenance sources."
                />
              </label>
              <label className={styles.full}>
                Additional steps (up to 14)
                <textarea
                  name="extraSteps"
                  rows={4}
                  placeholder={
                    "Check heat-trace circuit and backup supply\nVerify emergency winter vehicle access\n[optional] Record temperature alarm settings"
                  }
                />
              </label>
              <button type="submit" className="primary-button">
                Publish immutable checklist
              </button>
            </form>
            <p>
              Published versions cannot be edited. Each assessment retains the
              original policy version.
            </p>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="readiness-start"
            eyebrow="Specific site and operating limits"
            title="Start a winter-readiness assessment"
            helpTopic="winter.readiness"
          />
          <p>
            A long-term site flagged for mandatory winter shutdown cannot use
            this path. Verify the site is legally and physically eligible for
            winter operation before beginning.
          </p>
          {permissions.record ? (
            <form
              action={startReadinessAssessmentAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campground.id} />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Site or accommodation
                <select name="accommodationId" required>
                  {eligibleSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code} · {site.display_name} ·{" "}
                      {show(site.accommodation_kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Policy version
                <select name="templateId" required>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      v{item.version_number} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Associated non-shutdown long-term assignment (if applicable)
                <select name="assignmentId" defaultValue="">
                  <option value="">Not tied to a long-term assignment</option>
                  {assignments
                    .filter(
                      (item) =>
                        !item.winterization_required &&
                        item.occupancy_state !== "winter_closed",
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {siteById.get(item.accommodation_id)?.code ?? "Site"} ·{" "}
                        {show(item.assignment_kind)} assignment
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Winter year
                <input
                  name="winterYear"
                  type="number"
                  min={2020}
                  max={2120}
                  defaultValue={winterOperatingYear()}
                  required
                />
              </label>
              <label>
                Observed water service configuration
                <select name="waterMode" defaultValue="insulated" required>
                  <option value="insulated">
                    Live water with verified insulation
                  </option>
                  <option value="heated">
                    Live water with inspected active heating/heat trace
                  </option>
                  <option value="none_verified">
                    No live water service, physically verified
                  </option>
                </select>
              </label>
              <label className={styles.full}>
                Campground-specific winter operating limits
                <textarea
                  name="operatingLimits"
                  rows={3}
                  minLength={12}
                  maxLength={1200}
                  defaultValue="Staff must verify actual freeze protection, safe emergency access, and local opening authorization before any occupancy."
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!templates.length || !eligibleSites.length}
              >
                Start assessment (not an approval)
              </button>
            </form>
          ) : (
            <p>Winter-readiness recording permission is required.</p>
          )}
        </section>

        <section className="content-panel">
          <SectionHeading
            id="readiness-evidence"
            eyebrow="Corrective defects & independent decisions"
            title="Observed safety evidence & approval history"
            helpTopic="winter.readiness"
          />
          {!assessments.length ? (
            <p>
              No cold-weather assessments have been started for this campground.
            </p>
          ) : null}
          {assessments.slice(0, 35).map((assessment) => {
            const site = siteById.get(assessment.accommodation_id);
            const policy = templateById.get(assessment.template_id);
            const reviewHistory = decisions.filter(
              (d) => d.assessment_id === assessment.id,
            );
            const approved = reviewHistory.some(
              (d) => d.decision === "approved",
            );
            return (
              <article className="content-panel" key={assessment.id}>
                <h3>
                  {site
                    ? `${site.code} · ${site.display_name}`
                    : assessment.accommodation_id}{" "}
                  · Winter {assessment.winter_year}
                </h3>
                <p>
                  {approved
                    ? "Approved human-attested readiness"
                    : reviewHistory[0]?.decision === "rejected"
                      ? "Rejected: corrective follow-up"
                      : "Awaiting observations and review"}{" "}
                  · Water: {show(assessment.water_mode)} · Policy v
                  {policy?.version_number ?? "?"}
                </p>
                <p>{assessment.operating_limits}</p>
                {policy ? (
                  <>
                    <p>
                      Policy: <strong>{policy.name}</strong>.{" "}
                      {policy.instructions}
                    </p>
                    {policy.steps.map((step) => {
                      const latest = observations.find(
                        (obs) =>
                          obs.assessment_id === assessment.id &&
                          obs.step_key === step.key,
                      );
                      return (
                        <div key={step.key}>
                          <p>
                            <strong>{step.label}</strong> ·{" "}
                            {step.required ? "Mandatory" : "Optional"} · Latest:{" "}
                            {latest ? show(latest.result) : "No evidence"}
                          </p>
                          {latest ? (
                            <p>
                              <small>
                                Evidence: {latest.evidence_reference ?? "None"}{" "}
                                · {latest.note}
                              </small>
                            </p>
                          ) : null}
                          {permissions.record && !approved ? (
                            <form
                              action={recordReadinessObservationAction}
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
                                name="assessmentId"
                                value={assessment.id}
                              />
                              <input
                                type="hidden"
                                name="stepKey"
                                value={step.key}
                              />
                              <label>
                                Observed result
                                <select name="result" defaultValue="pass">
                                  <option value="pass">
                                    Safe provision physically verified
                                  </option>
                                  <option value="defect">
                                    Defect requiring corrective work
                                  </option>
                                  {!step.required ? (
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
                                  placeholder="Inspection ID / photo / source log"
                                />
                              </label>
                              <label>
                                Corrective work order (required for defect)
                                <select name="workOrderId" defaultValue="">
                                  <option value="">No work order</option>
                                  {workOrders
                                    .filter(
                                      (work) =>
                                        !work.accommodation_id ||
                                        work.accommodation_id ===
                                          assessment.accommodation_id,
                                    )
                                    .map((work) => (
                                      <option key={work.id} value={work.id}>
                                        {work.title} · {work.status}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                On-site inspection and limitations
                                <input
                                  name="note"
                                  required
                                  minLength={12}
                                  maxLength={2000}
                                  placeholder="What was actually checked at this site?"
                                />
                              </label>
                              <button
                                type="submit"
                                className="secondary-button"
                              >
                                Record observation
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <p>
                    Earlier checklist version unavailable in this view; retain
                    the source record.
                  </p>
                )}
                {permissions.approve && !approved ? (
                  <form
                    action={reviewReadinessAssessmentAction}
                    className={styles.inlineForm}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campground.id}
                    />
                    <input type="hidden" name="id" value={randomUUID()} />
                    <input
                      type="hidden"
                      name="assessmentId"
                      value={assessment.id}
                    />
                    <label>
                      Independent reviewer decision
                      <select name="decision" defaultValue="approved">
                        <option value="approved">
                          Approve evidence for this winter season
                        </option>
                        <option value="rejected">Reject for correction</option>
                      </select>
                    </label>
                    <label>
                      Inspection and reviewer source note
                      <input
                        name="note"
                        minLength={12}
                        maxLength={2000}
                        required
                        placeholder="Who independently verified site protection?"
                      />
                    </label>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={campground.lifecycle_state !== "active"}
                    >
                      Record reviewer decision
                    </button>
                  </form>
                ) : null}
                {reviewHistory.map((review) => (
                  <p key={review.id}>
                    <small>
                      {show(review.decision)} · {review.note} ·{" "}
                      {review.decided_at}
                    </small>
                  </p>
                ))}
              </article>
            );
          })}
        </section>

        <section className="content-panel">
          <SectionHeading
            id="readiness-limit"
            eyebrow="Operating safeguards"
            title="Approval does not activate winter operations"
            helpTopic="winter.readiness"
          />
          <p>
            Current-year approval is a recorded reviewer decision, not an
            automatic site status, availability, paid booking, utility control,
            legal permit or proof of weather-safe conditions. Staff must
            separately perform physical checks and enforce any occupancy
            restrictions or emergency closure.
          </p>
          <p>
            Mandatory yearly/seasonal winter shutdown remains in{" "}
            <strong>Build 087</strong>. Independent spring reopening and
            return-to-service inspections are available in{" "}
            <Link
              href={`/workspaces/management/campgrounds/spring-reopening?campground=${encodeURIComponent(campground.id)}`}
            >
              Build 089
            </Link>
            .
          </p>
          <Link
            className="secondary-button"
            href={`/workspaces/management/campgrounds/winterization?campground=${encodeURIComponent(campground.id)}`}
          >
            Open seasonal/yearly winter shutdown
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
