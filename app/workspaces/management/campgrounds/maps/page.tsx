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
import { getMediaStorageConfig } from "@/lib/media/storage.mjs";

import {
  publishMapVersionAction,
  setActiveMapVersionAction,
  uploadOverheadImageAction,
} from "./actions";
import { MapImagePreview } from "./map-image-preview";
import styles from "./map-images.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overhead image library · iCamp",
  description: "Manage campground overhead image versions.",
};

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KiB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export default async function CampgroundMapImageLibraryPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const session = await requireAnyCampgroundPermission(
    "campground.map",
    "/workspaces/management/campgrounds/maps",
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
        return authorization?.permissions.includes("campground.map")
          ? {
              ...campground,
              permissions: authorization.permissions,
            }
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
  const storage = getMediaStorageConfig();
  const uploadReady = Boolean(storage.projectUrl && storage.secretKey);
  const canPublish = selected.permissions.includes("campground.map.publish");

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
          <span>Overhead images</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 018</p>
          <h1>Overhead image library & versioning</h1>
          <p className="hero-panel__lead">
            Upload real overhead, drone or site-plan imagery, keep immutable
            source dimensions, and deliberately select the active/published map
            version.
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
            helpTopic="campground.map.images"
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
              Open image library
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="upload-heading">
          <SectionHeading
            eyebrow="Safe ingestion"
            title="Upload overhead image version"
            id="upload-heading"
            helpTopic="campground.map.images"
          />
          <p className={styles.storageStatus}>
            Storage status:{" "}
            <strong>{uploadReady ? "configured" : "not configured"}</strong>.
            Uploads are server-authorized, limited to JPEG/PNG/WebP, capped by
            byte/pixel limits, and sanitized to remove common EXIF/XMP/text
            metadata.
          </p>
          <form
            action={uploadOverheadImageAction}
            className={styles.uploadGrid}
          >
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label className={styles.field}>
              <span>Image</span>
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <label className={styles.field}>
              <span>Version label</span>
              <input name="label" maxLength={160} required />
            </label>
            <label className={`${styles.field} ${styles.full}`}>
              <span>Notes</span>
              <textarea name="notes" maxLength={1000} />
            </label>
            <label className={`${styles.field} ${styles.full}`}>
              <span>Upload reason</span>
              <input
                name="reason"
                minLength={8}
                maxLength={500}
                placeholder="Example: Updated 2026 drone survey"
                required
              />
            </label>
            <div className={styles.full}>
              <button
                className="primary-button"
                type="submit"
                disabled={!uploadReady}
              >
                Upload new version
              </button>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="versions-heading">
          <SectionHeading
            eyebrow="Version history"
            title="Map image versions"
            id="versions-heading"
            helpTopic="campground.map.images"
            trailing={
              <span className="build-chip">{versions.length} versions</span>
            }
          />
          {versions.length === 0 ? (
            <p>
              No overhead image versions have been uploaded for this campground.
            </p>
          ) : (
            <div className={styles.versionGrid}>
              {versions.map((version) => (
                <article className={styles.versionCard} key={version.id}>
                  <div className={styles.versionHeader}>
                    <div>
                      <p className="eyebrow">Version {version.versionNumber}</p>
                      <h3>{version.label}</h3>
                    </div>
                    <div className={styles.badges}>
                      {version.isActive ? (
                        <span className={styles.badge}>Active</span>
                      ) : null}
                      {version.isPublished ? (
                        <span className={styles.badge}>Published</span>
                      ) : null}
                    </div>
                  </div>

                  <MapImagePreview
                    mediaAssetId={version.mediaAssetId}
                    label={version.label}
                  />

                  <dl className={styles.meta}>
                    <dt>Dimensions</dt>
                    <dd>
                      {version.sourceWidth} × {version.sourceHeight}
                    </dd>
                    <dt>Format</dt>
                    <dd>{version.sourceContentType}</dd>
                    <dt>Size</dt>
                    <dd>{formatBytes(version.sourceByteSize)}</dd>
                    <dt>Source name</dt>
                    <dd>{version.originalFilename}</dd>
                    <dt>Created</dt>
                    <dd>{new Date(version.createdAt).toLocaleString()}</dd>
                    <dt>Published</dt>
                    <dd>
                      {version.publishedAt
                        ? new Date(version.publishedAt).toLocaleString()
                        : "Not published"}
                    </dd>
                  </dl>

                  {version.notes ? <p>{version.notes}</p> : null}

                  <div className={styles.actions}>
                    {!version.isActive ? (
                      <form action={setActiveMapVersionAction}>
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="mapVersionId"
                          value={version.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={version.rowVersion}
                        />
                        <button className="primary-button" type="submit">
                          Make active
                        </button>
                      </form>
                    ) : null}

                    {canPublish && !version.isPublished ? (
                      <form
                        action={publishMapVersionAction}
                        className={styles.actionGrid}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="mapVersionId"
                          value={version.id}
                        />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={version.rowVersion}
                        />
                        <label className={styles.field}>
                          <span>Publication reason</span>
                          <input
                            name="reason"
                            minLength={8}
                            maxLength={500}
                            required
                          />
                        </label>
                        <button className="primary-button" type="submit">
                          Publish version
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Administrative tracking"
            title="Map-library freshness"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={new Date().toISOString()}
            sectionKey="management.campground-map-images"
          />
        </section>
      </div>
    </AppShell>
  );
}
