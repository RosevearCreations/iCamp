import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { getCampsiteDepartureCleanupWorkspace } from "@/lib/campsite-departure-cleanup/postgres.mjs";
import { getCottageHousekeepingTurnoverWorkspace } from "@/lib/cottage-turnover-operations/postgres.mjs";
import { buildTurnoverReleaseBoard } from "@/lib/turnover-release/core.mjs";

import {
  clearReviewedCampsiteTurnoverAction,
  releaseReviewedCottageTurnoverAction,
} from "./actions";
import styles from "./turnover-release.module.css";

const PATH = "/workspaces/maintenance/turnover-release";
const COTTAGE_READ = [
  "accommodation.read",
  "accommodation.manage",
  "maintenance.read",
  "maintenance.complete",
  "inspection.perform",
  "inspection.signoff",
  "inspection.template.manage",
  "reservation.read",
  "reservation.modify",
];
const CAMPSITE_READ = [
  "maintenance.read",
  "maintenance.create",
  "maintenance.complete",
  "maintenance.schedule",
  "inspection.perform",
  "inspection.signoff",
  "inspection.template.manage",
  "reservation.read",
  "reservation.modify",
];

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Turnover & availability release · iCamp",
  description:
    "Campground-scoped cottage and campsite cleaning, inspection, maintenance and canonical availability release decisions.",
  robots: { index: false, follow: false },
};

export default async function TurnoverReleasePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    view?: string;
    kind?: string;
    query?: string;
  }>;
}>) {
  const session = await requireStaff(PATH);
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Turnover board unavailable</h1>
          <p>
            The database is not connected. No inventory was released or changed.
          </p>
        </section>
      </AppShell>
    );
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorizations = await Promise.all(
    assigned.map(async (campground) => {
      const keys = [...new Set([...COTTAGE_READ, ...CAMPSITE_READ])];
      const checks = await Promise.all(
        keys.map((key) =>
          hasCampgroundPermission(
            session.user.id,
            campground.campgroundId,
            key,
          ),
        ),
      );
      const allowed = new Set(keys.filter((_, index) => checks[index]));
      const cottage = COTTAGE_READ.some((key) => allowed.has(key));
      const campsite = CAMPSITE_READ.some((key) => allowed.has(key));
      return cottage || campsite
        ? { ...campground, cottage, campsite, allowed }
        : null;
    }),
  );
  const authorized = authorizations.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const [cottages, campsites] = await Promise.all([
    selected.cottage
      ? getCottageHousekeepingTurnoverWorkspace(
          session.user.id,
          selected.campgroundId,
        )
      : Promise.resolve(null),
    selected.campsite
      ? getCampsiteDepartureCleanupWorkspace(
          session.user.id,
          selected.campgroundId,
        )
      : Promise.resolve(null),
  ]);
  const board = buildTurnoverReleaseBoard({
    cottages: cottages?.turnovers ?? [],
    campsites: campsites?.tasks ?? [],
    filters: params,
  });
  const capped =
    (cottages?.turnovers.length ?? 0) >= 250 ||
    (campsites?.tasks.length ?? 0) >= 250;
  const base = `campground=${encodeURIComponent(selected.campgroundId)}`;
  const canCottageRelease = selected.allowed.has("accommodation.manage");
  const canSiteClear =
    selected.allowed.has("maintenance.complete") ||
    selected.allowed.has("inspection.signoff");

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span>/</span>
          <span>Turnover &amp; release</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 186 · Housekeeping / maintenance</p>
          <h1>Turnover &amp; availability release</h1>
          <p className="hero-panel__lead">
            One review queue for campsite departure cleanup and rental-cottage
            housekeeping. Release is blocked until the canonical inspection is
            signed off and site-linked work orders are resolved. The existing
            turnover actions remain the only authority; billing and omnichannel
            are on HOLD.
          </p>
          <div className="hero-actions">
            <Link
              className="secondary-link"
              href={`/workspaces/management/campgrounds/reservations/front-desk?${base}`}
            >
              Front desk
            </Link>
            <Link
              className="secondary-link"
              href={`/workspaces/maintenance/work-orders?${base}`}
            >
              Work orders
            </Link>
            <Link
              className="secondary-link"
              href={`/workspaces/management/campgrounds/availability?${base}`}
            >
              Live availability
            </Link>
          </div>
        </section>
        <section className="content-panel" aria-labelledby="release-summary">
          <SectionHeading
            eyebrow="Campground-scoped release checks"
            title="Turnover summary"
            id="release-summary"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 186</span>}
          />
          <p>
            Source: <strong>{selected.campgroundName}</strong>. Each row is a
            live view of a canonical cottage or campsite turnover. No new
            reservation or booking state is created.
          </p>
          <div className={styles.summary}>
            <div className={styles.metric}>
              <strong>{board.counts.total}</strong>
              <span>Turnovers loaded</span>
            </div>
            <div className={styles.metric}>
              <strong>{board.counts.ready}</strong>
              <span>Cleared for release review</span>
            </div>
            <div className={styles.metric}>
              <strong>{board.counts.blocked}</strong>
              <span>Blocked / needs attention</span>
            </div>
            <div className={styles.metric}>
              <strong>{board.counts.released}</strong>
              <span>Already cleared</span>
            </div>
          </div>
          {capped ? (
            <p className={styles.note} role="status">
              At least one source reached its 250-record display cap. These are
              loaded-row counts, not complete campground totals. Open the source
              workspaces for older history.
            </p>
          ) : null}
          {!selected.cottage || !selected.campsite ? (
            <p className={styles.note}>
              Some source rows are hidden because our role lacks the matching
              cottage or campsite read permission. Counts reflect visible
              sources only.
            </p>
          ) : null}
          <form
            method="get"
            role="search"
            aria-label="Turnover release filters"
            className={styles.filters}
          >
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              State
              <select name="view" defaultValue={board.filters.view}>
                <option value="all">All turnovers</option>
                <option value="ready">Ready to review</option>
                <option value="blocked">Blocked</option>
                <option value="released">Cleared history</option>
              </select>
            </label>
            <label>
              Type
              <select name="kind" defaultValue={board.filters.kind}>
                <option value="all">All accommodation types</option>
                <option value="cottage">Rental cottages</option>
                <option value="campsite">Campsites</option>
              </select>
            </label>
            <label>
              Find site, status or issue
              <input
                name="query"
                type="search"
                defaultValue={board.filters.query}
                maxLength={80}
                placeholder="Site code or blocker"
              />
            </label>
            <button className="primary-button" type="submit">
              Update board
            </button>
          </form>
          <p>
            Showing {board.rows.length} rows after filtering.{" "}
            <Link href={`${PATH}?${base}`}>
              Clear filters / refresh live sources
            </Link>
            .
          </p>
        </section>
        <section className="content-panel" aria-labelledby="release-queue">
          <SectionHeading
            eyebrow="Canonical evidence"
            title="Release decision queue"
            id="release-queue"
            helpTopic="shell.overview"
          />
          <div className={styles.list}>
            {board.rows.length === 0 ? (
              <p>
                No matching turnovers. Try a different filter or open the source
                workflow to create a turnover.
              </p>
            ) : (
              board.rows.map((row) => {
                const state = row.release;
                const canSubmit =
                  row.kind === "cottage"
                    ? canCottageRelease
                    : canSiteClear &&
                      (!row.blockRebookingUntilClear ||
                        selected.allowed.has("accommodation.manage"));
                return (
                  <article
                    key={`${row.kind}:${row.id}`}
                    className={styles.card}
                  >
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {row.kind === "cottage"
                            ? "Rental cottage"
                            : "Campsite departure"}
                        </p>
                        <h3>
                          {row.code} · {row.name}
                        </h3>
                      </div>
                      <span className={styles.status}>
                        {state.status === "ready"
                          ? "Ready for review"
                          : state.status === "released"
                            ? "Cleared"
                            : "Blocked"}
                      </span>
                    </div>
                    <div className={styles.facts}>
                      <span>
                        Accommodation:{" "}
                        <strong>{row.accommodationStatusState}</strong>
                      </span>
                      <span>
                        Final inspection:{" "}
                        <strong>
                          {row.inspectionStatus?.replaceAll("_", " ") ??
                            "not started"}
                        </strong>
                      </span>
                      <span>
                        Linked site work orders:{" "}
                        <strong>{row.openSiteWorkOrders}</strong>
                      </span>
                      <span>
                        Inspection corrective orders:{" "}
                        <strong>{row.openCorrectiveWorkOrders}</strong>
                      </span>
                    </div>
                    {state.blockers.length ? (
                      <div className={styles.blockers}>
                        <strong>Release blockers</strong>
                        <ul>
                          {state.blockers.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {state.status === "ready" ? (
                      <p className={styles.note}>
                        {state.restoresAvailability
                          ? "This release may restore the accommodation from inspection to available after a fresh server check."
                          : "This action clears the turnover record only. Canonical availability stays unchanged; protected or nonblocking states are not overridden."}
                      </p>
                    ) : null}
                    <div className={styles.actions}>
                      <Link
                        className="primary-link primary-link--dark"
                        href={`${row.sourceHref}?${base}`}
                      >
                        {state.status === "blocked"
                          ? "Resolve in source workflow"
                          : "Review source evidence"}
                      </Link>
                      {state.status === "blocked" &&
                      row.openSiteWorkOrders > 0 ? (
                        <Link
                          className="secondary-link"
                          href={`/workspaces/maintenance/work-orders?${base}`}
                        >
                          Resolve maintenance
                        </Link>
                      ) : null}
                      {state.status === "ready" && canSubmit ? (
                        <form
                          action={
                            row.kind === "cottage"
                              ? releaseReviewedCottageTurnoverAction
                              : clearReviewedCampsiteTurnoverAction
                          }
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name={
                              row.kind === "cottage" ? "turnoverId" : "taskId"
                            }
                            value={row.id}
                          />
                          <input
                            type="hidden"
                            name="rowVersion"
                            value={row.rowVersion}
                          />
                          <label className={styles.confirm}>
                            <input
                              name="confirmReadback"
                              type="checkbox"
                              required
                            />
                            I reviewed the release evidence
                          </label>
                          <button className="primary-button" type="submit">
                            {state.restoresAvailability
                              ? "Release to availability"
                              : "Clear turnover record"}
                          </button>
                        </form>
                      ) : null}
                      {state.status === "ready" && !canSubmit ? (
                        <span>
                          Release permission required; ask an authorized
                          supervisor.
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
        <section className="content-panel">
          <p>
            <strong>Safety boundary:</strong> release actions re-check row
            versions, current inspection sign-off and maintenance in a
            transaction. Any protected accommodation state, including
            maintenance, winterized or closed, remains protected. This board
            does not charge guests, notify anyone or dispatch work.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
