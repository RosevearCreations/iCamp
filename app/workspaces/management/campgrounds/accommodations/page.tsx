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
} from "./actions";
import styles from "./accommodation-admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unified accommodation inventory · iCamp",
  description:
    "Manage canonical campsite, cottage and permanent-unit inventory.",
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
          <p className="eyebrow">Build 024</p>
          <h1>Unified accommodation model</h1>
          <p className="hero-panel__lead">
            Manage one canonical inventory for campsites, rental cottages and
            permanent units while keeping type-specific detail in later builds.
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
            trailing={<span className="build-chip">Build 024</span>}
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
          </div>

          <div className={styles.cardGrid}>
            {accommodations.map((accommodation) => (
              <article className={styles.card} key={accommodation.id}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className="eyebrow">
                      {kindLabels[accommodation.kind]}
                    </p>
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
                            <option
                              key={subsection.id}
                              value={subsection.id}
                            >
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

                <p className={styles.boundary}>
                  {accommodation.kind === "campsite"
                    ? "Build 025 adds campsite type, utility and dimension details."
                    : accommodation.kind === "rental_cottage"
                      ? "Build 026 adds cottage occupancy, facilities and accessibility."
                      : "Ownership and transfer detail remains in later permanent-unit builds."}
                </p>
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

        <section className="content-panel" aria-labelledby="connections-heading">
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
