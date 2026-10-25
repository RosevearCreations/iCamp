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
import { getOwnerFinanceReport } from "@/lib/permanent-unit-owner-report/postgres.mjs";
import { getOwnerPlanning } from "@/lib/permanent-unit-owner-planning/postgres.mjs";
import { utcWeekOptions } from "@/lib/permanent-unit-owner-planning/core.mjs";
import { ownerTrendAnnotationAction, ownerHandoffPlanAction } from "./actions";
import styles from "../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner trend reviews & handoff plans · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning";
const overview =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio";
const metricLabels: Record<string, string> = {
  consents: "Delivery consents",
  holds: "New hold events",
  clears: "Hold clear events",
  created_tasks: "Follow-up tasks opened",
  closed_tasks: "Administrative tasks closed",
};
const dispositionLabels: Record<string, string> = {
  routine_context: "Routine operational context",
  monitor_next_cycle: "Monitor next reporting cycle",
  propose_followup: "Propose owner follow-up planning",
};
const scopeLabels: Record<string, string> = {
  followup_coordination: "Coordinate owner follow-up",
  exception_review_planning: "Plan exception review",
  trend_pattern_review: "Review recurring trend pattern",
};
const dates = (d: string) =>
  new Date(d).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
export default async function OwnerPlanningPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const ownerAccess = await Promise.all(
    assigned
      .filter((c) => c.roleCodes.includes("owner_admin"))
      .map((c) =>
        hasCampgroundPermission(
          session.user.id,
          c.campgroundId,
          "permanent_unit.transfer",
        ),
      ),
  );
  if (!ownerAccess.some(Boolean)) redirect("/auth/not-authorized");
  const report = await getOwnerFinanceReport(session.user.id, 30);
  const campgrounds = report.campgrounds;
  const selected =
    campgrounds.find((c) => c.campgroundId === params.campground) ??
    campgrounds[0];
  const planning = await getOwnerPlanning(
    session.user.id,
    campgrounds.map((c) => c.campgroundId),
  );
  const sourceAnnotations = planning.annotations.filter(
    (a) => a.campgroundId === selected.campgroundId,
  );
  const targetCampgrounds = campgrounds.filter(
    (c) => c.campgroundId !== selected.campgroundId,
  );
  const byId = new Map(campgrounds.map((c) => [c.campgroundId, c.name]));
  const weeks = utcWeekOptions(new Date(report.generatedAt)).filter((w) =>
    selected.weeks.some((r) => r.week === w),
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={overview}>Owner portfolio</Link>
          <span>/</span>
          <span>Trend reviews &amp; handoff plans</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 102 · Owner reviewed decisions remain manual
          </p>
          <h1>Trend annotations &amp; cross-campground planning</h1>
          <p className="hero-panel__lead">
            Annotate a week of recorded operating activity and plan an
            owner-to-owner follow-up across campgrounds you are authorized to
            oversee.
          </p>
          <p>
            These records are private, append-only planning notes. They do not
            contact applicants, transfer a customer case, score lending risk,
            release delivery exception holds, assign a task automatically or
            authorize financing.
          </p>
        </section>
        {params.saved ? (
          <p className="content-panel" role="status">
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p className="content-panel" role="alert">
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="owner-planning-scope"
            eyebrow="Active Owner / Administrator permission"
            title="Choose the source campground"
            helpTopic="permanent.owner-planning"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {campgrounds.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              View campground
            </button>
          </form>
          <p>
            Owner portfolio snapshot: {dates(report.generatedAt)} UTC ·{" "}
            {campgrounds.length} authorized campgrounds available.{" "}
            {report.limited
              ? "Coverage is limited to the first 50 authorized campgrounds."
              : ""}
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-trend-entry"
            eyebrow="Add source-linked operational context"
            title={`Annotate ${selected.name} weekly activity`}
            helpTopic="permanent.owner-planning"
          />
          <p>
            Choose a retained UTC week and a measured event category. Provide an
            internal evidence reference and workflow-level note only. Never
            include applicant names, phone numbers, credit data or offer terms.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Week (UTC)</th>
                  <th scope="col">Consents</th>
                  <th scope="col">Holds</th>
                  <th scope="col">Clears</th>
                  <th scope="col">Tasks opened</th>
                  <th scope="col">Tasks closed</th>
                </tr>
              </thead>
              <tbody>
                {selected.weeks.map((w) => (
                  <tr key={w.week}>
                    <th scope="row">{w.week}</th>
                    <td>{w.consents}</td>
                    <td>{w.holds}</td>
                    <td>{w.clears}</td>
                    <td>{w.createdTasks}</td>
                    <td>{w.closedTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            These are current recorded event counts. A past annotation records
            an owner&apos;s review at that time; counts may evolve when evidence
            arrives later.
          </p>
          <form action={ownerTrendAnnotationAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              UTC week beginning
              <select required name="weekStart" defaultValue={weeks[0]}>
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trend metric
              <select required name="metric">
                {Object.entries(metricLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner interpretation
              <select required name="disposition">
                {Object.entries(dispositionLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Next owner review date (UTC)
              <input required type="date" name="nextReviewAt" />
            </label>
            <label>
              Source evidence reference
              <input
                required
                minLength={8}
                maxLength={400}
                name="evidenceReference"
                placeholder="Internal weekly-report reference"
              />
            </label>
            <label>
              Operational note
              <textarea
                required
                minLength={12}
                maxLength={800}
                name="note"
                placeholder="Explain operational context or review priority, without personal details"
              />
            </label>
            <button className="primary-button" type="submit">
              Record trend annotation
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-handoff-entry"
            eyebrow="Planning only · No automatic case movement"
            title="Plan a cross-campground handoff"
            helpTopic="permanent.owner-planning"
          />
          {sourceAnnotations.length === 0 ? (
            <p>
              Record a trend annotation on this campground before planning a
              handoff.
            </p>
          ) : null}
          {targetCampgrounds.length === 0 ? (
            <p>
              A second active Owner / Administrator campground assignment is
              required for a cross-campground handoff.
            </p>
          ) : null}
          {sourceAnnotations.length > 0 && targetCampgrounds.length > 0 ? (
            <form action={ownerHandoffPlanAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="sourceCampgroundId"
                value={selected.campgroundId}
              />
              <label>
                Source trend annotation
                <select required name="sourceAnnotationId">
                  {sourceAnnotations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.weekStart} · {metricLabels[a.metric]} ·{" "}
                      {a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination owner campground
                <select required name="targetCampgroundId">
                  {targetCampgrounds.map((c) => (
                    <option key={c.campgroundId} value={c.campgroundId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Planning purpose
                <select required name="planningScope">
                  {Object.entries(scopeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Review handoff by (UTC date)
                <input required type="date" name="dueAt" />
              </label>
              <label>
                Planning evidence reference
                <input
                  required
                  minLength={8}
                  maxLength={400}
                  name="evidenceReference"
                  placeholder="Operational source reference only"
                />
              </label>
              <label>
                Owner planning note
                <textarea
                  required
                  minLength={12}
                  maxLength={800}
                  name="ownerNote"
                  placeholder="What needs a manual owner discussion and why? No applicant information."
                />
              </label>
              <button type="submit" className="primary-button">
                Record handoff plan
              </button>
            </form>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-trend-history"
            eyebrow="Append-only records"
            title="Recent owner trend annotations"
            helpTopic="permanent.owner-planning"
          />
          {planning.annotationLimited ? (
            <p role="alert">
              Only the latest 100 authorized annotations are displayed. This is
              a bounded history, not a complete audit export.
            </p>
          ) : null}
          {!planning.annotations.length ? (
            <p>No owner annotations have been recorded yet.</p>
          ) : null}
          {planning.annotations
            .filter((a) => a.campgroundId === selected.campgroundId)
            .slice(0, 30)
            .map((a) => (
              <article key={a.id} className="content-panel">
                <h3>
                  {a.weekStart} · {metricLabels[a.metric]}
                </h3>
                <p>
                  <strong>{dispositionLabels[a.disposition]}</strong> · Reviewed{" "}
                  {dates(a.recordedAt)} · Next review {dates(a.nextReviewAt)}
                </p>
                <p>{a.note}</p>
                <p>
                  Evidence: {a.evidenceReference} · Record {a.id.slice(0, 8)}
                </p>
              </article>
            ))}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-handoff-history"
            eyebrow="Owner-only portfolio continuity"
            title="Recent handoff plans"
            helpTopic="permanent.owner-planning"
          />
          {planning.handoffLimited ? (
            <p role="alert">
              Only the latest 100 authorized handoff plans are displayed.
            </p>
          ) : null}
          {!planning.handoffs.length ? (
            <p>No cross-campground plans have been recorded.</p>
          ) : null}
          {planning.handoffs.slice(0, 30).map((p) => (
            <article key={p.id} className="content-panel">
              <h3>
                {byId.get(p.sourceCampgroundId)} →{" "}
                {byId.get(p.targetCampgroundId)}
              </h3>
              <p>
                <strong>{scopeLabels[p.planningScope]}</strong> · Planned{" "}
                {dates(p.plannedAt)} · Review by {dates(p.dueAt)}
              </p>
              <p>{p.ownerNote}</p>
              <p>
                Evidence: {p.evidenceReference} · Source annotation{" "}
                {p.sourceAnnotationId.slice(0, 8)}
              </p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
