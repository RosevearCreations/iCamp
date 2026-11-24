import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { acceptanceSummary277 } from "@/lib/build277/postgres.mjs";
import { ownerSourcePin277Action, externalRestore277Action } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 277 original field acceptance · iCamp",
  robots: { index: false, follow: false },
};
const uuidPattern = "[a-fA-F0-9-]{36}";
const shaPattern = "[a-f0-9]{64}";

export default async function Acceptance277Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ ownerPin?: string; externalRestore?: string }>;
}>) {
  const { session } = await requireSysop("/sysop");
  const [result, statuses] = await Promise.all([
    acceptanceSummary277(session),
    searchParams,
  ]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 277 original field acceptance</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">
            Build 277 · original provider field evidence
          </p>
          <h1>
            Owner source pins, fresh field challenges and restore acceptance
          </h1>
          <p className="hero-panel__lead">
            This protected console reads original private evidence only and
            cannot modify a booking, payment, privileged grant, source
            credential or live production database. It cannot manufacture source
            responses or independently confirm an unobserved physical restore.
          </p>
        </section>
        <section className="content-panel" aria-live="polite">
          <h2>Original production certification: {result.closure.status}</h2>
          <p>
            Owner-verified expected database host:{" "}
            <strong>{result.admission.host.status}</strong>
          </p>
          <p>
            Original migration 0251: <strong>{result.admission.status}</strong>
          </p>
          <p>
            Original Rosevear MFA/account witness:{" "}
            <strong>{result.owner.status}</strong>
          </p>
          <p>
            Fresh server-issued challenge responses:{" "}
            <strong>{result.peer.count}/7</strong>
          </p>
          <p>
            Peer challenge readback: <strong>{result.peer.status}</strong>
          </p>
          <p>
            External isolated restore: <strong>{result.restore.status}</strong>
          </p>
          <p>
            Production database restored by this feature: <strong>NO</strong>
          </p>
          <p>
            <Link href="/auth/original-source-setup277">
              Detailed owner setup and independent witness instructions
            </Link>
            {" · "}
            <Link href="/sysop/acceptance276">
              Build 276 second-person public-key review
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Original peer owner-pin adoption</h2>
          <p>
            Requires the actual original Rosevear account, freshly verified AAL2
            MFA session, separate witnessed original login, and a peer key
            approved by a different platform operator in Build 276. The owner
            must verify the original public-key fingerprint and exact source
            revision out-of-band before recording adoption.
          </p>
          <ul>
            {result.peer.adopted.map((x) => (
              <li key={x.sourceId + x.keyId}>
                <strong>{x.sourceId}</strong> · {x.keyId}
                <p>
                  Source revision: <code>{x.commitSha}</code>
                </p>
                <p>
                  Ed25519 fingerprint: <code>{x.fingerprint}</code>
                </p>
              </li>
            ))}
          </ul>
          {statuses.ownerPin ? (
            <p role="status">
              {statuses.ownerPin === "recorded"
                ? "Owner pin adoption recorded. Genuine signed field response still required."
                : "HOLD — original owner, session, host, migrations, independent review, or external proof missing."}
            </p>
          ) : null}
          <form action={ownerSourcePin277Action}>
            <label>
              Original independently approved Build 276 peer proposal UUID
              <input
                name="proposalId"
                required
                pattern={uuidPattern}
                maxLength={36}
                autoComplete="off"
              />
            </label>
            <label>
              Independently observed owner source custody SHA-256
              <input
                name="evidenceDigest"
                required
                pattern={shaPattern}
                minLength={64}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Adopt original source pin with active MFA
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Server-issued, original signed peer field drill</h2>
          <p>
            Each independently pinned peer signs a fresh request to
            <code> POST /api/internal/peer-challenge277</code>. iCamp returns a
            random server-issued challenge ID valid for 90 seconds. The original
            peer signs the exact response containing that ID and sends it to
            <code> POST /api/internal/peer-response277</code>. One response per
            challenge is accepted; the receiver cryptographically rechecks raw
            signatures, original revisions and freshness.
          </p>
          <ul>
            {result.peer.checks.map((x) => (
              <li key={x.source}>
                <strong>
                  {x.source}: {x.status}
                </strong>
              </li>
            ))}
          </ul>
          <p>
            Test receipts or scheduled samples never substitute for original
            application signer custody. Results expire from the current readback
            after five minutes. These are technical signature checks, not
            independent physical source certification.
          </p>
        </section>
        <section className="content-panel">
          <h2>External isolated restore review</h2>
          <p>
            Requires a real signed original backup-provider attestation, an
            independently reviewed isolated four-scope restore, and a verified
            second external readback of original and isolated host fingerprints.
            The reviewer must differ from the Build 276 closure reviewer and
            Build 272 dry-run reviewer. Never restore over live production.
          </p>
          <p>
            Independently recorded external reviews: {result.restore.reviewed}.
          </p>
          <ul>
            {result.restore.records.map((record) => (
              <li key={record.closureId}>
                <strong>
                  {record.providerId}:{" "}
                  {record.reviewed
                    ? "REVIEW STORED"
                    : "PENDING DISTINCT REVIEW"}
                </strong>
                <p>
                  Build 276 closure review UUID: <code>{record.closureId}</code>
                </p>
              </li>
            ))}
          </ul>
          {statuses.externalRestore ? (
            <p role="status">
              {statuses.externalRestore === "recorded"
                ? "External fingerprint comparison review recorded; field confirmation remains required."
                : "HOLD — signed original provider chain, matching external host digests, or independent reviewer missing."}
            </p>
          ) : null}
          <form action={externalRestore277Action}>
            <label>
              Original Build 276 closure review UUID
              <input
                name="closureReviewId"
                required
                pattern={uuidPattern}
                maxLength={36}
                autoComplete="off"
              />
            </label>
            <label>
              Independent external restore evidence SHA-256
              <input
                name="evidenceDigest"
                required
                pattern={shaPattern}
                minLength={64}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <label>
              Original production host SHA-256 (from provider)
              <input
                name="sourceHostDigest"
                required
                pattern={shaPattern}
                minLength={64}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <label>
              Distinct isolated restore host SHA-256 (from provider)
              <input
                name="isolatedHostDigest"
                required
                pattern={shaPattern}
                minLength={64}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Record independent original restore acceptance review
            </button>
          </form>
        </section>
      </div>
    </SysopShell>
  );
}
