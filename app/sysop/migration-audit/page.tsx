import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { inspectBuild252ReleaseReadiness } from "@/lib/release/build252-migration-ledger-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Migration custody and remediation · iCamp Sysop",
  robots: { index: false, follow: false },
};

export default async function MigrationAuditPage() {
  await requireSysop("/sysop");
  const state = await inspectBuild252ReleaseReadiness();
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">Build 252 · independent source audit</p>
          <h1>Production migration &amp; custody action plan</h1>
          <p className="hero-panel__lead">
            Read-only original-database migration history, protected source
            custody, and accountable next actions. No deployment credentials,
            private customer records or raw signing material are displayed.
          </p>
        </section>
        <section className="content-panel">
          <h2>Recorded migration history</h2>
          <p role="status">
            <strong>{state.migrationHistory.status}</strong>
          </p>
          <p>
            Active database target readback:{" "}
            <strong>{state.previous.database.status}</strong>
          </p>
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Required source feature</th>
                <th>Recorded</th>
                <th>Recorded digest format</th>
                <th>Canonical source comparison</th>
              </tr>
            </thead>
            <tbody>
              {state.migrationHistory.details.map((row) => (
                <tr key={row.version}>
                  <td>{row.version}</td>
                  <td>{row.feature}</td>
                  <td>
                    {row.recordPresent && row.versionMatches
                      ? "Observed"
                      : "HOLD"}
                  </td>
                  <td>
                    {row.recordedChecksumWellFormed
                      ? "Plausible SHA-256"
                      : "HOLD"}
                  </td>
                  <td>Not independently verified</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            A row in icamp_meta.schema_migrations is evidence of recorded
            migration history, not proof that its checksum matches the exact
            GitHub migration file. Canonical source comparison and owner
            authorization remain separate.
          </p>
        </section>
        <section className="content-panel">
          <h2>Accountable next actions</h2>
          <p>
            <strong>{state.remediation.status}</strong>
          </p>
          <ol>
            {state.remediation.items.map((item) => (
              <li key={item.id}>
                <strong>{item.id.replaceAll("_", " ")}</strong> — {item.status}
                <p>
                  Responsible: {item.owner}. {item.action}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section className="content-panel">
          <h2>Owner and Master control-plane boundaries</h2>
          <p>
            <strong>Production acceptance: HOLD</strong>. No database migration,
            signer enrollment, remote Master connection, receiver activation or
            owner acceptance can be performed from this read-only view.
          </p>
          <p>
            <Link href="/sysop/readiness">
              Review Build 251 source and database readbacks
            </Link>
            {" · "}
            <Link href="/sysop">Return to outer shell</Link>
            {" · "}
            <Link href="/settings/themes/cross-device">
              Inspect Meadow / Orbit visual review
            </Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
