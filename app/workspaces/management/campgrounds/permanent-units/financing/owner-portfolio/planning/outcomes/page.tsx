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
import { getOwnerHandoffEvidence } from "@/lib/permanent-unit-owner-outcomes/postgres.mjs";
import {
  latestOutcomesByPlan,
  canResolveOutcome,
} from "@/lib/permanent-unit-owner-outcomes/core.mjs";
import {
  ownerHandoffOutcomeAction,
  ownerHandoffResolutionAction,
} from "./actions";
import styles from "../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner handoff outcomes & resolution evidence · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes";
const planningPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning";
const outcomeLabels: Record<string, string> = {
  coordination_in_progress: "Coordination in progress",
  additional_review_needed: "Additional owner review needed",
  target_review_completed: "Target owner review completed",
  unable_to_proceed: "Unable to proceed with coordination",
};
const resolutionLabels: Record<string, string> = {
  owner_coordination_complete: "Owner coordination complete",
  planning_closed_unresolved: "Close planning as unresolved",
  new_plan_recommended: "Recommend a new planning cycle",
};
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
export default async function OwnerHandoffOutcomesPage({
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
  const allowed = await Promise.all(
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
  if (!allowed.some(Boolean)) redirect("/auth/not-authorized");
  const portfolio = await getOwnerFinanceReport(session.user.id, 30);
  const camps = portfolio.campgrounds;
  const selected =
    camps.find((c) => c.campgroundId === params.campground) ?? camps[0];
  const campIds = camps.map((c) => c.campgroundId);
  const [planning, evidence] = await Promise.all([
    getOwnerPlanning(session.user.id, campIds),
    getOwnerHandoffEvidence(session.user.id, campIds),
  ]);
  const plans = planning.handoffs
    .filter((h) => h.sourceCampgroundId === selected.campgroundId)
    .slice(0, 30);
  const names = new Map(camps.map((c) => [c.campgroundId, c.name]));
  const latest = latestOutcomesByPlan(evidence.outcomes);
  const resolutions = new Map(evidence.resolutions.map((r) => [r.planId, r]));
  const countResolved = plans.filter((p) => resolutions.has(p.id)).length;
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={planningPath}>Owner handoff planning</Link>
          <span>/</span>
          <span>Outcomes &amp; resolutions</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 103 · Manual owner evidence</p>
          <h1>Handoff outcomes &amp; planning resolution</h1>
          <p className="hero-panel__lead">
            Record the latest result of a planned owner-to-owner follow-up, then
            resolve the coordination plan only against a completed or
            unable-to-proceed outcome.
          </p>
          <p>
            A resolution closes the <strong>coordination plan only</strong>. It
            does not close an applicant case, release a delivery exception,
            authorize financing, send messages or move another campground&apos;s
            records.
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
            id="owner-outcomes-filter"
            eyebrow="Restricted cross-property view"
            title="Source campground and progress"
            helpTopic="permanent.owner-outcomes"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Source campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {camps.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              View handoffs
            </button>
          </form>
          <p>
            {plans.length} displayed handoff plans · {countResolved} with
            administrative resolution · Owner snapshot{" "}
            {date(portfolio.generatedAt)} UTC.
          </p>
          {portfolio.limited ||
          planning.handoffLimited ||
          evidence.outcomesLimited ||
          evidence.resolutionsLimited ? (
            <p role="alert">
              A bounded portfolio or history limit applies. This screen may not
              contain older work; consult the source ledger for a complete
              audit.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-outcomes-records"
            eyebrow="Source-linked, append-only evidence"
            title="Manual follow-up outcomes"
            helpTopic="permanent.owner-outcomes"
          />
          {!plans.length ? (
            <p>
              No cross-campground handoff plans are available for this source
              campground. Create one in{" "}
              <Link href={planningPath}>owner handoff planning</Link> first.
            </p>
          ) : null}
          {plans.map((p) => {
            const current = latest.get(p.id),
              resolution = resolutions.get(p.id);
            return (
              <article key={p.id} className="content-panel">
                <h3>
                  {names.get(p.sourceCampgroundId)} →{" "}
                  {names.get(p.targetCampgroundId)}
                </h3>
                <p>
                  Planned {date(p.plannedAt)} · Original review due{" "}
                  {date(p.dueAt)} · Plan {p.id.slice(0, 8)}
                </p>
                {current ? (
                  <p>
                    <strong>Latest outcome:</strong>{" "}
                    {outcomeLabels[current.outcomeKind]} · Recorded{" "}
                    {date(current.recordedAt)} · {current.ownerNote}
                  </p>
                ) : (
                  <p>
                    <strong>Awaiting first owner outcome.</strong>
                  </p>
                )}
                {current?.nextActionAt ? (
                  <p>
                    Next action expected by {date(current.nextActionAt)} UTC.
                  </p>
                ) : null}
                {resolution ? (
                  <p role="status">
                    <strong>Coordination plan resolved:</strong>{" "}
                    {resolutionLabels[resolution.resolutionKind]} · Recorded{" "}
                    {date(resolution.resolvedAt)}. {resolution.ownerNote}
                  </p>
                ) : null}
                {!resolution ? (
                  <form
                    action={ownerHandoffOutcomeAction}
                    className={styles.formGrid}
                  >
                    <input type="hidden" name="planId" value={p.id} />
                    <input
                      type="hidden"
                      name="sourceCampgroundId"
                      value={p.sourceCampgroundId}
                    />
                    <input
                      type="hidden"
                      name="targetCampgroundId"
                      value={p.targetCampgroundId}
                    />
                    <label>
                      Outcome
                      <select required name="outcomeKind">
                        {Object.entries(outcomeLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Next action date (UTC, required for an ongoing outcome)
                      <input name="nextActionAt" type="date" />
                    </label>
                    <label>
                      Outcome evidence reference
                      <input
                        required
                        minLength={8}
                        maxLength={400}
                        name="evidenceReference"
                        placeholder="Operational source reference"
                      />
                    </label>
                    <label>
                      Owner outcome note
                      <textarea
                        required
                        minLength={12}
                        maxLength={800}
                        name="ownerNote"
                        placeholder="Describe coordination evidence only; no applicant details"
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record follow-up outcome
                    </button>
                  </form>
                ) : null}
                {canResolveOutcome(current, Boolean(resolution)) ? (
                  <form
                    action={ownerHandoffResolutionAction}
                    className={styles.formGrid}
                  >
                    <input type="hidden" name="planId" value={p.id} />
                    <input
                      type="hidden"
                      name="sourceCampgroundId"
                      value={p.sourceCampgroundId}
                    />
                    <input
                      type="hidden"
                      name="targetCampgroundId"
                      value={p.targetCampgroundId}
                    />
                    <input
                      type="hidden"
                      name="latestOutcomeId"
                      value={current?.id}
                    />
                    <label>
                      Administrative resolution
                      <select name="resolutionKind" required>
                        {Object.entries(resolutionLabels).map(
                          ([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Resolution evidence reference
                      <input
                        required
                        minLength={8}
                        maxLength={400}
                        name="evidenceReference"
                        placeholder="Source record supporting owner resolution"
                      />
                    </label>
                    <label>
                      Resolution note
                      <textarea
                        required
                        minLength={12}
                        maxLength={800}
                        name="ownerNote"
                        placeholder="Why can this coordination plan be closed? No case or credit details."
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record administrative resolution
                    </button>
                  </form>
                ) : null}
                {evidence.outcomes
                  .filter((o) => o.planId === p.id)
                  .slice(0, 5)
                  .map((o) => (
                    <p key={o.id}>
                      <strong>{date(o.recordedAt)}:</strong>{" "}
                      {outcomeLabels[o.outcomeKind]} · {o.evidenceReference} ·{" "}
                      {o.ownerNote}
                    </p>
                  ))}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
