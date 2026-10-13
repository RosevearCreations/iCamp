import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listCampgroundStructure } from "@/lib/campground-structure/postgres.mjs";
import {
  listOperationalAssets,
  listOperationalMapObjects,
} from "@/lib/operational-assets/postgres.mjs";

import {
  createEquipmentAction,
  createFacilityAction,
  updateOperationalAssetAction,
} from "./actions";
import styles from "./asset-admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operational assets & equipment · iCamp",
  description:
    "Manage campground facilities, infrastructure, equipment and fleet in one map-aware operations workbench.",
};

const facilityLabels: Record<string, string> = {
  pool: "Pool",
  water_park: "Water park",
  washroom: "Washroom",
  sports_field: "Sports field",
  playground: "Playground",
  hall: "Hall",
  beach: "Beach",
  dock: "Dock",
  launch: "Boat launch",
  road: "Road",
  parking: "Parking",
  gate: "Gate",
  building: "Building",
  garbage_area: "Garbage area",
  septic_area: "Septic area",
  utility: "Utility",
  other: "Other facility",
};

const equipmentLabels: Record<string, string> = {
  tractor: "Tractor",
  mower: "Mower",
  maintenance_vehicle: "Maintenance vehicle",
  cart: "Cart",
  trailer: "Trailer",
  power_equipment: "Power equipment",
  watercraft: "Watercraft",
  other: "Other equipment",
};

function OperatingStateSelect({ value }: Readonly<{ value: string }>) {
  return (
    <select name="operatingState" defaultValue={value}>
      <option value="unknown">Unknown</option>
      <option value="operational">Operational</option>
      <option value="limited">Limited</option>
      <option value="unavailable">Unavailable</option>
      <option value="seasonal">Seasonal</option>
    </select>
  );
}

export default async function OperationalAssetsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/assets";
  const session = await requireAnyCampgroundPermission("asset.read", path);
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
        return permissions.some((permission) =>
          [
            "asset.read",
            "asset.manage",
            "equipment.read",
            "equipment.manage",
          ].includes(permission),
        )
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const permissions = selected.authorization?.permissions ?? [];
  const canManageFacilities = permissions.includes("asset.manage");
  const canManageEquipment = permissions.includes("equipment.manage");

  const [structure, assets, mapObjects] = await Promise.all([
    listCampgroundStructure(session.user.id, selected.campgroundId),
    listOperationalAssets(session.user.id, selected.campgroundId),
    listOperationalMapObjects(session.user.id, selected.campgroundId),
  ]);
  if (!structure) redirect("/auth/not-authorized");

  const facilities = assets.filter((asset) => asset.assetClass === "facility");
  const equipment = assets.filter((asset) => asset.assetClass === "equipment");

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
          <span>Operational assets</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 029</p>
          <h1>Operational assets &amp; equipment</h1>
          <p className="hero-panel__lead">
            One campground workbench for facilities, infrastructure, equipment
            and fleet: map linkage, ownership and meter facts, plus a current
            operating-state hook ready for later maintenance and status flows.
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
            helpTopic="asset.inventory"
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
              Open campground
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="overview-heading">
          <SectionHeading
            eyebrow="Operations workbench"
            title="Asset readiness overview"
            id="overview-heading"
            helpTopic="asset.inventory"
            trailing={<span className="build-chip">Build 029</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Facilities</span>
              <strong>{facilities.length}</strong>
            </div>
            <div>
              <span>Equipment / fleet</span>
              <strong>{equipment.length}</strong>
            </div>
            <div>
              <span>Unavailable / limited</span>
              <strong>
                {
                  assets.filter((asset) =>
                    ["limited", "unavailable"].includes(asset.operatingState),
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Map-linked</span>
              <strong>
                {assets.filter((asset) => asset.mapObjectId !== null).length}
              </strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Build 029 records the current operating-state hook and revision.
            Build 030 remains authoritative for status history, transition
            rules, holds, maintenance closure and other state-machine behavior.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="inventory-heading">
          <SectionHeading
            eyebrow="Canonical inventory"
            title="Facilities, equipment & fleet"
            id="inventory-heading"
            helpTopic="asset.inventory"
          />
          <div className={styles.cardGrid}>
            {assets.map((asset) => {
              const canManage =
                asset.assetClass === "facility"
                  ? canManageFacilities
                  : canManageEquipment;
              return (
                <article className={styles.assetCard} key={asset.id}>
                  <header className={styles.cardHeader}>
                    <div>
                      <span className={styles.kicker}>
                        {asset.assetClass === "facility"
                          ? facilityLabels[
                              asset.facility?.facilityType ?? "other"
                            ]
                          : equipmentLabels[
                              asset.equipment?.equipmentType ?? "other"
                            ]}
                      </span>
                      <h3>{asset.displayName}</h3>
                      <small>{asset.code}</small>
                    </div>
                    <span className={styles.state}>
                      {asset.operatingState.replaceAll("_", " ")}
                    </span>
                  </header>
                  <dl className={styles.factGrid}>
                    <div>
                      <dt>Section</dt>
                      <dd>{asset.sectionName ?? "Property-wide / mobile"}</dd>
                    </div>
                    <div>
                      <dt>Map identity</dt>
                      <dd>
                        {asset.mapObjectId
                          ? (asset.mapObjectKind ?? "asset") +
                            " · " +
                            (asset.mapBound ? "placed" : "identity ready")
                          : "Not map-linked"}
                      </dd>
                    </div>
                    <div>
                      <dt>Status revision</dt>
                      <dd>{asset.statusRevision}</dd>
                    </div>
                    {asset.equipment ? (
                      <>
                        <div>
                          <dt>Make / model</dt>
                          <dd>
                            {[asset.equipment.make, asset.equipment.model]
                              .filter(Boolean)
                              .join(" ") || "Not recorded"}
                          </dd>
                        </div>
                        <div>
                          <dt>Ownership</dt>
                          <dd>{asset.equipment.ownershipType}</dd>
                        </div>
                        <div>
                          <dt>Meter</dt>
                          <dd>
                            {asset.equipment.meterKind === "none"
                              ? "No meter"
                              : String(asset.equipment.meterValue ?? 0) +
                                " " +
                                asset.equipment.meterKind.replaceAll("_", " ")}
                          </dd>
                        </div>
                      </>
                    ) : null}
                  </dl>

                  {canManage ? (
                    <form
                      action={updateOperationalAssetAction}
                      className={styles.formGrid}
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
                        <span>Code</span>
                        <input
                          name="code"
                          defaultValue={asset.code}
                          maxLength={64}
                          required
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Name</span>
                        <input
                          name="displayName"
                          defaultValue={asset.displayName}
                          maxLength={160}
                          required
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Lifecycle</span>
                        <select
                          name="lifecycleState"
                          defaultValue={asset.lifecycleState}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Operating state</span>
                        <OperatingStateSelect value={asset.operatingState} />
                      </label>
                      {asset.facility ? (
                        <label className={styles.field}>
                          <span>Guest publication readiness</span>
                          <select
                            name="guestVisibility"
                            defaultValue={asset.facility.guestVisibility}
                          >
                            <option value="internal">Internal only</option>
                            <option value="public_candidate">
                              Public candidate
                            </option>
                          </select>
                        </label>
                      ) : null}
                      {asset.equipment ? (
                        <>
                          <label className={styles.field}>
                            <span>Make</span>
                            <input
                              name="make"
                              defaultValue={asset.equipment.make}
                              maxLength={120}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Model</span>
                            <input
                              name="model"
                              defaultValue={asset.equipment.model}
                              maxLength={120}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Serial number</span>
                            <input
                              name="serialNumber"
                              defaultValue={asset.equipment.serialNumber}
                              maxLength={160}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Ownership</span>
                            <select
                              name="ownershipType"
                              defaultValue={asset.equipment.ownershipType}
                            >
                              <option value="owned">Owned</option>
                              <option value="leased">Leased</option>
                              <option value="rented">Rented</option>
                              <option value="loaned">Loaned</option>
                              <option value="contractor">Contractor</option>
                              <option value="other">Other</option>
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Meter</span>
                            <select
                              name="meterKind"
                              defaultValue={asset.equipment.meterKind}
                            >
                              <option value="none">None</option>
                              <option value="hours">Hours</option>
                              <option value="odometer_km">Odometer km</option>
                              <option value="cycles">Cycles</option>
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Meter reading</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              name="meterReading"
                              defaultValue={asset.equipment.meterValue ?? ""}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Storage / home location</span>
                            <input
                              name="storageLocation"
                              defaultValue={asset.equipment.storageLocation}
                              maxLength={240}
                            />
                          </label>
                        </>
                      ) : null}
                      <label className={styles.field + " " + styles.full}>
                        <span>Operations note</span>
                        <textarea
                          name="notes"
                          defaultValue={asset.notes}
                          maxLength={2000}
                        />
                      </label>
                      <div className={styles.actions + " " + styles.full}>
                        <button className="primary-button" type="submit">
                          Save asset
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
            {assets.length === 0 ? (
              <p className={styles.empty}>
                No operational facilities or equipment are registered yet.
              </p>
            ) : null}
          </div>
        </section>

        {canManageFacilities ? (
          <section className="content-panel" aria-labelledby="create-facility">
            <SectionHeading
              eyebrow="Facility inventory"
              title="Add operational facility"
              id="create-facility"
              helpTopic="asset.inventory"
            />
            <p>
              Leave map identity blank to create the matching Build 023
              canonical identity automatically.
            </p>
            <form action={createFacilityAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Facility type</span>
                <select name="facilityType" defaultValue="pool">
                  {Object.entries(facilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Code</span>
                <input name="code" maxLength={64} required />
              </label>
              <label className={styles.field}>
                <span>Name</span>
                <input name="displayName" maxLength={160} required />
              </label>
              <label className={styles.field}>
                <span>Section</span>
                <select name="sectionId" defaultValue="">
                  <option value="">Property-wide</option>
                  {structure.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Existing map identity</span>
                <select name="mapObjectId" defaultValue="">
                  <option value="">
                    Create matching identity automatically
                  </option>
                  {mapObjects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.code} · {object.displayName} · {object.objectKind}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Operating state</span>
                <OperatingStateSelect value="unknown" />
              </label>
              <label className={styles.field}>
                <span>Guest publication readiness</span>
                <select name="guestVisibility" defaultValue="internal">
                  <option value="internal">Internal only</option>
                  <option value="public_candidate">Public candidate</option>
                </select>
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Operations note</span>
                <textarea name="notes" maxLength={2000} />
              </label>
              <div className={styles.actions + " " + styles.full}>
                <button className="primary-button" type="submit">
                  Add facility
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {canManageEquipment ? (
          <section className="content-panel" aria-labelledby="create-equipment">
            <SectionHeading
              eyebrow="Equipment & fleet"
              title="Add equipment or vehicle"
              id="create-equipment"
              helpTopic="asset.inventory"
            />
            <form action={createEquipmentAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Equipment type</span>
                <select name="equipmentType" defaultValue="tractor">
                  {Object.entries(equipmentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Code</span>
                <input name="code" maxLength={64} required />
              </label>
              <label className={styles.field}>
                <span>Name</span>
                <input name="displayName" maxLength={160} required />
              </label>
              <label className={styles.field}>
                <span>Section / home area</span>
                <select name="sectionId" defaultValue="">
                  <option value="">Mobile / property-wide</option>
                  {structure.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Optional map identity</span>
                <select name="mapObjectId" defaultValue="">
                  <option value="">Not map-linked</option>
                  {mapObjects
                    .filter((object) => object.objectKind === "asset")
                    .map((object) => (
                      <option key={object.id} value={object.id}>
                        {object.code} · {object.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Operating state</span>
                <OperatingStateSelect value="unknown" />
              </label>
              <label className={styles.field}>
                <span>Make</span>
                <input name="make" maxLength={120} />
              </label>
              <label className={styles.field}>
                <span>Model</span>
                <input name="model" maxLength={120} />
              </label>
              <label className={styles.field}>
                <span>Serial number</span>
                <input name="serialNumber" maxLength={160} />
              </label>
              <label className={styles.field}>
                <span>Ownership</span>
                <select name="ownershipType" defaultValue="owned">
                  <option value="owned">Owned</option>
                  <option value="leased">Leased</option>
                  <option value="rented">Rented</option>
                  <option value="loaned">Loaned</option>
                  <option value="contractor">Contractor</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Meter</span>
                <select name="meterKind" defaultValue="none">
                  <option value="none">None</option>
                  <option value="hours">Hours</option>
                  <option value="odometer_km">Odometer km</option>
                  <option value="cycles">Cycles</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Meter reading</span>
                <input type="number" min="0" step="0.01" name="meterReading" />
              </label>
              <label className={styles.field}>
                <span>Storage / home location</span>
                <input name="storageLocation" maxLength={240} />
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Operations note</span>
                <textarea name="notes" maxLength={2000} />
              </label>
              <div className={styles.actions + " " + styles.full}>
                <button className="primary-button" type="submit">
                  Add equipment
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section
          className="content-panel"
          aria-labelledby="connections-heading"
        >
          <SectionHeading
            eyebrow="Connected foundations"
            title="Map, maintenance & public-web boundaries"
            id="connections-heading"
            helpTopic="asset.inventory"
          />
          <p>
            Facilities connect to Build 023 map identities; equipment may remain
            mobile. Public-candidate is only a readiness flag—authenticated
            operations data remains non-indexable and is never made public by
            this build.
          </p>
          <div className={styles.linkRow}>
            <Link
              className="primary-link primary-link--dark"
              href={
                "/workspaces/management/campgrounds/maps/coordinate-engine?campground=" +
                encodeURIComponent(selected.campgroundId)
              }
            >
              Open canonical map objects
            </Link>
            <Link className="primary-link primary-link--dark" href="/help">
              Open contextual help
            </Link>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Administrative tracking"
            title="Data freshness and refresh"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={new Date().toISOString()}
            sectionKey="management.operational-assets"
          />
        </section>
      </div>
    </AppShell>
  );
}
