import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { inspectFieldAcceptance272 } from "@/lib/build272/postgres.mjs";
import {
  witnessOwnerLogin272Action,
  reviewCommsIncident272Action,
  reviewRestoreDryRun272Action,
} from "./actions";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Original-host field acceptance · iCamp",
  robots: { index: false, follow: false },
};
const digestPattern = "[a-f0-9]{64}";
const uuidPattern = "[a-fA-F0-9-]{36}";
export default async function Field272Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ owner?: string; comms?: string; restore?: string }>;
}>) {
  await requireSysop("/sysop");
  const [e, p] = await Promise.all([inspectFieldAcceptance272(), searchParams]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Original-host acceptance · Build 272</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 272 · supervised original-source only</p>
          <h1>Owner login, live provider, Comms and restore acceptance</h1>
          <p className="hero-panel__lead">
            Only original host, private source-linked receipts and independent
            operators can establish acceptance. These records do not create
            accounts, bypass MFA, capture/refund payments, send Comms messages,
            close incidents or restore a database.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original production adoption</h2>
          <p>
            <strong>{e.admission.status}</strong>
          </p>
          <p>
            Independently pinned original host:{" "}
            {e.admission.hostPinned ? "Yes" : "HOLD"}. Migration 0247 adopted:{" "}
            {e.admission.adopted ? "YES" : "HOLD"}.
          </p>
          <p>
            We will not substitute the connected development database for the
            independent original iCamp production database.
          </p>
        </section>
        <section className="content-panel">
          <h2>Rosevear original operator login</h2>
          <p>
            <strong>{e.owner.status}</strong>. Active original AAL2 session
            witness records: {e.owner.witnessedSessions}.
          </p>
          <p>
            Another verified platform owner must witness a real, unrevoked,
            original, MFA-authenticated Rosevear session with active account,
            real verified email, password verifier, and separately approved
            platform grant. A 12-character password alone never creates GOD MODE
            access.
          </p>
          {p.owner ? (
            <p role="status">
              {p.owner === "recorded"
                ? "Original session witness recorded. Account privileges unchanged."
                : "HOLD — original active MFA session, reviewer or host missing."}
            </p>
          ) : null}
          <form action={witnessOwnerLogin272Action}>
            <label>
              Original active MFA session record ID (UUID)
              <input
                name="sessionId"
                required
                pattern={uuidPattern}
                maxLength={36}
                autoComplete="off"
              />
            </label>
            <label>
              Independent private login evidence SHA-256
              <input
                name="evidenceDigest"
                required
                pattern={digestPattern}
                minLength={64}
                maxLength={64}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              Witness verified original owner session
            </button>
          </form>
          <p>
            Enter the session record identifier, never an access token,
            password, recovery code, or MFA seed.
          </p>
          <p>
            <Link href="/sysop/enrollment271">
              Original owner ceremony and source pairing
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Camp Rosevear original processor and guest acceptance</h2>
          <p>
            <strong>{e.booking.status}</strong>. Independently reviewed original
            booking chains: {e.booking.reviewed}.
          </p>
          <p>
            Only tenant-specific, separate campground managers can certify a
            verified test-processor payment reference, its settlement witness,
            original site allocation, delivered confirmation, and guest
            acknowledgment. Cross-tenant payment evidence remains inaccessible
            from the master Shell.
          </p>
          <p>
            <Link href="/workspaces/management/campgrounds/booking-recovery268">
              Go to tenant-private booking and provider acceptance
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Comms Hub and cross-master incident evidence</h2>
          <p>
            <strong>{e.comms.status}</strong>. Reviewed source-linked delivery
            chains: {e.comms.reviewed}.
          </p>
          <p>
            An accepted outbound request is not a provider-delivered message.
            The original durable outbox, accepted attempt, delivered provider
            receipt, original signed source pairing and a separate platform
            reviewer must all match before review. Actual recipient
            acknowledgment and independently verified case closure remain
            separate.
          </p>
          {p.comms ? (
            <p role="status">
              {p.comms === "recorded"
                ? "Source-linked Comms custody recorded; recipient acknowledgment remains separate."
                : "HOLD — signed source evidence or independent reviewer missing."}
            </p>
          ) : null}
          <form action={reviewCommsIncident272Action}>
            <label>
              Original SLA outbox UUID
              <input
                name="outboxId"
                required
                pattern={uuidPattern}
                maxLength={36}
              />
            </label>
            <label>
              Accepted outbound attempt UUID
              <input
                name="attemptId"
                required
                pattern={uuidPattern}
                maxLength={36}
              />
            </label>
            <label>
              Provider delivered receipt UUID
              <input
                name="deliveredReceiptId"
                required
                pattern={uuidPattern}
                maxLength={36}
              />
            </label>
            <label>
              Signed Comms source pair UUID
              <input
                name="sourcePairId"
                required
                pattern={uuidPattern}
                maxLength={36}
              />
            </label>
            <label>
              Master receiving context
              <select name="masterKind" required>
                <option value="rosevear-comms-hub">Rosevear Comms Hub</option>
                <option value="ai-data-platform">AI Data Platform</option>
              </select>
            </label>
            <label>
              Original external receiver evidence SHA-256
              <input
                name="externalAckDigest"
                required
                pattern={digestPattern}
                minLength={64}
                maxLength={64}
              />
            </label>
            <button type="submit">
              Record cross-master signed delivery review
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Original-host isolated restoration dry-run</h2>
          <p>
            <strong>{e.restore.status}</strong>. Reviewed chain(s):
            {e.restore.reviewed}.
          </p>
          <p>
            Requires original backup, isolated restoration and production
            readback matching on all four scopes: tenant isolation, reservation
            integrity, payment ledger and service health. A different
            independently verified reviewer must sign the actual original backup
            evidence.
          </p>
          {p.restore ? (
            <p role="status">
              {p.restore === "recorded"
                ? "Original dry-run digest review stored, not independent live restore certification."
                : "HOLD — original backup, matching isolated replay or reviewer missing."}
            </p>
          ) : null}
          <form action={reviewRestoreDryRun272Action}>
            <label>
              Original backup SHA-256
              <input
                name="backupDigest"
                required
                pattern={digestPattern}
                minLength={64}
                maxLength={64}
              />
            </label>
            <label>
              Independent isolated restore report SHA-256
              <input
                name="evidenceDigest"
                required
                pattern={digestPattern}
                minLength={64}
                maxLength={64}
              />
            </label>
            <button type="submit">
              Record reviewed original dry-run evidence
            </button>
          </form>
          <p>
            External live-host recovery certification:{" "}
            <strong>
              {e.liveExternalRestorationVerified
                ? "VERIFIED"
                : "HOLD — independent source audit required"}
            </strong>
            .
          </p>
        </section>
        <section className="content-panel">
          <p>
            <Link href="/sysop/recovery270">Original host custody</Link> ·
            <Link href="/sysop/pilot269">Camp Rosevear original pilot</Link> ·
            <Link href="/sysop/enrollment271">Build 271 ceremony</Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
