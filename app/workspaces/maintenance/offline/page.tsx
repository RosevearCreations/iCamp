import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offline maintenance · iCamp",
  description:
    "Cached assigned maintenance work, offline notes, checklist answers, media queue and conflict-aware synchronization.",
};

type SearchParams = Promise<{ campground?: string }>;

export default async function OfflineMaintenancePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const path = "/workspaces/maintenance/offline";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const relevantPermissions = [
    "maintenance.read",
    "maintenance.create",
    "maintenance.assign",
    "maintenance.complete",
    "inspection.perform",
    "maintenance.offline.media",
  ];

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const allowed = await Promise.all(
          relevantPermissions.map((permission) =>
            hasCampgroundPermission(
              session.user.id,
              campground.campgroundId,
              permission,
            ),
          ),
        );
        return allowed.some(Boolean) ? campground : null;
      }),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find(
      (campground) => campground.campgroundId === params.campground,
    ) ?? authorized[0];

  return (
    <AppShell>
      <link rel="stylesheet" href="/offline-maintenance.css" />
      <Script src="/offline-maintenance.js" strategy="afterInteractive" />
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Offline workspace</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 076 · Field continuity</p>
          <h1>Offline Maintenance Workspace</h1>
          <p className="hero-panel__lead">
            Cache only work assigned to you, record notes, checklist answers and
            field media without a signal, then reconcile safely when the device
            reconnects.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="offline-scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="offline-scope-heading"
            helpTopic="shell.overview"
          />
          <form method="get" className="offline-scope-form">
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
              Open offline workspace
            </button>
          </form>
        </section>

        <section
          className="content-panel"
          aria-labelledby="offline-workspace-heading"
        >
          <SectionHeading
            eyebrow="Device-local field queue"
            title="Assigned work & sync"
            id="offline-workspace-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 076</span>}
          />
          <p>
            The cached snapshot and unsent evidence live on this device until
            synchronized or explicitly cleared. The server accepts only
            idempotent notes, in-progress checklist results and validated
            internal media whose cached row versions still match.
          </p>
          <div
            id="offline-maintenance-root"
            data-campground-id={selected.campgroundId}
            data-campground-name={selected.campgroundName}
          >
            <p role="status">Opening the device-local maintenance cache…</p>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="offline-boundary-heading"
        >
          <SectionHeading
            eyebrow="Safety boundary"
            title="Final decisions stay online"
            id="offline-boundary-heading"
            helpTopic="shell.channels"
          />
          <p>
            Offline mode never completes or cancels a work order, submits or
            signs off an inspection, changes assignments, resolves escalations,
            publishes media, or performs another high-risk final action.
            Reconnect and use the canonical online workflow for those decisions.
          </p>
          <div className="hero-actions">
            <Link
              className="primary-link primary-link--dark"
              href={
                "/workspaces/maintenance/work-orders?campground=" +
                encodeURIComponent(selected.campgroundId)
              }
            >
              Open online work orders
            </Link>
            <Link
              className="primary-link primary-link--dark"
              href={
                "/workspaces/maintenance/inspections?campground=" +
                encodeURIComponent(selected.campgroundId)
              }
            >
              Open online inspections
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
