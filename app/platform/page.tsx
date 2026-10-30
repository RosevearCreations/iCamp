import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { getPlatformOverview } from "@/lib/platform/postgres.mjs";

export const metadata: Metadata = {
  title: "Platform administration · iCamp",
};
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const session = await requireStaff("/platform");
  const summary = await getPlatformOverview(
    session.user.id,
    session.assuranceLevel,
  );
  if (!summary) {
    redirect("/auth/not-authorized");
  }

  return (
    <AppShell>
      <main className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Platform operator · Build 160</p>
          <h1>iCamp application management</h1>
          <p className="hero-panel__lead">
            Verified platform-wide totals. This is separate from a campground
            owner&apos;s management permissions and requires a reviewed global
            grant and multi-factor assurance.
          </p>
        </section>
        <div className="ops-kpi-grid" aria-label="Verified platform totals">
          <article className="ops-kpi">
            <span className="ops-kpi__icon" aria-hidden="true">
              ♧
            </span>
            <div>
              <span>Active organizations</span>
              <strong>{summary.organizations}</strong>
              <small>Verified platform database count</small>
            </div>
          </article>
          <article className="ops-kpi">
            <span
              className="ops-kpi__icon ops-kpi__icon--blue"
              aria-hidden="true"
            >
              ▥
            </span>
            <div>
              <span>Active campgrounds</span>
              <strong>{summary.campgrounds}</strong>
              <small>Verified platform database count</small>
            </div>
          </article>
          <article className="ops-kpi">
            <span
              className="ops-kpi__icon ops-kpi__icon--amber"
              aria-hidden="true"
            >
              ♙
            </span>
            <div>
              <span>Active accounts</span>
              <strong>{summary.active_users}</strong>
              <small>Verified platform database count</small>
            </div>
          </article>
        </div>
        <section className="content-panel">
          <h2>Protected operator statistics</h2>
          <p>
            Cross-tenant modification, impersonation, credentials, and emergency
            access are not granted by this overview. Those need separate audited
            controls and verified operator authorization.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
