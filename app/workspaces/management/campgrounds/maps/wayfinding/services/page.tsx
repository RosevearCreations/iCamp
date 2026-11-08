import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listAmenityServiceCandidates } from "@/lib/wayfinding/postgres.mjs";
import { serviceOperatingStatusLabels } from "@/lib/wayfinding/service-review.mjs";

import { saveAmenityServiceAction } from "./actions";
import styles from "../wayfinding.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campground service publication editor · iCamp",
  description:
    "Owner-controlled publishing of campground-reported amenity status, operating hours and accessibility details.",
  robots: { index: false, follow: false },
};

const feedback: Record<string, string> = {
  saved:
    "Private service draft saved. Any previously published service details were withdrawn.",
  published: "Reviewed service details published to the guest directory.",
  conflict: "This amenity changed. Review the latest information and retry.",
  invalid:
    "Check the operating status, text limits and review confirmation before publishing.",
  failed:
    "The review could not be saved. Check campground access and publication eligibility, then retry.",
};

export default async function AmenityServicesEditorPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; result?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/maps/wayfinding/services";
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
  const directory = await listAmenityServiceCandidates({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds/maps">Maps</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/maps/wayfinding">
            Amenity locations
          </Link>
          <span>/</span>
          <span>Service publication</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 228 · Campground-owner controls</p>
          <h1>Service directory editor</h1>
          <p className="hero-panel__lead">
            Publish only details your campground has reviewed: reported
            operating status, hours and access information. Guests see the
            review date. These statements are not live capacity, a certified
            step-free route or permission to enter a facility.
          </p>
        </section>
        {params.result && feedback[params.result] ? (
          <p className={styles.notice} role="status">
            {feedback[params.result]}
          </p>
        ) : null}
        <section className="content-panel">
          <h2>Choose the campground</h2>
          <form method="get" className={styles.scopeForm}>
            <label>
              Campground
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
              Open service editor
            </button>
          </form>
          <p>
            Publish the facility location and map first in the{" "}
            <Link
              href={`/workspaces/management/campgrounds/maps/wayfinding?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              amenity location review
            </Link>
            . Service information is a separate, optional publication.
          </p>
        </section>
        {!directory.migrationReady ? (
          <section className="content-panel" role="status">
            <h2>Database update required</h2>
            <p>
              The original campground database has not applied Build 228
              migration 0216 yet. Existing guest map locations remain available,
              but no service status can be published until the migration is
              applied by the database operator.
            </p>
          </section>
        ) : (
          <section className="content-panel">
            <h2>Facility status and service details</h2>
            <p>
              Save privately to withdraw service details. Use{" "}
              <strong>Review and publish</strong> only after checking the
              statements with your campground team. Published hours are
              descriptive, not an automated opening/closing scheduler.
            </p>
            {!directory.candidates.length ? (
              <p>
                There are no amenity points yet. Add them in the map editor.
              </p>
            ) : null}
            <div className={styles.cards}>
              {directory.candidates.map((item) => {
                const eligible = item.eligible && item.publication.isPublished;
                return (
                  <article className={styles.card} key={item.id}>
                    <div className={styles.cardHead}>
                      <div>
                        <p className={styles.kicker}>
                          {item.kind} · {item.code}
                        </p>
                        <h3>{item.name}</h3>
                      </div>
                      <strong
                        className={
                          eligible && item.service?.isPublished
                            ? styles.published
                            : styles.draft
                        }
                      >
                        {eligible && item.service?.isPublished
                          ? "Service details published"
                          : "Service details private"}
                      </strong>
                    </div>
                    {!eligible ? (
                      <p className={styles.warning} role="status">
                        The facility point must be reviewed and published on the
                        current map before service details can be released.
                      </p>
                    ) : null}
                    {item.service?.reviewedAt ? (
                      <p>
                        Last service review:{" "}
                        {new Date(item.service.reviewedAt)
                          .toISOString()
                          .slice(0, 10)}
                      </p>
                    ) : null}
                    <form
                      action={saveAmenityServiceAction}
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
                        value={item.service?.rowVersion ?? 0}
                      />
                      <label>
                        Campground-reported operating status
                        <select
                          name="operatingStatus"
                          defaultValue={
                            item.service?.operatingStatus ?? "unknown"
                          }
                        >
                          {Object.entries(serviceOperatingStatusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Reviewed operating hours (optional, up to 450
                        characters)
                        <textarea
                          name="hoursSummary"
                          rows={3}
                          maxLength={450}
                          defaultValue={item.service?.hoursSummary ?? ""}
                          placeholder="Example: Mon–Fri, 9 a.m.–5 p.m.; holiday hours may differ"
                        />
                      </label>
                      <label>
                        Reviewed accessibility information (optional, up to 500
                        characters)
                        <textarea
                          name="accessibilityDetails"
                          rows={3}
                          maxLength={500}
                          defaultValue={
                            item.service?.accessibilityDetails ?? ""
                          }
                          placeholder="Describe only access features the campground checked"
                        />
                      </label>
                      <label className={styles.publishOption}>
                        <input type="checkbox" name="confirmed" />I checked
                        these details for this campground and understand
                        publication does not certify a route or live
                        availability.
                      </label>
                      <div className={styles.scopeForm}>
                        <button type="submit" name="intent" value="draft">
                          Save privately / withdraw
                        </button>
                        <button
                          className="primary-button"
                          type="submit"
                          name="intent"
                          value="publish"
                          disabled={!eligible}
                        >
                          Review and publish
                        </button>
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
