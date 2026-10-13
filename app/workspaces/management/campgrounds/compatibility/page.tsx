import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  evaluateBookingCompatibility,
  getCompatibilitySnapshot,
} from "@/lib/accommodation-compatibility/postgres.mjs";

import { updateCompatibilityPolicyAction } from "./actions";
import styles from "./compatibility.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Accommodation compatibility · iCamp",
  description:
    "Evaluate tent, RV and cottage fit before a booking choice is accepted.",
};

export default async function CompatibilityPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | undefined>>;
}>) {
  const path = "/workspaces/management/campgrounds/compatibility";
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
        return authorization?.permissions.some((key) =>
          [
            "campground.configuration",
            "accommodation.read",
            "accommodation.manage",
            "reservation.create",
          ].includes(key),
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
  const accommodations = await getCompatibilitySnapshot(
    session.user.id,
    selected.campgroundId,
  );
  const canManage = selected.authorization.permissions.includes(
    "accommodation.manage",
  );

  let preview = null;
  let previewError: string | null = null;
  if (params.accommodation) {
    try {
      preview = await evaluateBookingCompatibility({
        userId: session.user.id,
        campgroundId: selected.campgroundId,
        accommodationId: params.accommodation,
        request: {
          lodgingKind: params.lodgingKind ?? "tent",
          occupants: params.occupants ?? "1",
          visitors: params.visitors ?? "0",
          vehicles: params.vehicles ?? "1",
          pets: params.pets ?? "0",
          rvLengthMeters: params.rvLengthMeters,
          rvWidthMeters: params.rvWidthMeters,
          rvHeightMeters: params.rvHeightMeters,
          electricalAmperage: params.electricalAmperage ?? "0",
          needsWaterAtSite: params.needsWaterAtSite,
          needsWastewaterAtSite: params.needsWastewaterAtSite,
          needsWifi: params.needsWifi,
          needsStepFreeAccess: params.needsStepFreeAccess,
          needsAccessibleWashroom: params.needsAccessibleWashroom,
          requiredFeatures: [
            params.kitchen === "on" ? "kitchen" : "",
            params.privateWashroom === "on" ? "private_washroom" : "",
            params.privateShower === "on" ? "private_shower" : "",
            params.refrigerator === "on" ? "refrigerator" : "",
          ].filter(Boolean),
        },
      });
    } catch (error) {
      previewError =
        error instanceof Error
          ? error.message
          : "Unable to evaluate compatibility.";
    }
  }

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Compatibility</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 034</p>
          <h1>Accommodation compatibility engine</h1>
          <p className="hero-panel__lead">
            Reject incompatible tent, RV and cottage choices on the server using
            physical fit, utilities, accessibility, pet, occupancy and feature
            facts.
          </p>
        </section>
        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open compatibility
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Booking fit"
            title="Evaluate a proposed booking choice"
            id="preview-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 034</span>}
          />
          <form method="get" className={styles.grid}>
            <input
              type="hidden"
              name="campground"
              value={selected.campgroundId}
            />
            <label className={styles.field}>
              <span>Accommodation</span>
              <select
                name="accommodation"
                defaultValue={params.accommodation ?? ""}
                required
              >
                <option value="">Choose accommodation</option>
                {accommodations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Stay type</span>
              <select
                name="lodgingKind"
                defaultValue={params.lodgingKind ?? "tent"}
              >
                <option value="tent">Tent</option>
                <option value="rv">RV</option>
                <option value="cottage">Cottage</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Occupants</span>
              <input
                name="occupants"
                type="number"
                min="1"
                max="80"
                defaultValue={params.occupants ?? "1"}
              />
            </label>
            <label className={styles.field}>
              <span>Visitors</span>
              <input
                name="visitors"
                type="number"
                min="0"
                max="80"
                defaultValue={params.visitors ?? "0"}
              />
            </label>
            <label className={styles.field}>
              <span>Vehicles</span>
              <input
                name="vehicles"
                type="number"
                min="0"
                max="20"
                defaultValue={params.vehicles ?? "1"}
              />
            </label>
            <label className={styles.field}>
              <span>Pets</span>
              <input
                name="pets"
                type="number"
                min="0"
                max="20"
                defaultValue={params.pets ?? "0"}
              />
            </label>
            <label className={styles.field}>
              <span>RV length (m)</span>
              <input
                name="rvLengthMeters"
                type="number"
                step="0.01"
                min="0"
                defaultValue={params.rvLengthMeters ?? ""}
              />
            </label>
            <label className={styles.field}>
              <span>RV width (m)</span>
              <input
                name="rvWidthMeters"
                type="number"
                step="0.01"
                min="0"
                defaultValue={params.rvWidthMeters ?? ""}
              />
            </label>
            <label className={styles.field}>
              <span>RV height (m)</span>
              <input
                name="rvHeightMeters"
                type="number"
                step="0.01"
                min="0"
                defaultValue={params.rvHeightMeters ?? ""}
              />
            </label>
            <label className={styles.field}>
              <span>Electrical amps needed</span>
              <select
                name="electricalAmperage"
                defaultValue={params.electricalAmperage ?? "0"}
              >
                {[0, 15, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None" : n + " A"}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["needsWaterAtSite", "Water at site"],
              ["needsWastewaterAtSite", "Wastewater connection"],
              ["needsWifi", "Wi-Fi"],
              ["needsStepFreeAccess", "Step-free access"],
              ["needsAccessibleWashroom", "Accessible washroom"],
              ["kitchen", "Kitchen"],
              ["privateWashroom", "Private washroom"],
              ["privateShower", "Private shower"],
              ["refrigerator", "Refrigerator"],
            ].map(([name, label]) => (
              <label key={name}>
                <input
                  name={name}
                  type="checkbox"
                  defaultChecked={params[name] === "on"}
                />{" "}
                {label}
              </label>
            ))}
            <div className={styles.full}>
              <button className="primary-button" type="submit">
                Evaluate compatibility
              </button>
            </div>
          </form>
          {preview ? (
            <div className={preview.eligible ? styles.good : styles.bad}>
              <strong>
                {preview.eligible
                  ? "Compatible booking choice"
                  : "Incompatible booking choice"}
              </strong>
              {preview.issues.length ? (
                <ul>
                  {preview.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p>No compatibility conflicts were found.</p>
              )}
            </div>
          ) : null}
          {previewError ? (
            <div className={styles.bad}>{previewError}</div>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Compatibility facts"
            title="Accommodation policy"
            id="policy-heading"
            helpTopic="campground.structure"
          />
          <div className={styles.cards}>
            {accommodations.map((item) => (
              <article className={styles.card} key={item.id}>
                <h3>
                  {item.code} · {item.displayName}
                </h3>
                <p>
                  {item.sectionName} ·{" "}
                  {item.accommodationKind.replaceAll("_", " ")}
                </p>
                <div className={styles.facts}>
                  {item.accommodationKind === "campsite" ? (
                    <>
                      <span>{item.campsiteType}</span>
                      <span>{item.electricalAmperage ?? 0} A</span>
                      <span>Water: {item.waterService}</span>
                      <span>Wastewater: {item.wastewaterService}</span>
                      <span>Wi-Fi: {item.wifiService}</span>
                    </>
                  ) : (
                    <>
                      <span>Occupancy: {item.physicalMaxOccupancy}</span>
                      <span>Kitchen: {item.kitchenType}</span>
                      <span>Washroom: {item.washroomType}</span>
                      <span>
                        Step-free: {item.stepFreeAccess ? "yes" : "no"}
                      </span>
                    </>
                  )}
                </div>
                {canManage ? (
                  <form
                    action={updateCompatibilityPolicyAction}
                    className={styles.grid}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input
                      type="hidden"
                      name="accommodationId"
                      value={item.id}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={item.detailRowVersion}
                    />
                    {item.accommodationKind === "campsite" ? (
                      <label>
                        <input
                          name="accessibleSite"
                          type="checkbox"
                          defaultChecked={item.accessibleSite}
                        />{" "}
                        Accessibility-compatible site
                      </label>
                    ) : null}
                    <label>
                      <input
                        name="petsAllowed"
                        type="checkbox"
                        defaultChecked={item.petsAllowed}
                      />{" "}
                      Pets allowed
                    </label>
                    <label className={styles.field}>
                      <span>Maximum pets</span>
                      <input
                        name="maxPets"
                        type="number"
                        min="0"
                        max="20"
                        defaultValue={item.maxPets}
                      />
                    </label>
                    <div className={styles.full}>
                      <button className="primary-button" type="submit">
                        Save compatibility policy
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
