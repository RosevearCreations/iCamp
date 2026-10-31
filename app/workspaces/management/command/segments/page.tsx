import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SegmentComparisonChart } from "@/components/segment-comparison-chart";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { getCampgroundSegmentComparison } from "@/lib/command-centre/segment-comparison-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seasonal Segment Comparisons · iCamp",
  description:
    "Authorized campsite, rental cottage and permanent unit booking coverage comparisons.",
};

export default async function SegmentComparisonPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/management/command/segments";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions = auth?.permissions ?? [];
        return ["reports.read", "reservation.read", "accommodation.read"].every(
          (key) => permissions.includes(key),
        )
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const base = `?campground=${encodeURIComponent(selected.campgroundId)}`;
  const summary = await getCampgroundSegmentComparison({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  }).catch(() => null);
  return (
    <AppShell>
      <div className="page-stack camp-command camp-segments-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Operations Command</Link>
          <span>/</span>
          <span>Segment comparisons</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">Build 164 · Standard / Seasonal Insight</p>
          <h1>Seasonal Segment Comparisons</h1>
          <p className="hero-panel__lead">
            Compare booking coverage fairly across campsites, rental cottages
            and permanent units using each type&apos;s own site-night inventory.
          </p>
          <div className="camp-command__hero-actions">
            <Link
              className="primary-link"
              href={`/workspaces/management/command/seasonal${base}`}
            >
              Six-month trend ↗
            </Link>
            <Link
              className="secondary-link"
              href="/workspaces/management/command"
            >
              Management Command
            </Link>
          </div>
        </section>
        <section
          className="camp-command__scope"
          aria-label="Campground selection"
        >
          <form method="get" className="camp-command__scope-form">
            <label htmlFor="segment-campground">Campground</label>
            <select
              id="segment-campground"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {authorized.map((item) => (
                <option key={item.campgroundId} value={item.campgroundId}>
                  {item.campgroundName}
                </option>
              ))}
            </select>
            <button className="secondary-button" type="submit">
              Apply
            </button>
          </form>
          <span className="ops-pill">Read-only · Campground-local months</span>
        </section>
        {summary ? (
          <>
            <SegmentComparisonChart summary={summary} />
            <section className="content-panel ops-detail-card">
              <h2>Comparison method and limitations</h2>
              <p className="ops-inline-note">
                The last six months, including the current partial month, use
                today&apos;s active accommodation inventory as the historical
                denominator. Booking records may have changed. These comparisons
                are planning signals—not an as-of historical audit, physical
                guest count, sales report or booking-eligibility check. Use the
                live availability calendar for actual booking decisions.
              </p>
              <p className="ops-inline-note">
                Tenant billing and Omnichannel remain HELD / DISCONNECTED.
              </p>
            </section>
          </>
        ) : (
          <section className="content-panel ops-detail-card" role="status">
            <h2>Segment comparisons unavailable</h2>
            <p>
              The authorized source could not be read or reconciled; no
              estimated totals or false zero values have been shown.
            </p>
            <Link href={`/workspaces/management/command/seasonal${base}`}>
              Open seasonal trends ↗
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
