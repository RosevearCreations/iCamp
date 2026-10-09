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

import { CoordinateEngine } from "./coordinate-engine";
import styles from "./coordinate-engine.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Map coordinate engine · iCamp",
  description: "Inspect the active campground map coordinate transform.",
};

export default async function MapCoordinateEnginePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
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
          <span>Coordinate engine</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 019</p>
          <h1>Zoom/Pan Coordinate Engine</h1>
          <p className="hero-panel__lead">
            Inspect the active source image through the same coordinate
            transform that future polygons, labels and hit-testing will use.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="property-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="property-heading"
            helpTopic="campground.map.coordinates"
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
              Open coordinate engine
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="engine-heading">
          <SectionHeading
            eyebrow="Canonical transform"
            title="Active map coordinate space"
            id="engine-heading"
            helpTopic="campground.map.coordinates"
            trailing={<span className="build-chip">Build 019</span>}
          />
          {activeVersion ? (
            <CoordinateEngine
              mediaAssetId={activeVersion.mediaAssetId}
              label={activeVersion.label}
              sourceWidth={activeVersion.sourceWidth}
              sourceHeight={activeVersion.sourceHeight}
            />
          ) : (
            <div className={styles.emptyState}>
              <strong>No active overhead image is available.</strong>
              <p>
                Upload or activate an image version before using the coordinate
                engine.
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
            title="Original-image + normalized coordinates"
            id="contract-heading"
            helpTopic="campground.map.coordinates"
          />
          <p>
            Future map geometry stores both source-image pixel coordinates and
            normalized 0–1 coordinates. Pixel coordinates preserve editing
            precision for a specific source image; normalized coordinates
            provide a stable proportional reference for validation, migration
            and drift detection.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Administrative tracking"
            title="Coordinate-engine freshness"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={new Date().toISOString()}
            sectionKey="management.campground-map-coordinate-engine"
          />
        </section>
      </div>
    </AppShell>
  );
}
