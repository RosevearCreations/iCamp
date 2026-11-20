import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import {
  listPlatformSupportAggregates265,
  listPlatformResponseSla266,
} from "@/lib/campground-support265/postgres.mjs";
import { readReceiverMatrix265 } from "@/lib/integration-v1/receiver-ack265.mjs";
import {
  listSupportOwnership267,
  listTelemetryAggregate267,
  originalSchema267,
} from "@/lib/campground-support267/postgres.mjs";
import { assignSupport267Action } from "./actions267";
import { getSafeItSnapshot } from "@/lib/observability/health";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sysop support & seven-app observation · iCamp",
  robots: { index: false, follow: false },
};
export default async function SysopSupport265Page() {
  await requireSysop("/sysop/support265");
  const [support, receipts, sla, ownership, telemetry, schemaReady] =
    await Promise.all([
      listPlatformSupportAggregates265(),
      Promise.resolve(readReceiverMatrix265()),
      listPlatformResponseSla266(),
      listSupportOwnership267(),
      listTelemetryAggregate267(),
      originalSchema267(),
    ]);
  const version = getSafeItSnapshot();
  return (
    <SysopShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumbs">
          <Link href="/sysop">iCamp Sysop</Link>
          <span>/</span>
          <span>Support and performance</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 265 · iCamp owner/Sysop only</p>
          <h1>Platform support, complaints and service intelligence</h1>
          <p className="hero-panel__lead">
            This is the control plane for the iCamp SaaS product: observe
            original campground-submitted support cases and signed
            cross-application acknowledgments. Ordinary campground editing stays
            inside each tenant. The Sysop shell does not impersonate campground
            employees or issue gate, payment or reboot commands.
          </p>
        </section>
        <section className="content-panel">
          <h2>Campground-submitted software support queue</h2>
          <p>
            <strong>Original data:</strong> {support.status}
          </p>
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Total support cases</span>
              <strong>{support.total}</strong>
            </article>
            <article className="ops-kpi">
              <span>Open</span>
              <strong>{support.open}</strong>
            </article>
            <article className="ops-kpi">
              <span>Triaged</span>
              <strong>{support.triaged}</strong>
            </article>
            <article className="ops-kpi">
              <span>Critical not resolved</span>
              <strong>{support.critical}</strong>
            </article>
            <article className="ops-kpi">
              <span>Locked-up reports unresolved</span>
              <strong>{support.locked}</strong>
            </article>
            <article className="ops-kpi">
              <span>Performance reports unresolved</span>
              <strong>{support.performance}</strong>
            </article>
          </div>
          <p>
            Counts include only original campground-created records. No customer
            text, tenant IDs, staff names, guest details or case descriptions
            leave the campground support system in this aggregate view.
            Submission is not proof of service uptime, severity resolution or
            operator acknowledgment.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original-case response SLA monitor · Build 266</h2>
          <p>
            <strong>Evidence:</strong> {sla.status}
          </p>
          {sla.metrics ? (
            <div className="ops-kpi-grid">
              <article className="ops-kpi">
                <span>Unresolved cases</span>
                <strong>{sla.metrics.unresolved}</strong>
              </article>
              <article className="ops-kpi">
                <span>First review overdue</span>
                <strong>{sla.metrics.overdueResponse}</strong>
              </article>
              <article className="ops-kpi">
                <span>Original review observed</span>
                <strong>{sla.metrics.responseObserved}</strong>
              </article>
              <article className="ops-kpi">
                <span>Review evidence unknown</span>
                <strong>{sla.metrics.responseUnknown}</strong>
              </article>
            </div>
          ) : (
            <p>
              Original production migration or data source is unavailable; SLA
              data is unknown.
            </p>
          )}
          <p>
            Provisional first-review targets: critical 1 hour, priority 8 hours,
            routine 48 hours. These indicators are calculated from actual
            persisted support cases and are not a staffed response guarantee.
            Missing time evidence remains unknown. These counts are not HTTP
            traffic or performance measurements.
          </p>
        </section>
        <section className="content-panel">
          <h2>Build 267 · persistent case ownership and escalation</h2>
          <p>
            Original database schema:{" "}
            {schemaReady ? "Verified presence" : "HOLD original migration 0242"}
            . Queue: {ownership.status}. Only verified MFA Sysop operators can
            assign active platform operators. Case narratives and campground
            identities are excluded.
          </p>
          {ownership.coverageCapped ? (
            <p>Showing first 100 original unresolved cases; coverage capped.</p>
          ) : null}
          {ownership.cases.map((ticket) => (
            <article className="health-card" key={ticket.id}>
              <p>
                {ticket.category} · {ticket.severity} · {ticket.status}
              </p>
              <p>
                Case {ticket.id} · owner {ticket.assignedUserId ?? "UNASSIGNED"}{" "}
                · escalation {ticket.escalationLevel}/3
              </p>
              <form action={assignSupport267Action}>
                <input type="hidden" name="caseId" value={ticket.id} />
                <input type="hidden" name="version" value={ticket.version} />
                <label>
                  Verified platform operator UUID
                  <input
                    name="assigneeId"
                    required
                    minLength={36}
                    maxLength={36}
                    defaultValue={ticket.assignedUserId ?? ""}
                  />
                </label>
                <button type="submit">Assign / reassign</button>
                {ticket.assignedUserId && ticket.escalationLevel < 3 ? (
                  <button type="submit" name="escalate" value="yes">
                    Escalate one level
                  </button>
                ) : null}
              </form>
            </article>
          ))}
          <p>
            Immutable assignment/escalation receipts are persisted. This does
            not send automatic pages or imply a staffed 24-hour SLA.
          </p>
        </section>
        <section className="content-panel">
          <h2>Build 267 · opt-in signed tenant traffic</h2>
          <p>
            <strong>Original telemetry:</strong> {telemetry.status}
          </p>
          {telemetry.metrics ? (
            <p>
              {telemetry.metrics.samples} signed observations ·{" "}
              {telemetry.metrics.requests} requests · {telemetry.metrics.errors}{" "}
              errors · latest {telemetry.metrics.lastReceivedAt}
            </p>
          ) : (
            <p>
              UNKNOWN — no fresh original enrolled telemetry. No synthetic
              traffic counts.
            </p>
          )}
          <p>
            Only explicitly enrolled campgrounds can submit timestamped
            request/error/P95 samples through the HMAC-authenticated internal
            ingestion route. Production credential enrollment and independent
            provider corroboration remain separate acceptance requirements.
          </p>
        </section>
        <section className="content-panel">
          <h2>Authenticated seven-application receiver receipt matrix</h2>
          <p>
            <strong>Verification:</strong> {receipts.status}
          </p>
          <p>
            Signed original ACK packets in the protected runtime may be verified
            against an independently enrolled Ed25519 receiver key and pinned
            production SHAs. Missing keys, stale packets, replay scope or absent
            original ACK remain HOLD. Packets are not proof of continuous live
            transport or host reboot.
          </p>
          <div className="health-grid">
            {receipts.records.map((peer) => (
              <article className="health-card" key={peer.appId}>
                <span className="health-card__label">{peer.appId}</span>
                <strong>{peer.status}</strong>
                <small>
                  {peer.originalReceiptReference ??
                    "No authenticated original receipt"}
                </small>
              </article>
            ))}
          </div>
          <p>
            <strong>Verified fresh ACK packets:</strong>{" "}
            {receipts.verifiedOriginalAckCount}/7.
            <strong> Full live topology:</strong> NOT CERTIFIED.{" "}
            <strong>Windows host reboot:</strong> NOT WITNESSED.
          </p>
        </section>
        <section className="content-panel">
          <h2>Performance, traffic, locks and recovery scope</h2>
          <p>
            Deployed software revision: <strong>{version.buildSha}</strong>.
            Configuration: <strong>{version.readiness.configuration}</strong>.
          </p>
          <p>
            Real tenant-specific traffic, request latency percentiles, server
            exceptions, Cloudflare/Vercel gateway errors, user concurrency,
            original process restarts and Windows boot receipts require
            separately authenticated observability providers. Without original
            data those measurements remain UNKNOWN; do not fill graphs with
            estimated zeroes.
          </p>
          <p>
            <Link href="/workspaces/it-analysis/release-status">
              Open iCamp release evidence
            </Link>{" "}
            · <Link href="/status">Public status</Link> ·{" "}
            <Link href="/integration/comms-hub">Comms connection</Link>
          </p>
          <p>
            Rebooting, diagnosing a frozen tenant, modifying billing and
            remotely changing a campground require a separate authorization and
            actual underlying system capabilities. No such live action is
            enabled here.
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
