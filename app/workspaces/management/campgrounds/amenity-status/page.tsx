import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  buildStaffAmenityStatusBoard,
  staffOperatingStates,
} from "@/lib/amenity-status/board.mjs";
import {
  listActiveAmenityWorkOrderSummaries,
  listPublishedAmenityStatusForStaff,
  listStaffAmenityAssets,
} from "@/lib/amenity-status/postgres.mjs";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

import { changeAmenityOperatingStateAction } from "./actions";
import styles from "./amenity-status.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Staff amenity status & maintenance · iCamp",
  description:
    "Campground-scoped staff view of facilities, maintenance work orders and separately approved guest service updates.",
  robots: { index: false, follow: false },
};

const assetAccess = ["asset.read", "asset.manage"];
const maintenanceAccess = [
  "maintenance.read",
  "maintenance.create",
  "maintenance.assign",
  "maintenance.complete",
];

function pretty(value: string) {
  return value.replaceAll("_", " ");
}

function shortDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

export default async function StaffAmenityStatusPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    filter?: string;
    q?: string;
    saved?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/amenity-status";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions = access?.permissions ?? [];
        return [...assetAccess, ...maintenanceAccess].some((permission) =>
          permissions.includes(permission),
        )
          ? { ...campground, permissions }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const mayManageAsset = selected.permissions.includes("asset.manage");
  const mayReadAssets = assetAccess.some((permission) =>
    selected.permissions.includes(permission),
  );
  const mayReadMaintenance = maintenanceAccess.some((permission) =>
    selected.permissions.includes(permission),
  );
  const mayPublish =
    selected.permissions.includes("campground.configuration") &&
    selected.permissions.includes("campground.map.publish");

  const [assets, maintenance, publication] = await Promise.all([
    listStaffAmenityAssets(session.user.id, selected.campgroundId),
    mayReadMaintenance
      ? listActiveAmenityWorkOrderSummaries(
          session.user.id,
          selected.campgroundId,
        )
      : Promise.resolve([]),
    listPublishedAmenityStatusForStaff(session.user.id, selected.campgroundId),
  ]);
  const board = buildStaffAmenityStatusBoard({
    assets,
    workOrders: maintenance,
    publications: publication.publications,
    filters: { filter: params.filter, query: params.q },
  });
  const base = `${path}?campground=${encodeURIComponent(selected.campgroundId)}`;

  return (
    <AppShell>
      <div className={`page-stack ${styles.board}`}>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management">Management</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <span>Amenity status</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 229 · Campground staff</p>
          <h1>Amenities &amp; maintenance</h1>
          <p className="hero-panel__lead">
            Check facility conditions, see active maintenance issues and spot
            guest-information gaps. Internal staff updates are not automatically
            published to guests. Only campground-owner-reviewed service facts
            reach the guest directory.
          </p>
          <div className="hero-actions">
            {mayReadMaintenance ? (
              <Link
                className="primary-link"
                href={`/workspaces/maintenance/work-orders?campground=${encodeURIComponent(selected.campgroundId)}`}
              >
                Open maintenance work orders
              </Link>
            ) : null}
            {mayReadAssets ? (
              <Link
                className="secondary-link"
                href="/workspaces/management/campgrounds/assets"
              >
                Facility assets
              </Link>
            ) : null}
            {mayPublish ? (
              <Link
                className="secondary-link"
                href={`/workspaces/management/campgrounds/maps/wayfinding/services?campground=${encodeURIComponent(selected.campgroundId)}`}
              >
                Review guest publications
              </Link>
            ) : null}
          </div>
        </section>

        {params.saved === "status" ? (
          <p className={styles.success} role="status">
            Internal facility status saved and audited. Guest information has
            not changed.
          </p>
        ) : null}
        {!publication.migrationReady ? (
          <section className="content-panel" role="status">
            <h2>Guest publication checks unavailable</h2>
            <p>
              Build 228 database migration 0216 is not available. The internal
              facility board remains usable, but no published service review can
              be verified here. Ask the database operator to apply that
              migration before trusting guest publication comparisons.
            </p>
          </section>
        ) : null}
        {!mayReadMaintenance ? (
          <section className="content-panel" role="status">
            <p>
              Your campground role does not include maintenance work-order read
              access. Work-order counts are hidden, not assumed to be zero.
            </p>
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Campground and filters</h2>
          <form method="get" className={styles.filters}>
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
              Show
              <select name="filter" defaultValue={board.filter}>
                <option value="all">All facilities</option>
                <option value="attention">Needs attention</option>
                <option value="maintenance">Active work orders</option>
                <option value="guest_review">Guest review needed</option>
              </select>
            </label>
            <label>
              Search by name, code or section
              <input
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                maxLength={80}
              />
            </label>
            <button type="submit" className="primary-button">
              Apply filters
            </button>
            <Link href={base}>Clear</Link>
          </form>
          <div className={styles.metrics} aria-label="Facility overview">
            <p>
              <strong>{board.counts.total}</strong>
              <span>Facilities / map points</span>
            </p>
            <p>
              <strong>{board.counts.attention}</strong>
              <span>Internal attention</span>
            </p>
            <p>
              <strong>
                {mayReadMaintenance ? board.counts.maintenance : "—"}
              </strong>
              <span>With active work orders</span>
            </p>
            <p>
              <strong>
                {publication.migrationReady ? board.counts.guestReview : "—"}
              </strong>
              <span>Guest review flagged</span>
            </p>
          </div>
          <p className={styles.explanation}>
            A work order or internal closure does not automatically change
            published hours or access advice. Flagged differences must be
            checked by an authorized campground publisher.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="amenities-heading">
          <h2 id="amenities-heading">Facility status board</h2>
          {!board.items.length ? (
            <p role="status">
              No facilities match these filters. Clear filters to see all
              recorded facilities, or add a facility in the asset manager.
            </p>
          ) : null}
          <div className={styles.cards}>
            {board.items.map((item) => {
              const published = item.publication?.service?.isPublished === true;
              const guestStatus = published
                ? pretty(
                    item.publication?.service?.operatingStatus ?? "unknown",
                  )
                : "No reviewed service update";
              return (
                <article className={styles.card} key={item.id}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.kicker}>
                        {pretty(item.kind)} · {item.code} · {item.section}
                      </p>
                      <h3>{item.name}</h3>
                    </div>
                    <span
                      className={item.attention ? styles.alert : styles.neutral}
                    >
                      {item.hasAsset
                        ? pretty(item.operatingState)
                        : "Map point only"}
                    </span>
                  </div>
                  <div className={styles.columns}>
                    <div>
                      <h4>Staff operating condition</h4>
                      <p>
                        {item.hasAsset
                          ? `Internal report: ${pretty(item.operatingState)}.`
                          : "No linked facility asset. Operating condition unknown."}
                      </p>
                      {mayManageAsset && item.hasAsset ? (
                        <form
                          action={changeAmenityOperatingStateAction}
                          className={styles.updateForm}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input type="hidden" name="assetId" value={item.id} />
                          <input
                            type="hidden"
                            name="rowVersion"
                            value={item.rowVersion ?? ""}
                          />
                          <label>
                            Update staff status
                            <select
                              name="toState"
                              defaultValue={item.operatingState}
                            >
                              {staffOperatingStates.map((state) => (
                                <option key={state} value={state}>
                                  {pretty(state)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Reason for change (required)
                            <input
                              name="reason"
                              required
                              maxLength={500}
                              placeholder="What was checked or changed?"
                            />
                          </label>
                          <button type="submit" className="secondary-button">
                            Save internal status
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <div>
                      <h4>Maintenance</h4>
                      {mayReadMaintenance ? (
                        item.orders.length ? (
                          <ul className={styles.orders}>
                            {item.orders.map((order) => (
                              <li key={order.id}>
                                <strong>{order.title}</strong>
                                <span>
                                  {pretty(order.status)} ·{" "}
                                  {pretty(order.priority)}
                                  {order.overdue ? " · Past target" : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>No active work orders linked to this facility.</p>
                        )
                      ) : (
                        <p>Work orders restricted for this role.</p>
                      )}
                      {mayReadMaintenance ? (
                        <Link
                          href={`/workspaces/maintenance/work-orders?campground=${encodeURIComponent(selected.campgroundId)}`}
                        >
                          Update work orders and maintenance notes
                        </Link>
                      ) : null}
                    </div>
                    <div>
                      <h4>What guests can see</h4>
                      {publication.migrationReady ? (
                        <>
                          <p>{guestStatus}</p>
                          {published ? (
                            <>
                              <p>
                                Reviewed:{" "}
                                {shortDate(
                                  item.publication?.service.reviewedAt,
                                ) ?? "Date unavailable"}
                              </p>
                              {item.publication?.service.hoursSummary ? (
                                <p>
                                  Hours: {item.publication.service.hoursSummary}
                                </p>
                              ) : null}
                              {item.publication?.service
                                .accessibilityDetails ? (
                                <p>
                                  Access:{" "}
                                  {
                                    item.publication.service
                                      .accessibilityDetails
                                  }
                                </p>
                              ) : null}
                            </>
                          ) : null}
                          {item.needsGuestReview ? (
                            <p className={styles.review} role="status">
                              {item.conflicting
                                ? "Staff condition differs from the previously published report. Owner review required."
                                : "Published location needs a reviewed guest service update."}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p>
                          Cannot verify published service details until
                          migration 0216 is applied.
                        </p>
                      )}
                      {mayPublish ? (
                        <Link
                          href={`/workspaces/management/campgrounds/maps/wayfinding/services?campground=${encodeURIComponent(selected.campgroundId)}`}
                        >
                          Open owner review and publication
                        </Link>
                      ) : (
                        <p>
                          Ask the campground owner to review any guest notice.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
