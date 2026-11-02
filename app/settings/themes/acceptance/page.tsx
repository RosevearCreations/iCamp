import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StandardThemeOwnerReview } from "@/components/standard-theme-owner-review";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { getRuntimeConfig } from "@/lib/config/runtime";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Independent Standard Theme Owner Review · iCamp",
  description:
    "Review accessible Standard Theme screens, prepare independent owner evidence, and read unverified decision history without automatic approval.",
};

export default async function StandardThemeAcceptancePage() {
  const session = await requireAnyCampgroundPermission(
    "reports.read",
    "/settings/themes/acceptance",
  );
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) =>
        (await hasCampgroundPermission(
          session.user.id,
          campground.campgroundId,
          "reports.read",
        ))
          ? campground
          : null,
      ),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  const sourceSha = getRuntimeConfig().buildSha;
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
            Build 172 · Independent Owner Review Intake &amp; Evidence
          </p>
          <h1>Does iCamp feel right?</h1>
          <p className="hero-panel__lead">
            Review the grass-green campground interface across actual desktop,
            tablet and phone layouts: management, capacity forecasts, camper
            escalation evidence follow-ups, I.T. and accessible display
            settings. Record corrections, revisit the owner retest worklist, and
            summarize accessible interaction checks. Prepare a versioned
            independent-owner handoff and review historic decision claims
            without automatic approval or external submission.
          </p>
        </section>
        <StandardThemeOwnerReview
          preparerId={session.user.id}
          sourceSha={/^[a-f0-9]{40}$/i.test(sourceSha) ? sourceSha : ""}
          campgrounds={authorized}
        />
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
