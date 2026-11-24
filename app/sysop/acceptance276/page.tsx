import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import {
  actualOwnerReadback276,
  originalPeerOverview276,
  signedPeerReadback276,
  originalRestoreReadback276,
} from "@/lib/build276/postgres.mjs";
import {
  proposePeerSigner276Action,
  approvePeerSigner276Action,
  independentRestore276Action,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 276 original peer enrollment and recovery · iCamp",
  robots: { index: false, follow: false },
};

const uuidPattern = "[a-fA-F0-9-]{36}";
const shaPattern = "[a-f0-9]{64}";

export default async function Acceptance276Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    proposal?: string;
    approval?: string;
    restore?: string;
  }>;
}>) {
  const { session } = await requireSysop("/sysop");
  const [owner, peers, signed, restore, statuses] = await Promise.all([
    actualOwnerReadback276(session),
    originalPeerOverview276(),
    signedPeerReadback276(),
    originalRestoreReadback276(),
    searchParams,
  ]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 276 original recovery</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 276 · independent original evidence</p>
          <h1>Peer signer enrollment, Rosevear login and restore closure</h1>
          <p className="hero-panel__lead">
            Original database and verified MFA operator access only. This
            console cannot create a privileged account, fake a seven-source
            handshake, restore a production database or certify an unobserved
            external provider.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>Production recovery gates</h2>
          <p>Original schema: <strong>{peers.admission.status}</strong>.</p>
          <p>Owner login readback: <strong>{owner.status}</strong>.</p>
          <p>Fresh cryptographic peer readback: <strong>{signed.status}</strong>.</p>
          <p>Signed original sources: <strong>{signed.verifiedCount}/7</strong>.</p>
          <p>Restore closure operations: <strong>{restore.status}</strong>.</p>
          <p>
            All operational gates remain HOLD unless separate independent
            evidence is present. A Vercel READY build certifies software
            deployment, not owner recovery or real original-host restoration.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original Rosevear account and MFA readback</h2>
          <ul>
            {owner.checks.map(check => (
              <li key={check.id}>
                <strong>{check.id}: {check.status}</strong>
                <p>{check.detail}</p>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/auth/owner-setup">Owner first-password ceremony</Link>
            {" · "}
            <Link href="/auth/owner-diagnostics">Login diagnostics</Link>
            {" · "}
            <Link href="/auth/mfa?next=%2Fsysop">Original MFA</Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Seven peer-signature readbacks</h2>
          <p>
            Every row below is checked against its approved Ed25519 public key
            and source revision, including a fresh signature over the stored
            raw message. It is not merely a count of database rows.
          </p>
          <ul>
            {signed.sources.map(peer => (
              <li key={peer.source}>
                <strong>{peer.source}: {peer.status}</strong>
              </li>
            ))}
          </ul>
          <p>
            Enrolled sources send a new independent signed challenge using
            <code> POST /api/internal/source-handshake276</code>.
          </p>
        </section>
        <section className="content-panel">
          <h2>Stage an original peer public signer</h2>
          <p>
            The first authenticated platform operator enters a peer public key
            after verifying its fingerprint and deployed revision using an
            independent trusted source. A different MFA-verified platform
            operator must approve the proposal before receipts are accepted.
            Never enter private keys, passwords or provider tokens.
          </p>
          {statuses.proposal ? (
            <p role="status">
              {statuses.proposal === "recorded"
                ? "Signer proposal recorded. Separate reviewer required."
                : "HOLD — original host, validated public key, independent evidence or operator authorization missing."}
            </p>
          ) : null}
          <form action={proposePeerSigner276Action}>
            <label>
              Original application
              <select name="sourceId" required>
                <option value="ai-data-platform">AI Data Platform</option>
                <option value="rosevear-comms-hub">Rosevear Comms Hub</option>
                <option value="rosevear-ai-hub">Rosevear AI Hub</option>
                <option value="yard-workers">Yard Workers</option>
                <option value="rosie-dazzlers">Rosie Dazzlers</option>
                <option value="devil-n-dove">Devil n Dove</option>
                <option value="icamp">iCamp</option>
              </select>
            </label>
            <label>
              Original source key identifier
              <input name="keyId" required minLength={8} maxLength={80}
                pattern="[a-z0-9_-]{8,80}" autoComplete="off"/>
            </label>
            <label>
              Exact original source commit SHA-1 (40 hex characters)
              <input name="commitSha" required minLength={40} maxLength={40}
                pattern="[a-f0-9]{40}" autoComplete="off"/>
            </label>
            <label>
              Verified Ed25519 SPKI public key (PEM only)
              <textarea name="publicKeyPem" required maxLength={1200}
                rows={5} autoComplete="off"/>
            </label>
            <label>
              Independently observed public key SHA-256 fingerprint
              <input name="keyFingerprint" required pattern={shaPattern}
                minLength={64} maxLength={64} autoComplete="off"/>
            </label>
            <label>
              Out-of-band original source custody evidence SHA-256
              <input name="evidenceDigest" required pattern={shaPattern}
                minLength={64} maxLength={64} autoComplete="off"/>
            </label>
            <button type="submit">Stage signer for independent review</button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Independent second-person signer review</h2>
          <p>
            The reviewer must not be the proposer. Review the original key
            fingerprint and source revision outside this application; a
            proposed key alone is not trusted.
          </p>
          <ul>
            {peers.proposals.map(p => (
              <li key={p.id}>
                <strong>{p.sourceId}: {p.reviewed ? "REVIEWED — live challenge required" : "PENDING SECOND REVIEW"}</strong>
                <p>Proposal: <code>{p.id}</code>; key: {p.keyId}</p>
                <p>Source revision: <code>{p.commitSha}</code></p>
                <p>Key fingerprint: <code>{p.fingerprint}</code></p>
              </li>
            ))}
          </ul>
          {statuses.approval ? (
            <p role="status">
              {statuses.approval === "recorded"
                ? "Second-person key review stored; genuine signed peer challenge still required."
                : "HOLD — the reviewer must differ from the proposer and independently prove source custody."}
            </p>
          ) : null}
          <form action={approvePeerSigner276Action}>
            <label>
              Pending signer proposal UUID
              <input name="proposalId" required pattern={uuidPattern}
                maxLength={36} autoComplete="off"/>
            </label>
            <label>
              Independent external fingerprint/revision review SHA-256
              <input name="reviewDigest" required pattern={shaPattern}
                minLength={64} maxLength={64} autoComplete="off"/>
            </label>
            <button type="submit">Record separate signer approval</button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Independent original restore closure review</h2>
          <p>
            An original Build 272 isolated four-scope restore review and signed
            Build 273 provider host attestation must already exist. A second
            operator, distinct from both earlier restore reviewers, must
            compare actual original and isolated host readbacks. Recording
            review evidence never executes a restore or automatically
            certifies production recovery.
          </p>
          <p>Independent review rows: {restore.reviewed}.</p>
          <ul>
            {restore.records.map(record => (
              <li key={record.id}>
                <strong>{record.providerId}: {record.reviewed ? "INDEPENDENT REVIEW RECORDED" : "PENDING REVIEW"}</strong>
                <p>Provider attestation UUID: <code>{record.id}</code></p>
              </li>
            ))}
          </ul>
          {statuses.restore ? (
            <p role="status">
              {statuses.restore === "recorded"
                ? "Independent restore review recorded; external host readback acceptance remains separate."
                : "HOLD — original provider, four-scope chain or independent reviewer not verified."}
            </p>
          ) : null}
          <form action={independentRestore276Action}>
            <label>
              Original signed provider attestation UUID
              <input name="attestationId" required pattern={uuidPattern}
                maxLength={36} autoComplete="off"/>
            </label>
            <label>
              Independent external original/isolated host readback SHA-256
              <input name="evidenceDigest" required pattern={shaPattern}
                minLength={64} maxLength={64} autoComplete="off"/>
            </label>
            <button type="submit">Record separate restore evidence review</button>
          </form>
        </section>
      </div>
    </SysopShell>
  );
}
