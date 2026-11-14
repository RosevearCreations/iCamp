import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CrossDeviceThemeReview } from "@/components/build251-cross-device-theme-review";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { getRuntimeConfig } from "@/lib/config/runtime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cross-device Meadow / Orbit review · iCamp",
  robots: { index: false, follow: false },
};

export default async function CrossDeviceThemePage() {
  await requireAnyCampgroundPermission(
    "reports.read",
    "/settings/themes/cross-device",
  );
  const sourceRevision = getRuntimeConfig().buildSha;
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 251 · independent visual acceptance</p>
          <h1>Meadow and Orbit across our devices</h1>
          <p className="hero-panel__lead">
            Verify the evergreen Meadow theme and futuristic Orbit Command on a
            desktop, tablet and phone. These manual reports are saved only on
            each browser until explicitly copied and combined.
          </p>
        </section>
        <section className="content-panel">
          <p>
            <Link href="/settings/themes">Return to theme management</Link>
          </p>
          <CrossDeviceThemeReview sourceRevision={sourceRevision} />
        </section>
      </div>
    </AppShell>
  );
}
