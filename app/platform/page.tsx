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
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Platform operator</p>
          <h1>iCamp application management</h1>
          <p className="hero-panel__lead">
            Verified platform-wide totals. This is separate from a campground
            owner&apos;s management permissions and requires a reviewed global grant
            and multi-factor assurance.
          </p>
        </section>
        <section className="content-panel">
          <h2>Overall statistics</h2>
          <dl className="status-details">
            <div>
              <dt>Active organizations</dt>
              <dd>{summary.organizations}</dd>
            </div>
            <div>
              <dt>Active campgrounds</dt>
              <dd>{summary.campgrounds}</dd>
            </div>
            <div>
              <dt>Active accounts</dt>
              <dd>{summary.active_users}</dd>
            </div>
          </dl>
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
