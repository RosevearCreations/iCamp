import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";

export const metadata: Metadata = {
  title: "Sysop overview · iCamp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SysopPage() {
  const { summary } = await requireSysop("/sysop");
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">
            Platform operations / Orbit Command · Build 247
          </p>
          <h1>Platform operations command</h1>
          <p className="hero-panel__lead">
            Ree and Jack&apos;s independently verified operator area. Only
            platform-level counts, health and support are available here.
          </p>
        </section>
        <div
          className="ops-kpi-grid"
          aria-label="Platform-wide aggregate statistics"
        >
          <article className="ops-kpi">
            <div>
              <span>Active campground organizations</span>
              <strong>{summary.organizations}</strong>
            </div>
          </article>
          <article className="ops-kpi">
            <div>
              <span>Active campgrounds</span>
              <strong>{summary.campgrounds}</strong>
            </div>
          </article>
          <article className="ops-kpi">
            <div>
              <span>Active platform accounts</span>
              <strong>{summary.active_users}</strong>
            </div>
          </article>
        </div>
        <section className="content-panel">
          <h2>System telemetry and elevated help</h2>
          <p>
            <Link href="/status">View published system status</Link>
          </p>
          <p>
            <Link href="/sysop/readiness">
              Verify actual production database adoption and original-source signer custody
            </Link>
          </p>
          <p>
            <Link href="/integration/comms-hub">
              Review Comms Hub connection guidance
            </Link>
          </p>
          <p>
            Support access does not activate a Comms Hub connection or permit
            tenant impersonation.
          </p>
        </section>
        <section className="content-panel">
          <h2>Campground product boundary</h2>
          <p>
            Camp Rosevear and every other campground are separate tenant
            workspaces. A master Sysop grant alone cannot open their bookings,
            financial records or guest profiles.
          </p>
          <p>
            <Link href="/campground">
              Enter an independently assigned campground workspace
            </Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
