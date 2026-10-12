import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { listAccommodations } from "@/lib/accommodations/postgres.mjs";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listCampgroundStructure } from "@/lib/campground-structure/postgres.mjs";

import {
  createAccommodationAction,
  updateAccommodationAction,
  updateCampsiteDetailsAction,
  updateRentalCottageDetailsAction,
} from "./actions";
import styles from "./accommodation-admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accommodation assembly · iCamp",
  description:
    "Manage canonical accommodations, campsite service detail and rental cottage facilities in one interface.",
};

const kindLabels = {
  campsite: "Campsite",
  rental_cottage: "Rental cottage",
  permanent_unit: "Permanent unit",
} as const;

export default async function AccommodationAdministrationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const session = await requireAnyCampgroundPermission(
    "accommodation.read",
    "/workspaces/management/campgrounds/accommodations",
  );
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return authorization?.permissions.includes("accommodation.read") ||
          authorization?.permissions.includes("accommodation.manage")
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const canManage = selected.authorization.permissions.includes(
    "accommodation.manage",
  );

  const [structure, accommodations] = await Promise.all([
    listCampgroundStructure(session.user.id, selected.campgroundId),
    listAccommodations(session.user.id, selected.campgroundId),
  ]);

  if (!structure) {
    redirect("/auth/not-authorized");
  }

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
          <span>Accommodation inventory</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 026</p>
          <h1>Accommodation assembly</h1>
          <p className="hero-panel__lead">
            Put the accommodation system together in one working interface:
            canonical map-linked inventory, campsite service/fit detail and
            rental cottage occupancy, facilities, appliances, accessibility
            and view.
          </p>
        </section>

        <div className={styles.assemblyRail} aria-label="Accommodation model assembly">
          <div className={styles.assemblyStep}>
            <span>Build 024</span>
            <strong>Canonical identity</strong>
            <small>One map-linked parent, lifecycle and shared hooks.</small>
          </div>
          <div className={styles.assemblyStep}>
            <span>Build 025</span>
            <strong>Campsite detail</strong>
            <small>Type, utilities, physical fit and site characteristics.</small>
          </div>
          <div className={styles.assemblyStep}>
            <span>Build 026</span>
            <strong>Cottage detail</strong>
            <small>Sleeping, facilities, climate, appliances and accessibility.</small>
          </div>
        </div>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel" aria-labelledby="scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="accommodation.inventory"
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
              Open inventory
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="inventory-heading">
          <SectionHeading
            eyebrow="Canonical inventory"
            title="Campsites, cottages & permanent units"
            id="inventory-heading"
            helpTopic="accommodation.inventory"
            trailing={<span className="build-chip">Build 026</span>}
          />
          <div className={styles.summaryGrid}>
            <div>
              <strong>{accommodations.length}</strong>
              <span>Total accommodations</span>
            </div>
            <div>
              <strong>
                {
                  accommodations.filter(
                    (item) => item.lifecycleState === "active",
                  ).length
                }
              </strong>
              <span>Active inventory</span>
            </div>
            <div>
              <strong>
                {accommodations.filter((item) => item.subtypeLinked).length}
              </strong>
              <span>Subtype links verified</span>
            </div>
            <div>
              <strong>
                {
                  accommodations.filter(
                    (item) => item.kind === "rental_cottage",
                  ).length
                }
              </strong>
              <span>Rental cottages</span>
            </div>
          </div>

          <div className={styles.cardGrid}>
            {accommodations.map((accommodation) => (
              <article className={styles.card} key={accommodation.id}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className="eyebrow">{kindLabels[accommodation.kind]}</p>
                    <h3>{accommodation.displayName}</h3>
                  </div>
                  <span className={styles.state}>
                    {accommodation.lifecycleState}
                  </span>
                </div>

                <div className={styles.metaGrid}>
                  <div>
                    <span>Code</span>
                    <strong>{accommodation.code}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>
                      {accommodation.sectionName}
                      {accommodation.subsectionName
                        ? " / " + accommodation.subsectionName
                        : ""}
                    </strong>
                  </div>
                  <div>
                    <span>Availability hook</span>
                    <strong>
                      rev {accommodation.availabilityHook.revision} ·{" "}
                      {accommodation.availabilityHook.inventoryEligible
                        ? "eligible"
                        : "not eligible"}
                    </strong>
                  </div>
                  <div>
                    <span>Status hook</span>
                    <strong>rev {accommodation.statusHook.revision}</strong>
                  </div>
                </div>

                {canManage ? (
                  <form
                    action={updateAccommodationAction}
                    className={styles.formGrid}
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
                      <span>Code</span>
                      <input
                        name="code"
                        defaultValue={accommodation.code}
                        maxLength={64}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Name</span>
                      <input
                        name="displayName"
                        defaultValue={accommodation.displayName}
                        maxLength={160}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Section</span>
                      <select
                        name="sectionId"
                        defaultValue={accommodation.sectionId}
                      >
                        {structure.sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Subsection</span>
                      <select
                        name="subsectionId"
                        defaultValue={accommodation.subsectionId ?? ""}
                      >
                        <option value="">None</option>
                        {structure.sections.flatMap((section) =>
                          section.subsections.map((subsection) => (
                            <option key={subsection.id} value={subsection.id}>
                              {section.name} / {subsection.name}
                            </option>
                          )),
                        )}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Lifecycle</span>
                      <select
                        name="lifecycleState"
                        defaultValue={accommodation.lifecycleState}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <div className={styles.actions}>
                      <button className="primary-button" type="submit">
                        Save accommodation
                      </button>
                    </div>
                  </form>
                ) : null}

                {accommodation.campsiteDetails ? (
                  <section
                    className={styles.detailPanel}
                    aria-label="Campsite type, utilities and fit"
                  >
                    <SectionHeading
                      eyebrow="Build 025"
                      title="Campsite type, utilities & fit"
                      id={"campsite-services-" + accommodation.id}
                      helpTopic="campsite.services"
                    />
                    <div className={styles.metaGrid}>
                      <div>
                        <span>Type / service</span>
                        <strong>
                          {accommodation.campsiteDetails.campsiteType} ·{" "}
                          {accommodation.campsiteDetails.serviceLevel}
                        </strong>
                      </div>
                      <div>
                        <span>Stay profile</span>
                        <strong>
                          {accommodation.campsiteDetails.stayProfile.replace(
                            "_",
                            "-",
                          )}
                          {accommodation.campsiteDetails.isWaterfront
                            ? " · waterfront"
                            : ""}
                        </strong>
                      </div>
                      <div>
                        <span>Utilities</span>
                        <strong>
                          {accommodation.campsiteDetails.electricalAmperage > 0
                            ? accommodation.campsiteDetails.electricalAmperage +
                              "A"
                            : "no electric"}{" "}
                          · water {accommodation.campsiteDetails.waterService} ·
                          waste{" "}
                          {accommodation.campsiteDetails.wastewaterService} ·
                          Wi-Fi {accommodation.campsiteDetails.wifiService}
                        </strong>
                      </div>
                      <div>
                        <span>Site / RV fit</span>
                        <strong>
                          {accommodation.campsiteDetails.siteLengthMeters ??
                            "?"}
                          m ×{" "}
                          {accommodation.campsiteDetails.siteWidthMeters ?? "?"}
                          m · RV max{" "}
                          {accommodation.campsiteDetails.maxRvLengthMeters ??
                            "?"}
                          m
                        </strong>
                      </div>
                    </div>

                    {canManage ? (
                      <form
                        action={updateCampsiteDetailsAction}
                        className={styles.formGrid}
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
                          name="detailRowVersion"
                          value={accommodation.campsiteDetails.rowVersion}
                        />
                        <label className={styles.field}>
                          <span>Campsite type</span>
                          <select
                            name="campsiteType"
                            defaultValue={
                              accommodation.campsiteDetails.campsiteType
                            }
                          >
                            <option value="tent">Tent</option>
                            <option value="rv">RV</option>
                            <option value="mixed">Mixed tent / RV</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Service level</span>
                          <select
                            name="serviceLevel"
                            defaultValue={
                              accommodation.campsiteDetails.serviceLevel
                            }
                          >
                            <option value="unserviced">Unserviced</option>
                            <option value="partial">Partially serviced</option>
                            <option value="serviced">Serviced</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Stay profile</span>
                          <select
                            name="stayProfile"
                            defaultValue={
                              accommodation.campsiteDetails.stayProfile
                            }
                          >
                            <option value="transient">Transient</option>
                            <option value="seasonal">Seasonal</option>
                            <option value="yearly">Yearly</option>
                            <option value="walk_up">Walk-up</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Electrical service</span>
                          <select
                            name="electricalAmperage"
                            defaultValue={
                              accommodation.campsiteDetails.electricalAmperage
                            }
                          >
                            <option value="0">None</option>
                            <option value="15">15A</option>
                            <option value="20">20A</option>
                            <option value="30">30A</option>
                            <option value="50">50A</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Water</span>
                          <select
                            name="waterService"
                            defaultValue={
                              accommodation.campsiteDetails.waterService
                            }
                          >
                            <option value="none">None</option>
                            <option value="shared">Shared nearby</option>
                            <option value="site">At site</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Sewer / septic</span>
                          <select
                            name="wastewaterService"
                            defaultValue={
                              accommodation.campsiteDetails.wastewaterService
                            }
                          >
                            <option value="none">None</option>
                            <option value="sewer">Sewer</option>
                            <option value="septic">Septic</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Wi-Fi</span>
                          <select
                            name="wifiService"
                            defaultValue={
                              accommodation.campsiteDetails.wifiService
                            }
                          >
                            <option value="none">None</option>
                            <option value="shared">Shared coverage</option>
                            <option value="site">At site</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Site length (m)</span>
                          <input
                            name="siteLengthMeters"
                            type="number"
                            min="0.01"
                            max="500"
                            step="0.01"
                            defaultValue={
                              accommodation.campsiteDetails.siteLengthMeters ??
                              ""
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Site width (m)</span>
                          <input
                            name="siteWidthMeters"
                            type="number"
                            min="0.01"
                            max="500"
                            step="0.01"
                            defaultValue={
                              accommodation.campsiteDetails.siteWidthMeters ??
                              ""
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Max RV length (m)</span>
                          <input
                            name="maxRvLengthMeters"
                            type="number"
                            min="0.01"
                            max="500"
                            step="0.01"
                            defaultValue={
                              accommodation.campsiteDetails.maxRvLengthMeters ??
                              ""
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Max RV width (m)</span>
                          <input
                            name="maxRvWidthMeters"
                            type="number"
                            min="0.01"
                            max="500"
                            step="0.01"
                            defaultValue={
                              accommodation.campsiteDetails.maxRvWidthMeters ??
                              ""
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Max RV height (m)</span>
                          <input
                            name="maxRvHeightMeters"
                            type="number"
                            min="0.01"
                            max="500"
                            step="0.01"
                            defaultValue={
                              accommodation.campsiteDetails.maxRvHeightMeters ??
                              ""
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Surface</span>
                          <select
                            name="surfaceType"
                            defaultValue={
                              accommodation.campsiteDetails.surfaceType
                            }
                          >
                            <option value="natural">Natural</option>
                            <option value="grass">Grass</option>
                            <option value="gravel">Gravel</option>
                            <option value="paved">Paved</option>
                            <option value="concrete">Concrete</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Shade</span>
                          <select
                            name="shadeLevel"
                            defaultValue={
                              accommodation.campsiteDetails.shadeLevel
                            }
                          >
                            <option value="none">None</option>
                            <option value="partial">Partial</option>
                            <option value="full">Full</option>
                          </select>
                        </label>
                        <div className={styles.checkGrid}>
                          <label>
                            <input
                              type="checkbox"
                              name="isWaterfront"
                              defaultChecked={
                                accommodation.campsiteDetails.isWaterfront
                              }
                            />
                            Waterfront
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="pullThrough"
                              defaultChecked={
                                accommodation.campsiteDetails.pullThrough
                              }
                            />
                            Pull-through
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="hasFireRing"
                              defaultChecked={
                                accommodation.campsiteDetails.hasFireRing
                              }
                            />
                            Fire ring
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="hasPicnicTable"
                              defaultChecked={
                                accommodation.campsiteDetails.hasPicnicTable
                              }
                            />
                            Picnic table
                          </label>
                        </div>
                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Save campsite details
                          </button>
                        </div>
                      </form>
                    ) : null}
                    <p className={styles.boundary}>
                      These physical/service facts feed later compatibility and
                      booking builds; Build 034 remains authoritative for
                      reservation compatibility.
                    </p>
                  </section>
                ) : accommodation.cottageDetails ? (
                  <section
                    className={styles.detailPanel}
                    aria-label="Rental cottage occupancy, facilities and accessibility"
                  >
                    <SectionHeading
                      eyebrow="Build 026"
                      title="Rental cottage facilities & occupancy"
                      id={"cottage-services-" + accommodation.id}
                      helpTopic="cottage.facilities"
                    />
                    <div className={styles.metaGrid}>
                      <div>
                        <span>Style / occupancy</span>
                        <strong>
                          {accommodation.cottageDetails.cottageStyle} · up to{" "}
                          {accommodation.cottageDetails.maxOccupancy} guests
                        </strong>
                      </div>
                      <div>
                        <span>Sleeping</span>
                        <strong>
                          {accommodation.cottageDetails.bedroomCount} bedrooms ·{" "}
                          {accommodation.cottageDetails.bedCount} beds
                        </strong>
                      </div>
                      <div>
                        <span>Facilities</span>
                        <strong>
                          {accommodation.cottageDetails.kitchenType} kitchen ·{" "}
                          {accommodation.cottageDetails.washroomType} washroom ·{" "}
                          {accommodation.cottageDetails.showerType} shower
                        </strong>
                      </div>
                      <div>
                        <span>Climate / view</span>
                        <strong>
                          heat {accommodation.cottageDetails.heatingType.replace(
                            "_",
                            " ",
                          )}{" "}
                          · cooling{" "}
                          {accommodation.cottageDetails.coolingType.replace(
                            "_",
                            " ",
                          )}{" "}
                          · {accommodation.cottageDetails.viewType} view
                        </strong>
                      </div>
                    </div>

                    {canManage ? (
                      <form
                        action={updateRentalCottageDetailsAction}
                        className={styles.formGrid}
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
                          name="detailRowVersion"
                          value={accommodation.cottageDetails.rowVersion}
                        />

                        <label className={styles.field}>
                          <span>Cottage style</span>
                          <select
                            name="cottageStyle"
                            defaultValue={accommodation.cottageDetails.cottageStyle}
                          >
                            <option value="rustic">Rustic</option>
                            <option value="serviced">Serviced</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Bedrooms</span>
                          <input
                            type="number"
                            name="bedroomCount"
                            min={0}
                            max={20}
                            defaultValue={accommodation.cottageDetails.bedroomCount}
                            required
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Beds</span>
                          <input
                            type="number"
                            name="bedCount"
                            min={1}
                            max={40}
                            defaultValue={accommodation.cottageDetails.bedCount}
                            required
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Maximum occupancy</span>
                          <input
                            type="number"
                            name="maxOccupancy"
                            min={1}
                            max={80}
                            defaultValue={accommodation.cottageDetails.maxOccupancy}
                            required
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Kitchen</span>
                          <select
                            name="kitchenType"
                            defaultValue={accommodation.cottageDetails.kitchenType}
                          >
                            <option value="none">None</option>
                            <option value="kitchenette">Kitchenette</option>
                            <option value="full">Full kitchen</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Washroom</span>
                          <select
                            name="washroomType"
                            defaultValue={accommodation.cottageDetails.washroomType}
                          >
                            <option value="none">None</option>
                            <option value="shared">Shared</option>
                            <option value="private">Private</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Shower</span>
                          <select
                            name="showerType"
                            defaultValue={accommodation.cottageDetails.showerType}
                          >
                            <option value="none">None</option>
                            <option value="shared">Shared</option>
                            <option value="private">Private</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Heating</span>
                          <select
                            name="heatingType"
                            defaultValue={accommodation.cottageDetails.heatingType}
                          >
                            <option value="none">None</option>
                            <option value="electric">Electric</option>
                            <option value="propane">Propane</option>
                            <option value="wood">Wood</option>
                            <option value="heat_pump">Heat pump</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Cooling</span>
                          <select
                            name="coolingType"
                            defaultValue={accommodation.cottageDetails.coolingType}
                          >
                            <option value="none">None</option>
                            <option value="fan">Fan</option>
                            <option value="window_ac">Window A/C</option>
                            <option value="central_ac">Central A/C</option>
                            <option value="heat_pump">Heat pump</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>View</span>
                          <select
                            name="viewType"
                            defaultValue={accommodation.cottageDetails.viewType}
                          >
                            <option value="none">No advertised view</option>
                            <option value="woodland">Woodland</option>
                            <option value="waterfront">Waterfront</option>
                            <option value="lake">Lake</option>
                            <option value="river">River</option>
                            <option value="ocean">Ocean</option>
                            <option value="mountain">Mountain</option>
                            <option value="garden">Garden</option>
                            <option value="other">Other</option>
                          </select>
                        </label>

                        <div className={styles.checkGrid}>
                          <label>
                            <input
                              type="checkbox"
                              name="hasRefrigerator"
                              defaultChecked={
                                accommodation.cottageDetails.hasRefrigerator
                              }
                            />
                            Refrigerator
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="hasCooktop"
                              defaultChecked={accommodation.cottageDetails.hasCooktop}
                            />
                            Cooktop
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="hasOven"
                              defaultChecked={accommodation.cottageDetails.hasOven}
                            />
                            Oven
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="hasMicrowave"
                              defaultChecked={
                                accommodation.cottageDetails.hasMicrowave
                              }
                            />
                            Microwave
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="stepFreeAccess"
                              defaultChecked={
                                accommodation.cottageDetails.stepFreeAccess
                              }
                            />
                            Step-free access
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="accessibleWashroom"
                              defaultChecked={
                                accommodation.cottageDetails.accessibleWashroom
                              }
                            />
                            Accessible washroom
                          </label>
                        </div>
                        <div className={styles.actions}>
                          <button className="primary-button" type="submit">
                            Save cottage details
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <p className={styles.boundary}>
                      These physical cottage facts feed later capacity and
                      compatibility builds. Build 033 owns capacity rules and
                      Build 034 remains authoritative for reservation
                      compatibility.
                    </p>
                  </section>
                ) : (
                  <p className={styles.boundary}>
                    Ownership and transfer detail remains in later
                    permanent-unit builds.
                  </p>
                )}
              </article>
            ))}

            {accommodations.length === 0 ? (
              <p className={styles.empty}>
                No canonical accommodations exist in this campground yet.
              </p>
            ) : null}
          </div>
        </section>

        {canManage ? (
          <section className="content-panel" aria-labelledby="create-heading">
            <SectionHeading
              eyebrow="Inventory setup"
              title="Create accommodation"
              id="create-heading"
              helpTopic="accommodation.inventory"
            />
            <p>
              If a compatible unclaimed Build 023 map identity already uses the
              same code and section, iCamp links it automatically. Otherwise a
              matching canonical map identity is created in the same
              transaction.
            </p>
            <form
              action={createAccommodationAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Kind</span>
                <select name="kind" defaultValue="campsite">
                  <option value="campsite">Campsite</option>
                  <option value="rental_cottage">Rental cottage</option>
                  <option value="permanent_unit">Permanent unit</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Code</span>
                <input name="code" maxLength={64} placeholder="P-01" required />
              </label>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  name="displayName"
                  maxLength={160}
                  placeholder="Pine Site 01"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Section</span>
                <select name="sectionId" required>
                  {structure.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Subsection</span>
                <select name="subsectionId" defaultValue="">
                  <option value="">None</option>
                  {structure.sections.flatMap((section) =>
                    section.subsections.map((subsection) => (
                      <option key={subsection.id} value={subsection.id}>
                        {section.name} / {subsection.name}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Create accommodation
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
            title="Map & structure"
            id="connections-heading"
            helpTopic="accommodation.inventory"
          />
          <div className={styles.linkRow}>
            <Link
              className="primary-link primary-link--dark"
              href={`/workspaces/management/campgrounds?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Campground structure
            </Link>
            <Link
              className="primary-link primary-link--dark"
              href={`/workspaces/management/campgrounds/maps/coordinate-engine?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Canonical map objects
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
            sectionKey="management.accommodation-inventory"
          />
        </section>
      </div>
    </AppShell>
  );
}
