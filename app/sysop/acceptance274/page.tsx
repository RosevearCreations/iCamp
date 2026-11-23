import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { sourceSummary273 } from "@/lib/build273/postgres.mjs";
import { classify274 } from "@/lib/build274/certification.mjs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Build 274 live certification · iCamp", robots: { index: false, follow: false } };
export default async function Acceptance274Page() {
  const { session } = await requireSysop("/sysop");
  const source = await sourceSummary273();
  const ownerSession = {
    originalRosevear: session.user.username?.toLowerCase() === "rosevear",
    aal2: session.assuranceLevel === "aal2",
  };
  const result = classify274(source, ownerSession);
  return <SysopShell><div className="page-stack standard-ops-page">
    <section className="hero-panel meadow-hero">
      <p className="eyebrow">Build 274 · original production acceptance</p>
      <h1>Rosevear MFA, live sources and independent recovery certification</h1>
      <p className="hero-panel__lead">Read-only acceptance gates. No account grants, customer reservations, receipts, provider signatures or database restorations are created by this page.</p>
    </section>
    <section className="content-panel" aria-live="polite">
      <h2>Certification status: {result.status}</h2>
      <p>Original source observation: {result.sourceStatus}. Source counters alone do not certify live handshakes.</p>
      <ul>{result.checks.map(check=><li key={check.id}><strong>{check.id}: {check.status}</strong><p>{check.detail}</p></li>)}</ul>
    </section>
    <section className="content-panel">
      <h2>Original evidence entry points</h2>
      <p><Link href="/auth/mfa?next=%2Fsysop">Owner authenticator and 15-minute AAL2 verification</Link></p>
      <p><Link href="/sysop/acceptance273">Signed booking/Comms ACK, incident and restore provider custody</Link></p>
      <p><Link href="/sysop/acceptance272">Original backup, provider and tenant field review</Link></p>
      <p><Link href="/sysop/readiness">Production database host and migration readiness</Link></p>
      <p>Seven-source certification stays HOLD until source-by-source independently verified timestamps, signer identity and freshness can be read from the original source ledger. Do not infer it from successful GitHub or Vercel deployment.</p>
    </section>
  </div></SysopShell>;
}
