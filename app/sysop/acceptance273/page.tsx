import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { sourceSummary273 } from "@/lib/build273/postgres.mjs";
import {
  witnessSourceEnrollment273Action,
  witnessIncidentClosure273Action,
} from "./actions";
export const metadata: Metadata = {
  title: "Original source & signed ACK acceptance · iCamp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
const idPattern = "[a-fA-F0-9-]{36}",
  shaPattern = "[a-f0-9]{64}";
export default async function Acceptance273Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ source?: string; incident?: string }>;
}>) {
  await requireSysop("/sysop");
  const [s, p] = await Promise.all([sourceSummary273(), searchParams]);
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">Rosevear Admin Shell</Link>
          <span>/</span>
          <span>Build 273 original consumer acceptance</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">
            Build 273 · authentic first-login and external source
          </p>
          <h1>
            Signed source enrollment, consumer ACK and restored-host evidence
          </h1>
          <p className="hero-panel__lead">
            Original host and independently signed evidence only. A recorded
            checksum is not a verified customer charge, Comms recipient
            acknowledgment, owner GOD MODE activation, or actual host recovery.
            Each live provider must be separately enrolled.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original production admission</h2>
          <p>
            <strong>{s.status}</strong>
          </p>
          <p>
            Independent original database host pin:{" "}
            {s.hostPinned ? "YES" : "HOLD"}. Original migration 0248 adopted:{" "}
            {s.adopted ? "YES" : "HOLD"}.
          </p>
          <p>
            Actual enrollment approvals: {s.enrolled}; verified consumer receipt
            rows: {s.consumerAck}; original already-resolved case ACK closures:{" "}
            {s.incidentClosed}; provider restore attestation rows:
            {s.providerRestore}.
          </p>
          <p>
            Comms signer:{" "}
            {s.commsSignerConfigured ? "Configured; verify receiver" : "HOLD"}.
            Booking signer:{" "}
            {s.bookingSignerConfigured
              ? "Configured; verify processor"
              : "HOLD"}
            . Restore signer:{" "}
            {s.restoreSignerConfigured
              ? "Configured; verify external host"
              : "HOLD"}
            .
          </p>
        </section>
        <section className="content-panel">
          <h2>Original signed source enrollment ceremony</h2>
          <p>
            Only a distinct MFA-verified platform operator may review a fresh
            Camp Rosevear source-pair proof already recorded by the signed
            original source. No app secret or owner grant is issued here.
          </p>
          {p.source ? (
            <p role="status">
              {p.source === "recorded"
                ? "Independent original source review recorded."
                : "HOLD — source pair or verified platform reviewer missing."}
            </p>
          ) : null}
          <form action={witnessSourceEnrollment273Action}>
            <label>
              Original source pair UUID
              <input
                name="sourcePairId"
                required
                pattern={idPattern}
                maxLength={36}
              />
            </label>
            <label>
              Independent source approval SHA-256
              <input
                name="evidenceDigest"
                required
                pattern={shaPattern}
                minLength={64}
                maxLength={64}
              />
            </label>
            <button type="submit">
              Record independent source enrollment review
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Tenant booking and Comms consumer ACK</h2>
          <p>
            The actual booking or Comms consumer sends signed, anti-replay
            acknowledgment evidence to the private source API. The original
            campground, booking or notice, provider acceptance, downstream
            delivery and enrolled signer must match. An API-received record does
            not itself change a reservation, payment, guest message or incident
            state.
          </p>
          <p>
            Consumer receipts endpoint:{" "}
            <code>POST /api/internal/consumer-ack273</code>.
          </p>
          <p>
            <Link href="/workspaces/management/campgrounds/booking-recovery268">
              Review booking acknowledgments in assigned campground workspace
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Signed original incident ACK closure</h2>
          <p>
            An independently authenticated operator may sign off only on an
            original campground support case that is already resolved by
            authorized campground staff and has a matching signed Comms consumer
            ACK and original provider delivery. No case status is changed here.
          </p>
          {p.incident ? (
            <p role="status">
              {p.incident === "recorded"
                ? "Closure evidence stored for an already-resolved original incident."
                : "HOLD — actual resolved case, signed consumer ACK or independent operator missing."}
            </p>
          ) : null}
          <form action={witnessIncidentClosure273Action}>
            <label>
              Original support outbox UUID
              <input
                name="outboxId"
                required
                pattern={idPattern}
                maxLength={36}
              />
            </label>
            <label>
              Original signed Comms consumer receipt UUID
              <input
                name="consumerAckId"
                required
                pattern={idPattern}
                maxLength={36}
              />
            </label>
            <label>
              Independent external case closure evidence SHA-256
              <input
                name="evidenceDigest"
                required
                pattern={shaPattern}
                minLength={64}
                maxLength={64}
              />
            </label>
            <button type="submit">
              Record verified resolved incident ACK closure
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Independent restore-provider attestation</h2>
          <p>
            A separately enrolled restore provider must sign a fresh attestation
            against a Build 272 reviewed original backup. The source and
            isolated-host identities must differ; actual independent host
            evidence still requires external audit. No database is restored by
            this form.
          </p>
          <p>
            Restore attestation endpoint:{" "}
            <code>POST /api/internal/restore-attest273</code>.
          </p>
          <p>
            <Link href="/sysop/acceptance272">
              Build 272 original backup review
            </Link>
            · <Link href="/sysop/enrollment271">Owner and source pairing</Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
