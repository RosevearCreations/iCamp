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
import { getOwnerHandoffEvidence } from "@/lib/permanent-unit-owner-outcomes/postgres.mjs";
import { getOwnerResolutionReview } from "@/lib/permanent-unit-owner-review/postgres.mjs";
import {
  latestReviewsByResolution,
  canAcceptReview,
} from "@/lib/permanent-unit-owner-review/core.mjs";
import {
  independentResolutionReviewAction,
  ownerResolutionAcceptanceAction,
} from "./actions";
import styles from "../../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner resolution reassessment & independent acceptance · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review";
const outcomesPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes";
const reviewLabels: Record<string, string> = {
  resolution_supported: "Existing planning resolution supported by evidence",
  additional_evidence_needed: "Further internal owner evidence is needed",
  resolution_requires_revisit: "Planning resolution requires another review",
};
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
export default async function OwnerResolutionReviewPage({
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
  const ownerPermissions = await Promise.all(
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
  if (!ownerPermissions.some(Boolean)) redirect("/auth/not-authorized");
  const portfolio = await getOwnerFinanceReport(session.user.id, 30);
  const campgrounds = portfolio.campgrounds;
  const selected =
    campgrounds.find((c) => c.campgroundId === params.campground) ??
    campgrounds[0];
  const ids = campgrounds.map((c) => c.campgroundId);
  const [handoffs, review] = await Promise.all([
    getOwnerHandoffEvidence(session.user.id, ids),
    getOwnerResolutionReview(session.user.id, ids),
  ]);
  const resolutions = handoffs.resolutions
    .filter((r) => r.sourceCampgroundId === selected.campgroundId)
    .slice(0, 30);
  const latest = latestReviewsByResolution(review.reviews);
  const accepted = new Map(review.acceptances.map((a) => [a.resolutionId, a]));
  const names = new Map(campgrounds.map((c) => [c.campgroundId, c.name]));
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={outcomesPath}>Owner outcomes &amp; resolutions</Link>
          <span>/</span>
          <span>Independent review</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 104 · Two-person independent evidence workflow
          </p>
          <h1>Resolution reassessment &amp; acceptance</h1>
          <p className="hero-panel__lead">
            A different authorized owner assesses the evidence supporting the
            Build 103 coordination resolution. Another owner can explicitly
            accept the latest supported reassessment.
          </p>
          <p>
            Acceptance is an internal planning receipt only. It does not approve
            financing, amend applicant documents, release delivery holds,
            transfer campground records or send messages.
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
            id="independent-review-scope"
            eyebrow="Restricted owner evidence"
            title="Campground review scope"
            helpTopic="permanent.owner-review"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Source campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {campgrounds.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              View resolutions
            </button>
          </form>
          <p>
            {resolutions.length} resolutions visible ·{" "}
            {resolutions.filter((r) => accepted.has(r.id)).length} accepted ·
            Snapshot {date(portfolio.generatedAt)} UTC.
          </p>
          {portfolio.limited ||
          handoffs.resolutionsLimited ||
          review.reviewsLimited ||
          review.acceptancesLimited ? (
            <p role="alert">
              Portfolio or evidence history is limited. Do not treat older
              missing records as proof of missing review.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="independent-review-ledger"
            eyebrow="Immutable owner evidence"
            title="Review and acceptance records"
            helpTopic="permanent.owner-review"
          />
          {!resolutions.length ? (
            <p>
              No resolved handoff plans for this campground. Return to{" "}
              <Link href={outcomesPath}>owner outcomes</Link> first.
            </p>
          ) : null}
          {resolutions.map((resolution) => {
            const current = latest.get(resolution.id),
              acceptance = accepted.get(resolution.id);
            const isResolver = resolution.resolvedByUserId === session.user.id;
            const isReviewer = current?.reviewedByUserId === session.user.id;
            return (
              <article className="content-panel" key={resolution.id}>
                <h3>
                  {names.get(resolution.sourceCampgroundId)} →{" "}
                  {names.get(resolution.targetCampgroundId)}
                </h3>
                <p>
                  Original plan {resolution.planId.slice(0, 8)} · Resolved{" "}
                  {date(resolution.resolvedAt)} · {resolution.ownerNote}
                </p>
                {current ? (
                  <p>
                    <strong>Latest reassessment:</strong>{" "}
                    {reviewLabels[current.reviewKind]} · Reviewed{" "}
                    {date(current.reviewedAt)} · {current.reviewerNote}
                  </p>
                ) : (
                  <p>Awaiting independent owner reassessment.</p>
                )}
                {current?.nextReviewAt ? (
                  <p>
                    Further review scheduled by {date(current.nextReviewAt)}{" "}
                    UTC.
                  </p>
                ) : null}
                {acceptance ? (
                  <p role="status">
                    <strong>Accepted for internal planning:</strong>{" "}
                    {date(acceptance.acceptedAt)} · {acceptance.acceptanceNote}
                  </p>
                ) : null}
                {!acceptance && !isResolver ? (
                  <form
                    action={independentResolutionReviewAction}
                    className={styles.formGrid}
                  >
                    <input
                      type="hidden"
                      name="resolutionId"
                      value={resolution.id}
                    />
                    <input
                      type="hidden"
                      name="planId"
                      value={resolution.planId}
                    />
                    <input
                      type="hidden"
                      name="sourceCampgroundId"
                      value={resolution.sourceCampgroundId}
                    />
                    <input
                      type="hidden"
                      name="targetCampgroundId"
                      value={resolution.targetCampgroundId}
                    />
                    <label>
                      Independent reassessment
                      <select required name="reviewKind">
                        {Object.entries(reviewLabels).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Next review date (UTC; required when more review is
                      needed)
                      <input type="date" name="nextReviewAt" />
                    </label>
                    <label>
                      Source evidence reference
                      <input
                        required
                        minLength={8}
                        maxLength={400}
                        name="evidenceReference"
                        placeholder="Internal record or audit reference"
                      />
                    </label>
                    <label>
                      Independent reviewer note
                      <textarea
                        required
                        minLength={12}
                        maxLength={800}
                        name="reviewerNote"
                        placeholder="Evidence-based planning assessment; no applicant information"
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record independent reassessment
                    </button>
                  </form>
                ) : null}
                {!acceptance && isResolver ? (
                  <p>
                    The original resolution owner cannot independently reassess
                    their own resolution. A separate authorized owner must
                    record that review.
                  </p>
                ) : null}
                {canAcceptReview(current, Boolean(acceptance)) &&
                !isReviewer ? (
                  <form
                    action={ownerResolutionAcceptanceAction}
                    className={styles.formGrid}
                  >
                    <input
                      type="hidden"
                      name="resolutionId"
                      value={resolution.id}
                    />
                    <input
                      type="hidden"
                      name="planId"
                      value={resolution.planId}
                    />
                    <input
                      type="hidden"
                      name="sourceCampgroundId"
                      value={resolution.sourceCampgroundId}
                    />
                    <input
                      type="hidden"
                      name="targetCampgroundId"
                      value={resolution.targetCampgroundId}
                    />
                    <input
                      type="hidden"
                      name="reassessmentId"
                      value={current?.id}
                    />
                    <label>
                      Acceptance evidence reference
                      <input
                        required
                        minLength={8}
                        maxLength={400}
                        name="evidenceReference"
                        placeholder="Internal reviewed evidence reference"
                      />
                    </label>
                    <label>
                      Acceptance note
                      <textarea
                        required
                        minLength={12}
                        maxLength={800}
                        name="acceptanceNote"
                        placeholder="Document why independent review is accepted for owner planning"
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Accept latest independent reassessment
                    </button>
                  </form>
                ) : null}
                {review.reviews
                  .filter((r) => r.resolutionId === resolution.id)
                  .slice(0, 5)
                  .map((r) => (
                    <p key={r.id}>
                      {date(r.reviewedAt)} · {reviewLabels[r.reviewKind]} ·{" "}
                      {r.evidenceReference} · {r.reviewerNote}
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
