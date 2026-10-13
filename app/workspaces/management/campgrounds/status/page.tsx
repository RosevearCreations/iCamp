import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { listAccommodations } from "@/lib/accommodations/postgres.mjs";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listOperationalAssets } from "@/lib/operational-assets/postgres.mjs";
import {
  accommodationStatusStates,
  listAccommodationStatusHistory,
  listOperationalAssetStatusHistory,
  operationalAssetStatusStates,
} from "@/lib/status-engine/postgres.mjs";

import {
  transitionAccommodationStatusAction,
  transitionOperationalAssetStatusAction,
} from "./actions";
import styles from "./status-admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accommodation & asset status · iCamp",
  description:
    "Manage current accommodation, facility, equipment and fleet states with server-enforced transitions and durable history.",
};

function stateLabel(value: string) {
  return value.replaceAll("_", " ");
}

function when(value: string) {
  return value.replace("T", " ").slice(0, 16) + " UTC";
}

export default async function CampgroundStatusPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/status";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions = authorization?.permissions ?? [];
        const visible = permissions.some((permission) =>
          [
            "accommodation.read",
            "accommodation.manage",
            "asset.read",
            "asset.manage",
            "equipment.read",
            "equipment.manage",
          ].includes(permission),
        );
        return visible ? { ...campground, authorization } : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const permissions = selected.authorization?.permissions ?? [];
  const canReadAccommodations =
    permissions.includes("accommodation.read") ||
    permissions.includes("accommodation.manage");
  const canManageAccommodations = permissions.includes("accommodation.manage");
  const canReadAssets = permissions.some((permission) =>
    [
      "asset.read",
      "asset.manage",
      "equipment.read",
      "equipment.manage",
    ].includes(permission),
  );

  const [accommodations, assets, accommodationHistory, assetHistory] =
    await Promise.all([
      canReadAccommodations
        ? listAccommodations(session.user.id, selected.campgroundId)
        : Promise.resolve([]),
      canReadAssets
        ? listOperationalAssets(session.user.id, selected.campgroundId)
        : Promise.resolve([]),
      canReadAccommodations
        ? listAccommodationStatusHistory(session.user.id, selected.campgroundId)
        : Promise.resolve([]),
      canReadAssets
        ? listOperationalAssetStatusHistory(
            session.user.id,
            selected.campgroundId,
          )
        : Promise.resolve([]),
    ]);

  const accommodationAttention = accommodations.filter((item) =>
    ["inspection", "maintenance", "winterized", "closed"].includes(
      item.statusState,
    ),
  ).length;
  const assetAttention = assets.filter((item) =>
    ["limited", "inspection", "maintenance", "unavailable", "closed"].includes(
      item.operatingState,
    ),
  ).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management">Management</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <span>Status engine</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 030</p>
          <h1>Accommodation &amp; asset status engine</h1>
          <p className="hero-panel__lead">
            One control centre for current campground operating state. Every
            change is checked by PostgreSQL transition rules, advances the
            relevant revision and leaves durable status history.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel" aria-labelledby="scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="status.engine"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open status control
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Current state"
            title="Status overview"
            id="summary-heading"
            helpTopic="status.engine"
            trailing={<span className="build-chip">Build 030</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Accommodations</span>
              <strong>{accommodations.length}</strong>
            </div>
            <div>
              <span>Accommodation attention</span>
              <strong>{accommodationAttention}</strong>
            </div>
            <div>
              <span>Operational assets</span>
              <strong>{assets.length}</strong>
            </div>
            <div>
              <span>Asset attention</span>
              <strong>{assetAttention}</strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Build 030 owns current states, transition rules and append-only
            history. Build 031 will add dated management closures, bulk holds
            and map-publication overrides rather than hiding those future rules
            inside this engine.
          </p>
        </section>

        {canReadAccommodations ? (
          <section
            className="content-panel"
            aria-labelledby="accommodation-status-heading"
          >
            <SectionHeading
              eyebrow="Accommodation operations"
              title="Campsite, cottage & permanent-unit status"
              id="accommodation-status-heading"
              helpTopic="status.engine"
            />
            <div className={styles.statusGrid}>
              {accommodations.map((accommodation) => (
                <article className={styles.statusCard} key={accommodation.id}>
                  <header className={styles.cardHeader}>
                    <div>
                      <p className={styles.kicker}>
                        {accommodation.kind.replaceAll("_", " ")} ·{" "}
                        {accommodation.code}
                      </p>
                      <h3>{accommodation.displayName}</h3>
                    </div>
                    <span className={styles.state}>
                      {stateLabel(accommodation.statusState)}
                    </span>
                  </header>
                  <p>
                    Status rev {accommodation.statusRevision} · Availability rev{" "}
                    {accommodation.availabilityRevision}
                  </p>
                  {canManageAccommodations ? (
                    <form
                      action={transitionAccommodationStatusAction}
                      className={styles.transitionForm}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="accommodationId"
                        value={accommodation.id}
                      />
                      <input
                        type="hidden"
                        name="rowVersion"
                        value={accommodation.rowVersion}
                      />
                      <label className={styles.field}>
                        <span>Next state</span>
                        <select name="toState" required>
                          {accommodationStatusStates
                            .filter(
                              (status) => status !== accommodation.statusState,
                            )
                            .map((status) => (
                              <option key={status} value={status}>
                                {stateLabel(status)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Reason / operations note</span>
                        <input name="reason" maxLength={500} />
                      </label>
                      <button className="primary-button" type="submit">
                        Change status
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
              {accommodations.length === 0 ? (
                <p className={styles.empty}>
                  No accommodation inventory is visible for this campground.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {canReadAssets ? (
          <section
            className="content-panel"
            aria-labelledby="asset-status-heading"
          >
            <SectionHeading
              eyebrow="Operational inventory"
              title="Facility, equipment & fleet status"
              id="asset-status-heading"
              helpTopic="status.engine"
            />
            <div className={styles.statusGrid}>
              {assets.map((asset) => {
                const canManage =
                  asset.assetClass === "equipment"
                    ? permissions.includes("equipment.manage")
                    : permissions.includes("asset.manage");
                return (
                  <article className={styles.statusCard} key={asset.id}>
                    <header className={styles.cardHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {asset.assetClass} · {asset.code}
                        </p>
                        <h3>{asset.displayName}</h3>
                      </div>
                      <span className={styles.state}>
                        {stateLabel(asset.operatingState)}
                      </span>
                    </header>
                    <p>Status rev {asset.statusRevision}</p>
                    {canManage ? (
                      <form
                        action={transitionOperationalAssetStatusAction}
                        className={styles.transitionForm}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input type="hidden" name="assetId" value={asset.id} />
                        <input
                          type="hidden"
                          name="assetClass"
                          value={asset.assetClass}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={asset.rowVersion}
                        />
                        <label className={styles.field}>
                          <span>Next state</span>
                          <select name="toState" required>
                            {operationalAssetStatusStates
                              .filter(
                                (status) => status !== asset.operatingState,
                              )
                              .map((status) => (
                                <option key={status} value={status}>
                                  {stateLabel(status)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Reason / operations note</span>
                          <input name="reason" maxLength={500} />
                        </label>
                        <button className="primary-button" type="submit">
                          Change status
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
              {assets.length === 0 ? (
                <p className={styles.empty}>
                  No operational facilities or equipment are visible for this
                  campground.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="history-heading">
          <SectionHeading
            eyebrow="Evidence"
            title="Recent status history"
            id="history-heading"
            helpTopic="status.engine"
          />
          <div className={styles.historyGrid}>
            {accommodationHistory.slice(0, 20).map((event) => (
              <article className={styles.historyItem} key={event.id}>
                <small>Accommodation · {when(event.changedAt)}</small>
                <strong>
                  {event.displayName} · {event.code}
                </strong>
                <p>
                  {event.fromState ? stateLabel(event.fromState) : "baseline"}
                  {" → "}
                  {stateLabel(event.toState)} · rev {event.statusRevision}
                </p>
                {event.reason ? <p>{event.reason}</p> : null}
              </article>
            ))}
            {assetHistory.slice(0, 20).map((event) => (
              <article className={styles.historyItem} key={event.id}>
                <small>
                  {event.assetClass} · {when(event.changedAt)}
                </small>
                <strong>
                  {event.displayName} · {event.code}
                </strong>
                <p>
                  {event.fromState ? stateLabel(event.fromState) : "baseline"}
                  {" → "}
                  {stateLabel(event.toState)} · rev {event.statusRevision}
                </p>
                {event.reason ? <p>{event.reason}</p> : null}
              </article>
            ))}
            {accommodationHistory.length === 0 && assetHistory.length === 0 ? (
              <p className={styles.empty}>
                Status history will appear here as campground inventory enters
                or changes state.
              </p>
            ) : null}
          </div>
        </section>

        <div className={styles.linkRow}>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/accommodations?campground=" +
              encodeURIComponent(selected.campgroundId)
            }
          >
            Accommodation workbench
          </Link>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/assets?campground=" +
              encodeURIComponent(selected.campgroundId)
            }
          >
            Operational assets workbench
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
