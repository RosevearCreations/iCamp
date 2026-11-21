import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import {
  listTenantTraffic269,
  listPilotCustody269,
  originalPilotReady269,
} from "@/lib/campground-pilot269/postgres.mjs";
import { recordRestoreWitness269Action } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Supervised campground pilot & independent recovery · iCamp Sysop",
  robots: { index: false, follow: false },
};
export default async function Pilot269Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ saved?: string; error?: string }> }>) {
  await requireSysop("/sysop");
  const params = await searchParams;
  const [traffic, custody, dbReady] = await Promise.all([
    listTenantTraffic269(),
    listPilotCustody269(),
    originalPilotReady269(),
  ]);
  const configured = {
    traffic:
      Boolean(process.env.ICAMP_TELEMETRY269_HMAC_SECRET) &&
      Boolean(process.env.ICAMP_TELEMETRY269_PILOT_CAMPGROUND_ID) &&
      Boolean(process.env.ICAMP_TELEMETRY269_PILOT_SOURCE_ID),
    sla:
      Boolean(process.env.ICAMP_SLA269_ACK_HMAC_SECRET) &&
      Boolean(process.env.ICAMP_SLA269_ACK_SOURCE_ID),
    scheduler: Boolean(process.env.CRON_SECRET),
    originalDatabase: Boolean(
      process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST,
    ),
  };
  return (
    <SysopShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs">
          <Link href="/sysop">iCamp Sysop</Link>
          <span>/</span>
          <span>Camp Rosevear supervised pilot</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">
            Build 269 · restricted Rosevear administrator
          </p>
          <h1>
            Tenant traffic, guest recovery and independent restore evidence
          </h1>
          <p className="hero-panel__lead">
            Only original signed and consented telemetry, platform case counts
            and independently sourced restore attestations are shown. This Shell
            cannot take guest payments, alter site inventory, refund, or
            impersonate campground staff.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original production enrollment gates</h2>
          <p>
            Schema 0244 and independently pinned runtime:{" "}
            <strong>
              {dbReady
                ? "ORIGINAL SCHEMA FOUND — EXTERNAL WITNESS STILL REQUIRED"
                : "HOLD — ORIGINAL DATABASE OR MIGRATION NOT CERTIFIED"}
            </strong>
          </p>
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Traffic signing credential</span>
              <strong>{configured.traffic ? "Configured" : "HOLD"}</strong>
            </article>
            <article className="ops-kpi">
              <span>Comms Hub receipt source</span>
              <strong>{configured.sla ? "Configured" : "HOLD"}</strong>
            </article>
            <article className="ops-kpi">
              <span>SLA scheduler credential</span>
              <strong>{configured.scheduler ? "Configured" : "HOLD"}</strong>
            </article>
            <article className="ops-kpi">
              <span>Original DB host pin</span>
              <strong>
                {configured.originalDatabase ? "Configured" : "HOLD"}
              </strong>
            </article>
          </div>
          <p>
            Credential presence never proves a live source, a provider-confirmed
            message or actual payment settlement. Configure only server-side
            keys obtained from the independently enrolled original provider.
            Never use a development key in production.
          </p>
        </section>
        <section className="content-panel">
          <h2>Campground traffic and booking-stage health</h2>
          <p>
            Evidence: <strong>{traffic.status}</strong>. Fifteen-minute
            observation window. Guest search and checkout are separate from
            staff operations and automated health probes; missing measurements
            stay UNKNOWN, not zero traffic.
          </p>
          <table>
            <thead>
              <tr>
                <th>Campground</th>
                <th>Source health</th>
                <th>Guest searches</th>
                <th>Checkout requests</th>
                <th>Errors</th>
                <th>Samples / probes</th>
                <th>Last original receipt</th>
              </tr>
            </thead>
            <tbody>
              {traffic.tenants.map((t) => (
                <tr key={t.campgroundId}>
                  <td>{t.name}</td>
                  <td>
                    {t.freshness} ({t.campgroundState})
                  </td>
                  <td>{t.samples ? t.guestSearch : "UNKNOWN"}</td>
                  <td>{t.samples ? t.guestCheckout : "UNKNOWN"}</td>
                  <td>{t.samples ? t.errors : "UNKNOWN"}</td>
                  <td>
                    {t.samples} / {t.probes}
                  </td>
                  <td>{t.lastReceivedAt ?? "NONE"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!traffic.tenants.length ? (
            <p>
              No enrolled original telemetry is available. We cannot infer
              tenant outages from zero samples alone.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <h2>Verified downstream delivery and guest pilot witness custody</h2>
          <p>
            Original ledger: <strong>{custody.status}</strong>
          </p>
          <p>
            Signed provider-delivered SLA receipts:{" "}
            {custody.signedDeliveryReceipts ?? "UNKNOWN"}. Local campground
            payment/booking witness assertions:{" "}
            {custody.pilotBookingWitnesses ?? "UNKNOWN"}.
          </p>
          <p>
            Outbox queued, provider attempt, signed provider delivery ACK, and
            guest acknowledgment are distinct events. A signed ACK must be
            corroborated by the actual Comms Hub provider before business
            acceptance.
          </p>
          <p>
            <Link href="/sysop/recovery268">
              View owner-assigned cases and queued SLA notices
            </Link>
            .
          </p>
        </section>
        <section className="content-panel">
          <h2>Independent production backup and isolated restoration</h2>
          <p>
            <strong>{custody.restoreStatus}</strong>
          </p>
          <p>
            The original backup, isolated restore and independent review must
            refer to the same source digest. A second verified operator must
            witness the restored result. A signed assertion alone cannot prove
            that the actual backup was restored or that live service recovered.
          </p>
          {params.saved ? (
            <p role="status">Original evidence statement stored.</p>
          ) : null}
          {params.error ? (
            <p role="alert">
              HOLD — witness evidence not stored. Check original database,
              authorization, digest and distinct-review requirements.
            </p>
          ) : null}
          <form action={recordRestoreWitness269Action}>
            <label>
              Evidence step
              <select name="kind" required defaultValue="original_backup">
                <option value="original_backup">
                  Original backup evidence
                </option>
                <option value="isolated_restore">
                  Isolated restore evidence
                </option>
                <option value="independent_review">
                  Independent reviewer attestation
                </option>
              </select>
            </label>
            <label>
              Original backup SHA-256
              <input
                name="backupDigestSha256"
                type="text"
                required
                pattern="[a-f0-9]{64}"
                minLength={64}
                maxLength={64}
              />
            </label>
            <label>
              Verified evidence SHA-256
              <input
                name="evidenceDigestSha256"
                type="text"
                required
                pattern="[a-f0-9]{64}"
                minLength={64}
                maxLength={64}
              />
            </label>
            <button type="submit">
              Record authenticated witness statement
            </button>
          </form>
          <p>
            Only enter hashes of genuine custody-controlled artifacts. This
            action does not initiate or simulate a backup restore.
          </p>
        </section>
        <section className="content-panel">
          <h2>Camp Rosevear test workflow</h2>
          <p>
            Campground operators use their own workspace to record the booking,
            provider settlement, site allocation, confirmation delivery and
            guest outcome. The Shell sees service-health and custody summaries
            only.
          </p>
          <p>
            <Link href="/workspaces/management/campgrounds/booking-recovery268">
              Open private campground booking recovery
            </Link>{" "}
            ·
            <Link href="/sysop/readiness">
              Review earlier database custody gates
            </Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
