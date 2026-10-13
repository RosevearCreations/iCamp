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
  createSectionAction,
  createSubsectionAction,
  updateCampgroundAction,
  updateSectionAction,
  updateSubsectionAction,
} from "./actions";
import styles from "./campground-admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campground structure · iCamp",
  description:
    "Manage campground sections, subsections, ordering and settings.",
};

function LifecycleSelect({
  name,
  value,
}: Readonly<{ name: string; value: string }>) {
  return (
    <select name={name} defaultValue={value}>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  );
}

export default async function CampgroundAdministrationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const session = await requireAnyCampgroundPermission(
    "campground.configuration",
    "/workspaces/management/campgrounds",
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
        return authorization?.permissions.includes("campground.configuration")
          ? campground
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
  const structure = await listCampgroundStructure(
    session.user.id,
    selected.campgroundId,
  );

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
          <span>Campground structure</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 017</p>
          <h1>Campground structure administration</h1>
          <p className="hero-panel__lead">
            Manage campground details, ordered sections and subsections without
            crossing property boundaries.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel" aria-labelledby="property-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="property-heading"
            helpTopic="campground.structure"
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

        <section className="content-panel" aria-labelledby="campground-heading">
          <SectionHeading
            eyebrow="Campground"
            title="Property configuration"
            id="campground-heading"
            helpTopic="campground.structure"
          />
          <form action={updateCampgroundAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={structure.campground.id}
            />
            <input
              type="hidden"
              name="rowVersion"
              value={structure.campground.rowVersion}
            />
            <label className={styles.field}>
              <span>Name</span>
              <input
                name="name"
                defaultValue={structure.campground.name}
                maxLength={160}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Timezone</span>
              <input
                name="timezone"
                defaultValue={structure.campground.timezone}
                maxLength={100}
                required
              />
            </label>
            <label className={styles.field}>
              <span>State</span>
              <LifecycleSelect
                name="lifecycleState"
                value={structure.campground.lifecycleState}
              />
            </label>
            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Save campground
              </button>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="sections-heading">
          <SectionHeading
            eyebrow="Hierarchy"
            title="Sections and subsections"
            id="sections-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 017</span>}
          />

          <div className={styles.sectionGrid}>
            {structure.sections.map((section) => (
              <article className={styles.sectionCard} key={section.id}>
                <div>
                  <h3>{section.name}</h3>
                  <span className={styles.sectionMeta}>
                    {section.code} · row {section.rowVersion}
                  </span>
                </div>

                <form action={updateSectionAction} className={styles.formGrid}>
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={structure.campground.id}
                  />
                  <input type="hidden" name="sectionId" value={section.id} />
                  <input
                    type="hidden"
                    name="rowVersion"
                    value={section.rowVersion}
                  />
                  <label className={styles.field}>
                    <span>Name</span>
                    <input
                      name="name"
                      defaultValue={section.name}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Code</span>
                    <input
                      name="code"
                      defaultValue={section.code}
                      maxLength={64}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Order</span>
                    <input
                      name="sortOrder"
                      type="number"
                      min="0"
                      max="100000"
                      defaultValue={section.sortOrder}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>State</span>
                    <LifecycleSelect
                      name="lifecycleState"
                      value={section.lifecycleState}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Operating mode</span>
                    <select
                      name="operatingMode"
                      defaultValue={section.settings.operatingMode}
                    >
                      <option value="standard">Standard</option>
                      <option value="quiet">Quiet</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Quiet hours start</span>
                    <input
                      type="time"
                      name="quietHoursStart"
                      defaultValue={section.settings.quietHoursStart ?? ""}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Quiet hours end</span>
                    <input
                      type="time"
                      name="quietHoursEnd"
                      defaultValue={section.settings.quietHoursEnd ?? ""}
                    />
                  </label>
                  <div className={styles.actions}>
                    <button className="primary-button" type="submit">
                      Save section
                    </button>
                  </div>
                  <label className={`${styles.field} ${styles.full}`}>
                    <span>Staff note</span>
                    <textarea
                      name="staffNote"
                      maxLength={500}
                      defaultValue={section.settings.staffNote}
                    />
                  </label>
                </form>

                <div>
                  <h4>Subsections</h4>
                </div>

                {section.subsections.map((subsection) => (
                  <form
                    action={updateSubsectionAction}
                    className={styles.subsectionCard}
                    key={subsection.id}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={structure.campground.id}
                    />
                    <input
                      type="hidden"
                      name="subsectionId"
                      value={subsection.id}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={subsection.rowVersion}
                    />
                    <div className={styles.subsectionGrid}>
                      <label className={styles.field}>
                        <span>Name</span>
                        <input
                          name="name"
                          defaultValue={subsection.name}
                          maxLength={160}
                          required
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Code</span>
                        <input
                          name="code"
                          defaultValue={subsection.code}
                          maxLength={64}
                          required
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Order</span>
                        <input
                          name="sortOrder"
                          type="number"
                          min="0"
                          max="100000"
                          defaultValue={subsection.sortOrder}
                          required
                        />
                      </label>
                      <label className={styles.field}>
                        <span>State</span>
                        <LifecycleSelect
                          name="lifecycleState"
                          value={subsection.lifecycleState}
                        />
                      </label>
                    </div>
                    <div className={styles.actions}>
                      <button className="primary-button" type="submit">
                        Save subsection
                      </button>
                    </div>
                  </form>
                ))}

                <form
                  action={createSubsectionAction}
                  className={styles.subsectionCard}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={structure.campground.id}
                  />
                  <input type="hidden" name="sectionId" value={section.id} />
                  <div className={styles.subsectionGrid}>
                    <label className={styles.field}>
                      <span>New subsection name</span>
                      <input name="name" maxLength={160} required />
                    </label>
                    <label className={styles.field}>
                      <span>Code</span>
                      <input name="code" maxLength={64} required />
                    </label>
                    <label className={styles.field}>
                      <span>Order</span>
                      <input
                        name="sortOrder"
                        type="number"
                        min="0"
                        max="100000"
                        defaultValue={10}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>State</span>
                      <LifecycleSelect name="lifecycleState" value="active" />
                    </label>
                  </div>
                  <div className={styles.actions}>
                    <button className="primary-button" type="submit">
                      Add subsection
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="create-heading">
          <SectionHeading
            eyebrow="Add hierarchy"
            title="Create section"
            id="create-heading"
            helpTopic="campground.structure"
          />
          <form action={createSectionAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={structure.campground.id}
            />
            <label className={styles.field}>
              <span>Name</span>
              <input name="name" maxLength={160} required />
            </label>
            <label className={styles.field}>
              <span>Code</span>
              <input name="code" maxLength={64} required />
            </label>
            <label className={styles.field}>
              <span>Order</span>
              <input
                name="sortOrder"
                type="number"
                min="0"
                max="100000"
                defaultValue={10}
                required
              />
            </label>
            <label className={styles.field}>
              <span>State</span>
              <LifecycleSelect name="lifecycleState" value="active" />
            </label>
            <label className={styles.field}>
              <span>Operating mode</span>
              <select name="operatingMode" defaultValue="standard">
                <option value="standard">Standard</option>
                <option value="quiet">Quiet</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Quiet hours start</span>
              <input type="time" name="quietHoursStart" />
            </label>
            <label className={styles.field}>
              <span>Quiet hours end</span>
              <input type="time" name="quietHoursEnd" />
            </label>
            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Add section
              </button>
            </div>
            <label className={`${styles.field} ${styles.full}`}>
              <span>Staff note</span>
              <textarea name="staffNote" maxLength={500} />
            </label>
          </form>
        </section>

        <section
          className="content-panel"
          aria-labelledby="accommodations-heading"
        >
          <SectionHeading
            eyebrow="Accommodation inventory"
            title="Unified campsites, cottages & permanent units"
            id="accommodations-heading"
            helpTopic="accommodation.inventory"
            trailing={<span className="build-chip">Build 028</span>}
          />
          <p>
            Open the accommodation operations workbench: shared identity,
            campsite and cottage detail, turnover readiness and curated public
            galleries in one place, ready for later status and booking builds.
          </p>
          <Link
            className="primary-link primary-link--dark"
            aria-label="Open accommodation inventory and assembly"
            href={`/workspaces/management/campgrounds/accommodations?campground=${encodeURIComponent(
              structure.campground.id,
            )}`}
          >
            Open accommodation assembly · Build 024–026
          </Link>
        </section>

        <section className="content-panel" aria-labelledby="assets-heading">
          <SectionHeading
            eyebrow="Operational inventory"
            title="Operational assets & equipment"
            id="assets-heading"
            helpTopic="asset.inventory"
            trailing={<span className="build-chip">Build 029</span>}
          />
          <p>
            Open the facilities, infrastructure, equipment and fleet workbench
            for map linkage, ownership, meter facts and current operating-state
            readiness.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/assets?campground=" +
              encodeURIComponent(structure.campground.id)
            }
          >
            Open operational assets workbench
          </Link>
        </section>

        <section
          className="content-panel"
          aria-labelledby="status-engine-heading"
        >
          <SectionHeading
            eyebrow="Current operating state"
            title="Accommodation & asset status engine"
            id="status-engine-heading"
            helpTopic="status.engine"
            trailing={<span className="build-chip">Build 030</span>}
          />
          <p>
            Control campsite, cottage, permanent-unit, facility, equipment and
            fleet state through server-enforced transition rules with durable
            history.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/status?campground=" +
              encodeURIComponent(structure.campground.id)
            }
          >
            Open status control centre
          </Link>
        </section>

        <section
          className="content-panel"
          aria-labelledby="booking-rules-heading"
        >
          <SectionHeading
            eyebrow="Booking configuration"
            title="Booking calendar & date rules"
            id="booking-rules-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 032</span>}
          />
          <p>
            Configure check-in/out times, booking windows, stay limits, weekend
            classification and named holiday/season calendars before live
            availability and pricing consume them.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/booking-rules?campground=" +
              encodeURIComponent(structure.campground.id)
            }
          >
            Open booking calendar & date rules
          </Link>
        </section>

        <section
          className="content-panel"
          aria-labelledby="capacity-rules-heading"
        >
          <SectionHeading
            eyebrow="Booking capacity"
            title="Capacity, guest & vehicle limits"
            id="capacity-rules-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 033</span>}
          />
          <p>
            Configure layered occupant, visitor and vehicle limits by
            campground, accommodation type, section or individual accommodation,
            including campsite-size bands.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/capacity-rules?campground=" +
              encodeURIComponent(structure.campground.id)
            }
          >
            Open capacity, guest & vehicle limits
          </Link>
        </section>

        <section className="content-panel" aria-labelledby="compatibility-heading">
          <SectionHeading
            eyebrow="Booking compatibility"
            title="Accommodation compatibility engine"
            id="compatibility-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 034</span>}
          />
          <p>
            Validate tent, RV and cottage fit against physical dimensions,
            utilities, accessibility, pets, occupancy and accommodation features.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/compatibility?campground=" +
              encodeURIComponent(structure.campground.id)
            }
          >
            Open accommodation compatibility
          </Link>
        </section>

        <section className="content-panel" aria-labelledby="map-images-heading">
          <SectionHeading
            eyebrow="Campground map"
            title="Overhead image library"
            id="map-images-heading"
            helpTopic="campground.map.images"
            trailing={<span className="build-chip">Build 018</span>}
          />
          <p>
            Upload and version overhead, drone or site-plan imagery before
            plotting the campground map.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={`/workspaces/management/campgrounds/maps?campground=${encodeURIComponent(
              structure.campground.id,
            )}`}
          >
            Open overhead image library
          </Link>
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
            sectionKey="management.campground-structure"
          />
        </section>
      </div>
    </AppShell>
  );
}
