import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { inspectBuild254Governance } from "@/lib/release/build254-security-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Three-Master security freshness · iCamp",
  robots: { index: false, follow: false },
};
export default async function SecurityGovernancePage() {
  await requireSysop("/sysop");
  const report = await inspectBuild254Governance();
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">Build 254 · seven-app governance</p>
          <h1>Multi-tier security &amp; signed Master freshness</h1>
          <p className="hero-panel__lead">
            Source evidence comes from iCamp protected pins and this deployed
            revision. No other app becomes CONNECTED from a status label.
          </p>
        </section>
        <section className="content-panel">
          <p>
            <strong>Revision:</strong>{" "}
            <code>{report.sourceRevision ?? "HOLD"}</code>
          </p>
          <p>Canonical migration: {report.previous.checksum.status}</p>
          <p>Database provenance: {report.previous.provenance.status}</p>
          <h2>Security tiers</h2>
          <ul>
            {report.security.tiers.map((tier) => (
              <li key={tier.tier}>
                {tier.tier.replaceAll("_", " ")}: {tier.status}
              </li>
            ))}
          </ul>
          <h2>Original three-Master freshness</h2>
          <ul>
            {report.freshness.results.map((entry) => (
              <li key={entry.plane}>
                {entry.plane}: {entry.status} · {entry.horizon}
              </li>
            ))}
          </ul>
          <p>
            <strong>Master CONNECTED: HOLD · Owner acceptance: HOLD</strong>
          </p>
          <p>
            <Link href="/sysop/provenance-review">
              Independent database provenance
            </Link>
            {" · "}
            <Link href="/workspaces/management/campgrounds/independent-review">
              Campground source receipt review
            </Link>
            {" · "}
            <Link href="/sysop">Return to outer shell</Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
