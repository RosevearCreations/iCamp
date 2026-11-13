import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { inspectBuild251Runtime } from "@/lib/release/build251-runtime-postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Production database and source custody · iCamp Sysop",
  robots: { index: false, follow: false },
};

export default async function SourceReadinessPage() {
  await requireSysop("/sysop");
  const readiness = await inspectBuild251Runtime();
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">Build 251 · protected runtime readback</p>
          <h1>Database migration & original-source custody</h1>
          <p className="hero-panel__lead">
            Read-only inspection of the database connected to this application
            and separately authenticated original-source signer custody.
          </p>
        </section>
        <section className="content-panel">
          <h2>Production database target</h2>
          <p>
            <strong>{readiness.database.status}</strong>
          </p>
          <p>
            Runtime target matches independently configured host pin:{" "}
            {readiness.database.runtimeTargetPinMatches ? "Yes" : "No / HOLD"}.
          </p>
          <p>
            Exact deployed SHA:{" "}
            <code>{readiness.sourceRevision ?? "UNAVAILABLE"}</code>
          </p>
          <p>
            No database hostname, password, guest record, signature or
            connection credential is exposed by this readback.
          </p>
          <table>
            <thead>
              <tr>
                <th>Required migration ledger</th>
                <th>Table</th>
                <th>RLS + FORCE</th>
                <th>Append-only guard</th>
              </tr>
            </thead>
            <tbody>
              {readiness.database.checklist.map((entry, index) => (
                <tr key={entry.name}>
                  <td>Build {index === 0 ? 247 : index === 1 ? 249 : 250}</td>
                  <td>
                    <code>{entry.name}</code>
                  </td>
                  <td>
                    {entry.rowLevelSecurity &&
                    entry.forceRowLevelSecurity &&
                    entry.ownerOnlyPolicies
                      ? "Checked"
                      : "HOLD"}
                  </td>
                  <td>
                    {entry.present && entry.appendOnly && entry.hasGuardTrigger
                      ? "Checked"
                      : "HOLD"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Readiness requires the actual runtime DATABASE_URL, a separately
            authenticated ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST pin and all
            three ledgers with enforced private security policies. A named
            Supabase project or CI migration does not prove deployment adoption.
          </p>
        </section>
        <section className="content-panel">
          <h2>Independent original-source signer custody</h2>
          <p>
            <strong>{readiness.signer.status}</strong>
          </p>
          <p>
            Protected original key pin configured:{" "}
            {readiness.signer.originalPinConfigured ? "Yes" : "No / HOLD"}.
          </p>
          <p>
            Distinct Ed25519 reviewer attestation:{" "}
            {readiness.signer.independentReviewerAttested
              ? "Verified source-only"
              : "HOLD"}
            .
          </p>
          <p>
            Even a valid signer-custody witness is not a live source-HEALTHY
            receipt, receiver activation, Master CONNECTED or signed owner
            production acceptance.
          </p>
          <p>
            A real custodian must separately verify the original source
            fingerprint and independent reviewer key before enrolling protected
            server-only credentials. Never copy test or developer keys into
            production.
          </p>
        </section>
        <section className="content-panel">
          <h2>Current operator decision</h2>
          <p>
            <strong>Operational acceptance: HOLD</strong>
          </p>
          <p>
            <Link href="/sysop">Return to outer shell</Link> ·{" "}
            <Link href="/settings/themes/cross-device">
              Cross-device theme checks (campground permissions required)
            </Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
