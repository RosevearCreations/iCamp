import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StandardThemeOwnerReview } from "@/components/standard-theme-owner-review";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Standard Theme Owner Review · iCamp",
  description:
    "Walk through real management, analytics, guest service and I.T. screens and return clear Standard theme acceptance notes.",
};

export default async function StandardThemeAcceptancePage() {
  await requireAnyCampgroundPermission(
    "reports.read",
    "/settings/themes/acceptance",
  );
  return (
    <AppShell>
      <div className="page-stack camp-command">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/settings/themes">Theme settings</Link>
          <span>/</span>
          <span>Owner review</span>
        </nav>
        <section className="hero-panel camp-command__hero">
          <p className="eyebrow">
            Build 166 · Standard / Cross-Device Review &amp; Corrections
          </p>
          <h1>Does iCamp feel right?</h1>
          <p className="hero-panel__lead">
            Review the grass-green campground interface across actual desktop,
            tablet and phone layouts: management, capacity forecasts, camper
            escalation evidence readback, I.T. and accessible display settings.
          </p>
        </section>
        <StandardThemeOwnerReview />
        <section className="content-panel ops-detail-card">
          <h2>What this does not authorize</h2>
          <p>
            Owner visual feedback does not enable subscription billing, approve
            legal terms, activate an Omnichannel gateway, or override the
            separate production verification process. Those decisions require
            their own evidence and authorization.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
