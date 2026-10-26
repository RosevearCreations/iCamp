import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerFinanceReport } from "@/lib/permanent-unit-owner-report/postgres.mjs";
import { normalizeEvidenceSearch } from "@/lib/permanent-unit-owner-evidence/core.mjs";
import {
  recentOwnerEvidenceExportAcceptances,
  searchOwnerResolutionEvidence,
} from "@/lib/permanent-unit-owner-evidence/postgres.mjs";
import styles from "../../../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner resolution evidence search & export acceptance · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence";
const reviewPath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review";
const exportPath = "/api/owner-finance/evidence/export";
const labels: Record<string, string> = {
  all: "All review states",
  awaiting_review: "Awaiting independent review",
  revisit_needed: "Further review required",
  supported_pending_acceptance: "Supported; not yet accepted",
  accepted: "Independent review accepted",
};
const displayDate = (date: string | null) =>
  date
    ? new Date(date).toLocaleDateString("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
type Params = {
  source?: string;
  target?: string;
  status?: string;
  query?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function OwnerEvidenceSearchPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Params> }>) {
  const session = await requireStaff(path);
  const portfolio = await getOwnerFinanceReport(session.user.id, 30);
  const ids = portfolio.campgrounds.map((c) => c.campgroundId);
  const names = new Map(
    portfolio.campgrounds.map((c) => [c.campgroundId, c.name]),
  );
  const params = await searchParams;
  let error = "";
  let filter = normalizeEvidenceSearch();
  try {
    filter = normalizeEvidenceSearch({
      sourceCampgroundId: params.source,
      targetCampgroundId: params.target,
      status: params.status,
      query: params.query,
      from: params.from,
      to: params.to,
      page: params.page ?? 1,
    });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Invalid evidence search.";
  }
  if (
    (filter.sourceCampgroundId && !ids.includes(filter.sourceCampgroundId)) ||
    (filter.targetCampgroundId && !ids.includes(filter.targetCampgroundId))
  )
    redirect("/auth/not-authorized");
  let result: Awaited<ReturnType<typeof searchOwnerResolutionEvidence>> | null =
    null;
  let receipts: Awaited<
    ReturnType<typeof recentOwnerEvidenceExportAcceptances>
  > = [];
  try {
    [result, receipts] = await Promise.all([
      searchOwnerResolutionEvidence(session.user.id, ids, filter),
      recentOwnerEvidenceExportAcceptances(
        session.user.id,
        filter.sourceCampgroundId,
        filter.targetCampgroundId,
      ),
    ]);
  } catch (cause) {
    error =
      cause instanceof Error
        ? cause.message
        : "Owner evidence is currently unavailable.";
  }
  function pageUrl(page: number) {
    const p = new URLSearchParams();
    if (filter.sourceCampgroundId) p.set("source", filter.sourceCampgroundId);
    if (filter.targetCampgroundId) p.set("target", filter.targetCampgroundId);
    if (filter.status !== "all") p.set("status", filter.status);
    if (filter.query) p.set("query", filter.query);
    if (filter.from) p.set("from", filter.from);
    if (filter.to) p.set("to", filter.to);
    p.set("page", String(page));
    return `${path}?${p.toString()}`;
  }
  const exactPair = Boolean(
    filter.sourceCampgroundId && filter.targetCampgroundId,
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={reviewPath}>Independent review</Link>
          <span>/</span>
          <span>Evidence search &amp; export</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 105 · Owner-only evidence search</p>
          <h1>Cross-campground resolution evidence</h1>
          <p className="hero-panel__lead">
            Search Build 103/104 resolution, reassessment and acceptance
            references across properties where you independently hold Owner /
            Administrator finance access.
          </p>
          <p>
            CSV export is limited to one authorized campground pair and 50
            matching rows, with an immutable acceptance receipt and SHA-256
            fingerprint. No applicant identities, loan terms, source documents
            or free-text review notes are exported.
          </p>
        </section>
        {error ? (
          <p className="content-panel" role="alert">
            {error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="owner-evidence-filter"
            eyebrow="Restricted owner evidence"
            title="Search filters"
            helpTopic="permanent.owner-evidence"
          />
          <form method="get" className={styles.formGrid}>
            <label>
              Source campground
              <select
                name="source"
                defaultValue={filter.sourceCampgroundId ?? ""}
              >
                <option value="">All authorized sources</option>
                {portfolio.campgrounds.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target campground
              <select
                name="target"
                defaultValue={filter.targetCampgroundId ?? ""}
              >
                <option value="">All authorized targets</option>
                {portfolio.campgrounds.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Workflow status
              <select name="status" defaultValue={filter.status}>
                {Object.entries(labels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Internal evidence reference
              <input
                name="query"
                maxLength={100}
                defaultValue={filter.query}
                placeholder="Literal evidence-reference search"
              />
            </label>
            <label>
              Resolved from (UTC)
              <input type="date" name="from" defaultValue={filter.from ?? ""} />
            </label>
            <label>
              Resolved through (UTC)
              <input type="date" name="to" defaultValue={filter.to ?? ""} />
            </label>
            <button className="primary-button" type="submit">
              Search evidence
            </button>
          </form>
          {portfolio.limited ? (
            <p role="alert">
              Only the first 50 authorized campgrounds are included. This is not
              a complete portfolio export.
            </p>
          ) : null}
          <p>
            At most 50 rows per page; a maximum of 20 pages is available for
            this search. Pagination never indicates absence of older evidence.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-evidence-results"
            eyebrow="Read-only evidence index"
            title="Matched resolution history"
            helpTopic="permanent.owner-evidence"
          />
          <p>
            {result?.rows.length ?? 0} rows on page {filter.page}
            {result?.hasMore ? " · More pages available" : ""}
          </p>
          {!result?.rows.length ? (
            <p>
              No matching evidence is visible within your current owner scope
              and filters.
            </p>
          ) : null}
          {result?.rows.map((row) => (
            <article className="content-panel" key={row.resolutionId}>
              <h3>
                {names.get(row.sourceCampgroundId)} →{" "}
                {names.get(row.targetCampgroundId)}
              </h3>
              <p>
                <strong>{labels[row.status] ?? row.status}</strong> · Resolved{" "}
                {displayDate(row.resolvedAt)} · Resolution{" "}
                {row.resolutionId.slice(0, 8)}
              </p>
              <p>
                Original: {row.resolutionKind} · Ref:{" "}
                {row.resolutionEvidenceReference}
              </p>
              <p>
                Latest independent review:{" "}
                {row.reviewKind ?? "Not yet recorded"} ·{" "}
                {displayDate(row.reviewedAt)} · Ref:{" "}
                {row.reviewEvidenceReference ?? "—"}
              </p>
              <p>
                Acceptance: {displayDate(row.acceptedAt)} · Ref:{" "}
                {row.acceptanceEvidenceReference ?? "—"}
              </p>
            </article>
          ))}
          <nav aria-label="Search pages" className={styles.inlineForm}>
            {filter.page > 1 ? (
              <Link href={pageUrl(filter.page - 1)}>Previous page</Link>
            ) : null}
            {result?.hasMore && filter.page < 20 ? (
              <Link href={pageUrl(filter.page + 1)}>Next page</Link>
            ) : null}
          </nav>
          {result?.hasMore && result.coverageCap ? (
            <p role="alert">
              Search reached the 20-page limit. Narrow the filters to review
              further history.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-evidence-export"
            eyebrow="Audited owner decision"
            title="Accept &amp; download evidence CSV"
            helpTopic="permanent.owner-evidence"
          />
          {!exactPair ? (
            <p>
              Select a specific authorized source and a different target
              campground, then search again to enable restricted export.
            </p>
          ) : (
            <form action={exportPath} method="post" className={styles.formGrid}>
              <input
                type="hidden"
                name="sourceCampgroundId"
                value={filter.sourceCampgroundId ?? ""}
              />
              <input
                type="hidden"
                name="targetCampgroundId"
                value={filter.targetCampgroundId ?? ""}
              />
              <input type="hidden" name="status" value={filter.status} />
              <input type="hidden" name="query" value={filter.query} />
              <input type="hidden" name="from" value={filter.from ?? ""} />
              <input type="hidden" name="to" value={filter.to ?? ""} />
              <p>
                {names.get(filter.sourceCampgroundId ?? "")} →{" "}
                {names.get(filter.targetCampgroundId ?? "")}. Export contains a
                fresh, transaction-consistent matching snapshot of 1–50 records;
                if more match, the export is refused.
              </p>
              <label>
                Internal export justification reference
                <input
                  required
                  minLength={8}
                  maxLength={400}
                  name="evidenceReference"
                  placeholder="Owner meeting or audit register reference"
                />
              </label>
              <label>
                Acceptance note
                <textarea
                  required
                  minLength={12}
                  maxLength={800}
                  name="acceptanceNote"
                  placeholder="Why this limited evidence extract is necessary, without applicant information"
                />
              </label>
              <label>
                <input type="checkbox" required name="confirmed" value="yes" />{" "}
                I confirm this restricted metadata export is for internal
                authorized owner review only, without applicant information or
                automated finance decisions.
              </label>
              <button type="submit" className="primary-button">
                Accept scope &amp; download CSV
              </button>
            </form>
          )}
          {exactPair ? (
            <>
              <h3>Recent export acceptance receipts</h3>
              {receipts.length ? (
                receipts.map((receipt) => (
                  <p key={receipt.id}>
                    {displayDate(receipt.acceptedAt)} · {receipt.count} rows ·
                    Receipt {receipt.id.slice(0, 8)} · SHA-256{" "}
                    {receipt.sha256.slice(0, 16)}… · {receipt.evidenceReference}
                  </p>
                ))
              ) : (
                <p>No previous export acceptances for this campground pair.</p>
              )}
              <p>
                Refresh this page after downloading to see the new immutable
                receipt. The file is generated only after its acceptance has
                been recorded.
              </p>
            </>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
