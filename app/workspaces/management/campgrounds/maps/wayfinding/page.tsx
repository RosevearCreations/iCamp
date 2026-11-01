import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listWayfindingCandidates } from "@/lib/wayfinding/postgres.mjs";

import { saveWayfindingReviewAction } from "./actions";
import styles from "./wayfinding.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Public amenity wayfinding review · iCamp",
  description:
    "Review safe, map-version-pinned amenities before public publication.",
};

export default async function WayfindingReviewPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/maps/wayfinding";
  const session = await requireAnyCampgroundPermission(
    "campground.map.publish",
    path,
  );
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return access?.permissions.includes("campground.map.publish") &&
          access.permissions.includes("campground.configuration")
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const candidates = await listWayfindingCandidates({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/maps">Maps</Link>
          <span>/</span>
          <span>Public amenity review</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 180 · Owner-controlled publication</p>
          <h1>Accessible amenity wayfinding review</h1>
          <p className="hero-panel__lead">
            Publish only verified campground amenities already positioned on the
            published overhead map. Descriptions and access notes are your
            campground&apos;s statements, not independent certification or
            automatic turn-by-turn directions.
          </p>
        </section>

        {params.saved ? (
          <p className={styles.notice} role="status">
            {params.saved}
          </p>
        ) : null}

        <section className="content-panel" aria-labelledby="wayfinding-scope">
          <SectionHeading
            id="wayfinding-scope"
            eyebrow="Tenant scope"
            title="Select campground"
            helpTopic="campground.map.objects"
          />
          <form method="get" className={styles.scopeForm}>
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
            <button className="primary-button" type="submit">
              Open amenity review
            </button>
          </form>
          <p>
            Only pools, washrooms, docks and buildings on the enabled Amenities
            layer can be published. Road, gate, security and operational asset
            positions remain private. First bind a point in the{" "}
            <Link
              href={`/workspaces/management/campgrounds/maps/coordinate-engine?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              coordinate engine
            </Link>
            .
          </p>
        </section>

        <section
          className="content-panel"
          aria-labelledby="wayfinding-review-list"
        >
          <SectionHeading
            id="wayfinding-review-list"
            eyebrow="Source-linked publication"
            title={`Amenity review queue (${candidates.length})`}
            helpTopic="campground.map.objects"
          />
          {!candidates.length ? (
            <p>
              No eligible amenity objects have been created. Create and bind
              them in the map editor first.
            </p>
          ) : null}
          <div className={styles.cards}>
            {candidates.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <p className={styles.kicker}>
                      {item.kind.replaceAll("_", " ")} · {item.code}
                    </p>
                    <h3>{item.name}</h3>
                  </div>
                  <strong
                    className={
                      item.publication.isPublished && item.eligible
                        ? styles.published
                        : styles.draft
                    }
                  >
                    {item.publication.isPublished && item.eligible
                      ? "Published"
                      : "Not visible to guests"}
                  </strong>
                </div>
                {!item.eligible ? (
                  <p role="status" className={styles.warning}>
                    Cannot publish yet: this object needs an active point on the
                    enabled Amenities layer of the currently published map.
                    {item.publication.isPublished
                      ? " Its previous publication is no longer eligible and will not display."
                      : ""}
                  </p>
                ) : null}
                <form
                  action={saveWayfindingReviewAction}
                  className={styles.reviewForm}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="mapObjectId" value={item.id} />
                  <input
                    type="hidden"
                    name="rowVersion"
                    value={item.publication.rowVersion}
                  />
                  <label>
                    Guest-facing description (required to publish)
                    <textarea
                      name="description"
                      maxLength={600}
                      rows={3}
                      defaultValue={item.publication.description}
                      placeholder="Example: Washrooms beside the recreation hall"
                    />
                  </label>
                  <label>
                    Campground-provided accessibility information (optional)
                    <textarea
                      name="accessibilityNote"
                      maxLength={400}
                      rows={2}
                      defaultValue={item.publication.accessibilityNote}
                      placeholder="Only state features your team has checked"
                    />
                  </label>
                  <label>
                    Landmark guidance (optional; not a calculated route)
                    <textarea
                      name="landmarkHint"
                      maxLength={500}
                      rows={2}
                      defaultValue={item.publication.landmarkHint}
                      placeholder="Example: Look for the blue washroom sign near the office"
                    />
                  </label>
                  <label className={styles.publishOption}>
                    <input
                      type="checkbox"
                      name="isPublished"
                      defaultChecked={item.publication.isPublished}
                      disabled={!item.eligible}
                    />
                    Publish to the public wayfinding map after reviewing these
                    statements
                  </label>
                  <button type="submit" className="primary-button">
                    Save reviewed amenity
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
