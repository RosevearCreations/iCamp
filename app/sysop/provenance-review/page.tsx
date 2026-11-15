import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { inspectBuild253SupervisedReview } from "@/lib/release/build253-provenance-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Canonical migration and independent source provenance · iCamp",
  robots: { index: false, follow: false },
};

export default async function ProvenanceReviewPage() {
  await requireSysop("/sysop");
  const report = await inspectBuild253SupervisedReview();
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">Build 253 · protected production review</p>
          <h1>Canonical SQL reconciliation &amp; independent provenance</h1>
          <p className="hero-panel__lead">
            Review recorded migration checksums, separately signed provenance
            and supervised next actions. No signing secrets or tenant records
            are exposed, and this screen does not apply database changes.
          </p>
        </section>
        <section className="content-panel">
          <h2>Exact source and migration ledger</h2>
          <p>
            Deployment revision:{" "}
            <code>{report.sourceRevision ?? "NOT VERIFIED"}</code>
          </p>
          <p role="status">
            <strong>{report.checksum.status}</strong>
          </p>
          <p>Database schema: {report.previousDatabaseStatus}</p>
          <table>
            <thead>
              <tr>
                <th>Migration</th>
                <th>Recorded in active ledger</th>
                <th>Canonical SQL SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {report.checksum.rows.map((item) => (
                <tr key={item.version}>
                  <td>{item.version}</td>
                  <td>
                    {item.found && item.nameMatches ? "Observed" : "HOLD"}
                  </td>
                  <td>{item.checksumMatches ? "Matches" : "HOLD"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            A matching source checksum proves consistency with the release files
            only. It does not prove independent database identity,
            physical-device enrollment, backups or completed acceptance.
          </p>
        </section>
        <section className="content-panel">
          <h2>Independent production database provenance</h2>
          <p role="status">
            <strong>{report.provenance.status}</strong>
          </p>
          <p>
            Signed receipt verified:{" "}
            {report.provenance.signatureVerified ? "Source-only" : "HOLD"}.
          </p>
          <p>Original iCamp custody: {report.previousSourceCustodyStatus}.</p>
          <p>
            Signed database provenance is bound to the deployed commit, host
            fingerprint and reviewed SQL manifest. It does not authorize a
            migration, consume a one-time nonce or activate any Master.
          </p>
        </section>
        <section className="content-panel">
          <h2>Supervised remediation evidence review</h2>
          <p>
            <strong>{report.supervised.status}</strong>
          </p>
          <ol>
            {report.supervised.tasks.map((task) => (
              <li key={task.id}>
                <strong>{task.id.replaceAll("_", " ")}</strong>: {task.status}
                <p>
                  Responsible: {task.owner}. {task.action}
                </p>
              </li>
            ))}
          </ol>
          <p>
            <strong>
              Owner acceptance: HOLD · Three-Master CONNECTED: HOLD
            </strong>
          </p>
          <p>
            <Link href="/sysop/migration-audit">
              Earlier migration-ledger inspection
            </Link>
            {" · "}
            <Link href="/sysop">Return to iCamp outer shell</Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
