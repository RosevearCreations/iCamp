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
import { listMapImageVersions } from "@/lib/map-images/postgres.mjs";
import { listMapPolygons } from "@/lib/map-polygons/postgres.mjs";

import { CoordinateEngine } from "./coordinate-engine";
import styles from "./coordinate-engine.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Polygon plotter · iCamp",
  description: "Plot and edit campground polygons on the active overhead image.",
};

export default async function MapCoordinateEnginePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/maps/coordinate-engine";
  const session = await requireAnyCampgroundPermission("campground.map", path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return authorization?.permissions.includes("campground.map")
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
  const versions = await listMapImageVersions(
    session.user.id,
    selected.campgroundId,
  );
  const activeVersion = versions.find((version) => version.isActive) ?? null;
  const polygons = activeVersion
    ? await listMapPolygons(
        session.user.id,
        selected.campgroundId,
        activeVersion.id,
      )
    : [];
  const libraryHref =
    "/workspaces/management/campgrounds/maps?campground=" +
    encodeURIComponent(selected.campgroundId);

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
          <Link href={libraryHref}>Overhead images</Link>
          <span aria-hidden="true">/</span>
          <span>Polygon plotter</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 020</p>
          <h1>Polygon Plotter Core</h1>
          <p className="hero-panel__lead">
            Draw irregular campground shapes directly on the active overhead
            image, validate them, edit their vertices and persist them against
            the exact image version used for plotting.
          </p>
        </section>

        {params.saved ? (
          <section className={styles.savedNotice} aria-live="polite">
            {params.saved}
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="property-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="property-heading"
            helpTopic="campground.map.polygons"
          />
          <form method="get" className={styles.propertySelector}>
            <label>
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
              Open polygon plotter
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="engine-heading">
          <SectionHeading
            eyebrow="Visual map editor"
            title="Active-image polygon plotter"
            id="engine-heading"
            helpTopic="campground.map.polygons"
            trailing={<span className="build-chip">Build 020</span>}
          />
          {activeVersion ? (
            <CoordinateEngine
              campgroundId={selected.campgroundId}
              mapImageVersionId={activeVersion.id}
              mediaAssetId={activeVersion.mediaAssetId}
              label={activeVersion.label}
              sourceWidth={activeVersion.sourceWidth}
              sourceHeight={activeVersion.sourceHeight}
              initialPolygons={polygons}
            />
          ) : (
            <div className={styles.emptyState}>
              <strong>No active overhead image is available.</strong>
              <p>
                Upload or activate an image version before plotting polygons.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href={libraryHref}
              >
                Open overhead image library
              </Link>
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="contract-heading">
          <SectionHeading
            eyebrow="Geometry contract"
            title="Version-bound, drift-resistant polygons"
            id="contract-heading"
            helpTopic="campground.map.polygons"
          />
          <p>
            Every saved vertex retains original-image pixels plus normalized
            0–1 coordinates from Build 019. The polygon is bound to the exact
            overhead image version used for editing, so later image changes do
            not silently move clickable areas.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="platform-heading">
          <SectionHeading
            eyebrow="Architecture checkpoint"
            title="Platform choices"
            id="platform-heading"
            helpTopic="campground.map.polygons"
          />
          <p>
            The campground map editor uses iCamp-owned imagery and SVG overlays;
            no paid mapping API is required. Hosting, PostgreSQL, media storage
            and provider decisions remain portable and are recorded in the
            platform decision register.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Administrative tracking"
            title="Polygon-plotter freshness"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={new Date().toISOString()}
            sectionKey="management.campground-map-polygon-plotter"
          />
        </section>
      </div>
    </AppShell>
  );
}
