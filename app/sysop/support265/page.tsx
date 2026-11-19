import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { listPlatformSupportAggregates265 } from "@/lib/campground-support265/postgres.mjs";
import { readReceiverMatrix265 } from "@/lib/integration-v1/receiver-ack265.mjs";
import { getSafeItSnapshot } from "@/lib/observability/health";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sysop support & seven-app observation · iCamp",
  robots: { index: false, follow: false },
};
export default async function SysopSupport265Page() {
  await requireSysop("/sysop/support265");
  const [support, receipts] = await Promise.all([
    listPlatformSupportAggregates265(),
    Promise.resolve(readReceiverMatrix265()),
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
