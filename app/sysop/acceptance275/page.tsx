import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { inspectOwnerEnrollment270 } from "@/lib/build270/postgres.mjs";
import { sourceSummary273 } from "@/lib/build273/postgres.mjs";
import { classify275 } from "@/lib/build275/diagnostics.mjs";
import { configuredSources275, handshakeSummary275 } from "@/lib/build275/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 275 recovery acceptance · iCamp",
  robots: { index: false, follow: false },
};

export default async function Acceptance275Page() {
  const { session } = await requireSysop("/sysop");
  const [owner, host, ledger] = await Promise.all([
    inspectOwnerEnrollment270(), sourceSummary273(), handshakeSummary275()
  ]);
  const result = classify275({
    owner, host, ledger, configured: configuredSources275(),
    session: {
      originalRosevear: session.user.username?.toLowerCase() === "rosevear",
      aal2: session.assuranceLevel === "aal2"
    }
  });
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 275 · original production evidence</p>
          <h1>Rosevear login and seven-peer recovery certification</h1>
          <p className="hero-panel__lead">
            Original read-only diagnostics. A successful deployment is not
            proof of original owner login, live signed sources or restore.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>Recovery closure: {result.closureStatus}</h2>
          <p>Original host: {result.hostStatus}</p>
          <p>Owner and MFA: {result.ownerStatus}</p>
          <p>
            Signed sources: {result.handshakeStatus} ({result.signedCount}/7)
          </p>
          <p>Receipt ledger: {ledger.status}</p>
        </section>
        <section className="content-panel">
          <h2>Source-specific handshake receipts</h2>
          <ul>
            {result.checks.map((check) => (
              <li key={check.source}>
                <strong>{check.source}: {check.status}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="content-panel">
          <h2>Next recovery evidence</h2>
          <p>
            <Link href="/auth/owner-setup">Owner one-time password setup</Link>
            {" · "}
            <Link href="/auth/mfa?next=%2Fsysop">Original MFA</Link>
            {" · "}
            <Link href="/sysop/acceptance274">Build 274 independent review</Link>
          </p>
          <p>
            Require an independently pinned original database, applied
            migration 0249, original peer public keys and commit revisions,
            seven fresh Ed25519 signatures, an actual Rosevear AAL2 session,
            verified owner binding, and independent isolated restore review.
            No aggregate counters, test fixtures or unreviewed signature
            can close recovery.
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
