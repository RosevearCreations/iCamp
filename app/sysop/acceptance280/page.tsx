import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { acceptanceSummary280 } from "@/lib/build280/postgres.mjs";
import {
  proposeExternalProviderKey280Action,
  reviewExternalProviderKey280Action,
  recordProviderSignedClosure280Action,
  witnessOwnerRecovery280Action,
  recordIsolatedCertificate280Action,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 280 original provider signed restore review · iCamp",
  robots: { index: false, follow: false },
};
const uuid = "[a-fA-F0-9-]{36}";
const digest = "[a-f0-9]{64}";

export default async function Acceptance280Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    key?: string;
    pin?: string;
    signed?: string;
    owner?: string;
    certificate?: string;
  }>;
}>) {
  const { session } = await requireSysop("/sysop");
  const [result, p] = await Promise.all([acceptanceSummary280(), searchParams]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 280 original provider and recovery certificate</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">
            Build 280 · original independent provider signature
          </p>
          <h1>
            Original provider signed closure and isolated review certificate
          </h1>
          <p className="hero-panel__lead">
            The original provider must sign the actual isolated restore using
            its separately verified Ed25519 private key. iCamp verifies the
            original independent public key but never creates or accesses the
            provider private key. A different approved reviewer must witness the
            original Rosevear MFA session. No action on this page restores
            production, resets a password, grants access or certifies a provider
            without independently observed evidence.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>Original acceptance status</h2>
          <p>
            <strong>{result.status}</strong>
          </p>
          <p>Original database hostname: {result.admission.host.status}</p>
          <p>Migration 0254: {result.admission.status}</p>
          <p>Seven fresh correlated source receipts: {result.sourceCount}/7</p>
          <p>
            Verified original external signed closures:{" "}
            {result.providerClosures.length}
          </p>
          <p>
            Active original owner recovery witnesses:{" "}
            {result.ownerWitnesses.length}
          </p>
          <p>
            Isolated review certificates recorded: {result.certificates.length}
          </p>
          <p>
            Live production restored: <strong>NO</strong>
          </p>
          <p>
            External provider final ACK: <strong>NOT ESTABLISHED HERE</strong>
          </p>
          <p>
            <Link href="/sysop/acceptance279">
              Build 279 independent peer/source and restore audit
            </Link>
            {" · "}
            <Link href="/auth/original-source-setup277">
              Original owner setup
            </Link>
            {" · "}
            <Link href="/sysop/migration-audit">
              Original migration readback
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>1. Provider public key proposal — genuine out-of-band source</h2>
          <p>
            Obtain only the ORIGINAL backup provider public SPKI Ed25519 key,
            identifier and independently confirmed SHA-256 DER fingerprint from
            that same provider. Never generate a key on behalf of the provider
            or paste a private key. A different verified operator must review
            the original source.
          </p>
          {p.key ? (
            <p role="status">
              {p.key === "proposed"
                ? "Public provider key proposed; second independent review still required."
                : "HOLD — genuine provider public key or original AAL2 approval missing."}
            </p>
          ) : null}
          <form action={proposeExternalProviderKey280Action}>
            <label>
              Original provider ID
              <input
                name="providerId"
                required
                minLength={8}
                maxLength={64}
                pattern="[a-z0-9_-]{8,64}"
                autoComplete="off"
              />
            </label>
            <label>
              Original provider key identifier
              <input
                name="keyId"
                required
                minLength={8}
                maxLength={80}
                pattern="[a-z0-9_-]{8,80}"
                autoComplete="off"
              />
            </label>
            <label>
              External provider public Ed25519 SPKI PEM — PUBLIC only
              <textarea
                name="publicKeyPem"
                required
                maxLength={1200}
                rows={4}
              />
            </label>
            <label>
              Original public-key DER fingerprint SHA-256
              <input
                name="fingerprint"
                required
                maxLength={64}
                minLength={64}
                pattern={digest}
                autoComplete="off"
              />
            </label>
            <label>
              Out-of-band original provider identity proof SHA-256
              <input
                name="evidenceDigest"
                required
                maxLength={64}
                minLength={64}
                pattern={digest}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Propose independently sourced provider public key
            </button>
          </form>
          <h3>Original provider public key proposals</h3>
          <ul>
            {result.keyProposals.map((x) => (
              <li key={x.id}>
                {x.providerId} / {x.keyId}:{" "}
                {x.reviewed ? "SECOND REVIEW RECORDED" : "PENDING REVIEW"}
                <p>
                  Proposal UUID: <code>{x.id}</code>
                </p>
                <p>
                  Fingerprint: <code>{x.fingerprint}</code>
                </p>
                {x.reviewId ? (
                  <p>
                    Approved review UUID: <code>{x.reviewId}</code>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {p.pin ? (
            <p role="status">
              {p.pin === "reviewed"
                ? "Separate original provider public key reviewer recorded; genuine signature still required."
                : "HOLD — original provider identity or different reviewer missing."}
            </p>
          ) : null}
          <form action={reviewExternalProviderKey280Action}>
            <label>
              Original external provider key proposal UUID
              <input
                name="proposalId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Independent provider fingerprint review SHA-256
              <input
                name="evidenceDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={digest}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Record second-person original provider key review
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>2. Original backup provider Ed25519-signed closure</h2>
          <p>
            The real backup provider must sign an actual fresh isolated restore
            closure statement with its securely held private key. The signature
            binds its provider identity, original and isolated host
            fingerprints, backup manifest and all four restore scopes. The owner
            does not sign pretending to be a provider. This form rejects a
            missing or unverified provider public key, incorrect original
            evidence, replay or expired signature.
          </p>
          {p.signed ? (
            <p role="status">
              {p.signed === "verified"
                ? "Original provider signature verified and independent review recorded; certificate requires all other original proofs."
                : "HOLD — genuine original signed provider payload or independent evidence missing."}
            </p>
          ) : null}
          <form action={recordProviderSignedClosure280Action}>
            <label>
              Independent approved provider key REVIEW UUID
              <input
                name="keyReviewId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Build 279 original isolated evidence UUID
              <input
                name="isolatedEvidenceId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Exact original provider-signed JSON statement — no private key
              <textarea name="body" required maxLength={3000} rows={7} />
            </label>
            <label>
              Original Ed25519 signature, base64url (PUBLIC signed output)
              <textarea name="signature" required maxLength={100} rows={2} />
            </label>
            <button type="submit">
              Verify genuine original provider closure signature
            </button>
          </form>
          <h3>Cryptographically verified original provider closure records</h3>
          <ul>
            {result.providerClosures.map((x) => (
              <li key={x.id}>
                {x.providerId}: VERIFIED SIGNATURE
                <p>
                  Original closure UUID: <code>{x.id}</code>
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className="content-panel">
          <h2>3. Independent original Rosevear MFA recovery completion</h2>
          <p>
            The real original Rosevear owner must have an independently
            witnessed, currently active AAL2 session. A different authorized
            operator, not the owner, prior MFA reviewer or access auditor, must
            independently witness its completion within the fifteen-minute
            reauthentication window.
          </p>
          <ul>
            {result.ownerCandidates.map((x) => (
              <li key={x.id}>
                Live Build 279 owner audit UUID: <code>{x.id}</code>
              </li>
            ))}
          </ul>
          {p.owner ? (
            <p role="status">
              {p.owner === "recorded"
                ? "Independent owner completion witness recorded; current genuine owner session remains necessary."
                : "HOLD — original active Rosevear account, MFA or different witness missing."}
            </p>
          ) : null}
          <form action={witnessOwnerRecovery280Action}>
            <label>
              Genuine original Build 279 owner access-audit UUID
              <input
                name="ownerAuditId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Independent original login recovery witness SHA-256
              <input
                name="evidenceDigest"
                required
                maxLength={64}
                minLength={64}
                pattern={digest}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Record original Rosevear recovery completion witness
            </button>
          </form>
          <h3>Currently active verified recovery witness records</h3>
          <ul>
            {result.ownerWitnesses.map((x) => (
              <li key={x.id}>
                Owner witness UUID: <code>{x.id}</code>
              </li>
            ))}
          </ul>
        </section>
        <section className="content-panel">
          <h2>4. Original isolated restore acceptance review certificate</h2>
          <p>
            A DIFFERENT approved platform reviewer checks all seven genuine
            current original source correlations, a separate verified original
            provider-signed closure, a live witnessed Rosevear AAL2 session and
            the genuine four-scope isolated provider restore evidence. This is
            an immutable independent REVIEW certificate, not a legal provider
            guarantee, live production restore or automatic external provider
            final acknowledgment.
          </p>
          {p.certificate ? (
            <p role="status">
              {p.certificate === "recorded"
                ? "Original isolated review certificate stored; provider external final ACK remains separate."
                : "HOLD — original signed provider, seven peers, live MFA session, isolate or independent reviewer missing."}
            </p>
          ) : null}
          <form action={recordIsolatedCertificate280Action}>
            <label>
              Original cryptographically verified provider closure UUID
              <input
                name="providerClosureId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              Original active Rosevear recovery witness UUID
              <input
                name="ownerWitnessId"
                required
                maxLength={36}
                pattern={uuid}
                autoComplete="off"
              />
            </label>
            <label>
              External independent final comparison evidence SHA-256
              <input
                name="evidenceDigest"
                required
                minLength={64}
                maxLength={64}
                pattern={digest}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Record isolated evidence acceptance review certificate
            </button>
          </form>
          <h3>Recorded immutable original isolated review certificates</h3>
          <ul>
            {result.certificates.map((x) => (
              <li key={x.id}>
                Certificate UUID: <code>{x.id}</code>
                <p>
                  Original provider closure: <code>{x.providerClosureId}</code>
                </p>
                <p>
                  Real Rosevear MFA witness: <code>{x.ownerWitnessId}</code>
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SysopShell>
  );
}
