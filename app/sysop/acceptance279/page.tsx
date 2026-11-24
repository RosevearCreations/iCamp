import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { acceptanceSummary279 } from "@/lib/build279/postgres.mjs";
import {
  correlateProviderReceipt279Action,
  originalRecoveryAudit279Action,
  isolatedRestoreFinalization279Action,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title:
    "Build 279 original provider receipt, owner access and isolated restore review · iCamp",
  robots: { index: false, follow: false },
};
const uuid = "[a-fA-F0-9-]{36}",
  sha = "[a-f0-9]{64}";

export default async function Acceptance279Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    correlation?: string;
    owner?: string;
    restore?: string;
  }>;
}>) {
  const { session } = await requireSysop("/sysop");
  const [result, p] = await Promise.all([
    acceptanceSummary279(session),
    searchParams,
  ]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 279 original recovery evidence</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">
            Build 279 · independent evidence correlation
          </p>
          <h1>
            Original provider receipts, recovery audit and isolated restore
            evidence
          </h1>
          <p className="hero-panel__lead">
            Original database and approved MFA operators only. A software
            deployment does not certify the original database, a source
            provider, an owner&apos;s recovery, or a physical backup restore.
            This console records independent evidence reviews; it never resets
            accounts, changes signer keys, modifies bookings or performs
            production restores.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>Original recovery evidence: {result.closure.status}</h2>
          <p>
            Original database host:{" "}
            <strong>{result.admission.host.status}</strong>
          </p>
          <p>
            Production schema/migration 0253:{" "}
            <strong>{result.admission.status}</strong>
          </p>
          <p>
            Fresh original source receipt correlations:{" "}
            <strong>{result.peers.verifiedCount}/7</strong>
          </p>
          <p>
            Owner recovery access audit: <strong>{result.owner.status}</strong>
          </p>
          <p>
            Isolated external restore review:{" "}
            <strong>{result.restore.status}</strong>
          </p>
          <p>
            Actual production restore executed: <strong>NO</strong>
          </p>
          <p>
            Independent provider finally certified by this console:{" "}
            <strong>NO</strong>
          </p>
          <p>
            <Link href="/auth/original-source-setup277">
              Original host and MFA setup instructions
            </Link>
            {" · "}
            <Link href="/sysop/acceptance278">
              Independent original source review
            </Link>
            {" · "}
            <Link href="/sysop/acceptance277">
              Original signed challenge drill
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Seven-source original signed provider receipt correlation</h2>
          <p>
            Two different ORIGINAL Ed25519-signed records are required for every
            source: a recently independently reviewed Build 277 field response
            and a separate recent Build 275 signed-source handshake. The server
            rechecks exact source, key, commit, raw signatures, independent
            nonces, challenge identifiers and timestamps before allowing a
            separate qualified operator to record correlation. This is{" "}
            <strong>source-signature correlation</strong>, not proof that an
            unrelated third-party provider certified the source.
          </p>
          <ul>
            {result.peers.sources.map((x) => (
              <li key={x.source}>
                <strong>
                  {x.source}: {x.status}
                </strong>
              </li>
            ))}
          </ul>
          <p>Available fresh independent field review IDs:</p>
          <ul>
            {result.peers.fieldCandidates.map((x) => (
              <li key={x.id}>
                {x.source}: <code>{x.id}</code>
              </li>
            ))}
          </ul>
          <p>Available separate original signed-source receipt IDs:</p>
          <ul>
            {result.peers.providerCandidates.map((x) => (
              <li key={x.id}>
                {x.source}, key {x.keyId}, revision {x.commitSha}:{" "}
                <code>{x.id}</code>
              </li>
            ))}
          </ul>
          {p.correlation ? (
            <p role="status">
              {p.correlation === "recorded"
                ? "Original source signatures linked and independent review stored; external provider acceptance remains separate."
                : "HOLD — original paired signatures, independent operator, freshness, nonce, original host or source receipt missing."}
            </p>
          ) : null}
          <form action={correlateProviderReceipt279Action}>
            <label>
              Original independently reviewed Build 278 field review UUID
              <input
                name="fieldReviewId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Separate original Build 275 signed source receipt UUID
              <input
                name="providerReceiptId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Independently verified original provider custody evidence SHA-256
              <input
                name="evidenceDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Correlate real original source receipts
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Original Rosevear account recovery access audit</h2>
          <p>
            The owner&apos;s genuine original Rosevear AAL2 session must still
            be active, independently witnessed and bound to the existing
            account. A separate, independently approved operator audits the
            original Build 278 MFA readback, password-verifier presence, account
            status, MFA factor and operator binding. The owner and previous MFA
            reviewer cannot audit their own recovery evidence.
          </p>
          <p>
            Current owner recovery audit: <strong>{result.owner.status}</strong>
          </p>
          <p>Original active MFA readback candidates:</p>
          <ul>
            {result.owner.mfaCandidates.map((x) => (
              <li key={x.id}>
                {x.audited
                  ? "INDEPENDENT ACCESS AUDIT STORED"
                  : "PENDING AUDIT"}
                : <code>{x.id}</code>
              </li>
            ))}
          </ul>
          {p.owner ? (
            <p role="status">
              {p.owner === "recorded"
                ? "Independent original recovery access audit stored. Owner session must remain independently valid."
                : "HOLD — real original owner AAL2 session, witness, binding or different auditor missing."}
            </p>
          ) : null}
          <form action={originalRecoveryAudit279Action}>
            <label>
              Genuine original Build 278 MFA readback UUID
              <input
                name="mfaReadbackId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Independent original owner-access audit SHA-256
              <input
                name="evidenceDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <button type="submit">Record original recovery access audit</button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Isolated restore four-scope final evidence review</h2>
          <p>
            Requires a genuine signed provider and original/isolated host chain
            from Builds 272–278. An additional independently authorized operator
            reviews the backup manifest plus separate original tenant isolation,
            reservation integrity, payment ledger and service health evidence.
            Never restore over live production and do not use made-up hashes to
            clear a HOLD status.
          </p>
          <p>
            Four-scope independent reviews stored:{" "}
            {result.restore.finalizedCount}
          </p>
          <ul>
            {result.restore.serviceCandidates.map((x) => (
              <li key={x.id}>
                {x.finalized
                  ? "REVIEW STORED"
                  : "NEEDS INDEPENDENT FINAL REVIEW"}
                : <code>{x.id}</code>
              </li>
            ))}
          </ul>
          {p.restore ? (
            <p role="status">
              {p.restore === "recorded"
                ? "Original isolated four-scope evidence review stored. Production restore and external provider certification remain separate."
                : "HOLD — original provider, independently reviewed isolated service or qualified distinct reviewer missing."}
            </p>
          ) : null}
          <form action={isolatedRestoreFinalization279Action}>
            <label>
              Original Build 278 restore service readback UUID
              <input
                name="serviceReadbackId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Original backup manifest SHA-256
              <input
                name="backupDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <label>
              Isolated tenant isolation evidence SHA-256
              <input
                name="tenantDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <label>
              Reservation integrity evidence SHA-256
              <input
                name="reservationDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <label>
              Payment ledger evidence SHA-256
              <input
                name="paymentDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <label>
              Isolated service health evidence SHA-256
              <input
                name="healthDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <label>
              Independent provider comparison evidence SHA-256
              <input
                name="comparisonDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={sha}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Record isolated restore final evidence review
            </button>
          </form>
        </section>
      </div>
    </SysopShell>
  );
}
