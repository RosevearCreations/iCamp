import type { Metadata } from "next";
import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import {
  inspectOriginalRuntime268,
  getRecoveryShellSummary268,
} from "@/lib/campground-support268/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking recovery and original DB · iCamp Sysop",
  robots: { index: false, follow: false },
};
export default async function RecoveryShell268Page() {
  await requireSysop("/sysop");
  const [db, summary] = await Promise.all([
    inspectOriginalRuntime268(),
    getRecoveryShellSummary268(),
  ]);
  return (
    <SysopShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">
            Build 268 · Meadow Shell · Rosevear operator
          </p>
          <h1>Booking recovery, service alerts and database custody</h1>
          <p className="hero-panel__lead">
            Platform oversight receives case status, SLA age and original
            source-health evidence, not guest payment details or permission to
            alter campground reservations and finances.
          </p>
        </section>
        <section className="content-panel">
          <h2>Original production database reconciliation</h2>
          <p>
            <strong>{db.status}</strong>
          </p>
          <p>
            Independently configured host pin:{" "}
            {db.hostPinConfigured ? "Present" : "MISSING"}. Pin matches runtime:{" "}
            {db.runtimeTargetPinMatches ? "Yes" : "No / HOLD"}.
          </p>
          <p>
            Original migration ledger:{" "}
            {db.migrationHistoryPresent ? "Found" : "HOLD"}. 0241:{" "}
            {db.migration0241 ? "Found" : "HOLD"}; 0242:{" "}
            {db.migration0242 ? "Found" : "HOLD"}; 0243:{" "}
            {db.migration0243 ? "Found" : "HOLD"}.
          </p>
          <p>
            Camp Rosevear status in the original runtime: {db.campRosevear}.
          </p>
          <p>
            These checks never expose database hosts, credentials or tenant
            identifiers. Matching migrations are not independent proof of backup
            custody or successful live restore.
          </p>
        </section>
        <section className="content-panel">
          <h2>Escalated booking complaints and SLA notification queue</h2>
          <p>
            <strong>{summary.status}</strong>
          </p>
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Booking recovery cases</span>
              <strong>{summary.opened ?? "UNKNOWN"}</strong>
            </article>
            <article className="ops-kpi">
              <span>Past next update</span>
              <strong>{summary.overdue ?? "UNKNOWN"}</strong>
            </article>
            <article className="ops-kpi">
              <span>Queued SLA notices</span>
              <strong>{summary.queuedAlerts ?? "UNKNOWN"}</strong>
            </article>
            <article className="ops-kpi">
              <span>Acknowledged notices</span>
              <strong>{summary.acknowledgedAlerts ?? "UNKNOWN"}</strong>
            </article>
          </div>
          <p>
            Alerts are queued idempotently by case and tier; delivery is not
            claimed until an independently authenticated communications receipt
            is observed. This Shell cannot issue booking confirmations or
            refunds.
          </p>
        </section>
        <section className="content-panel">
          <h2>Camp Rosevear acceptance evidence</h2>
          <p>
            Scenario: guest payment is recorded but confirmation is missing. The
            rehearsal classifier requires independently reconciled provider
            funds, inventory availability, one reservation and one receipt
            before calling it recovered. An unverified real transaction remains
            HOLD; rehearsal results are not live receipts.
          </p>
          <p>
            <Link href="/sysop/support265">Open platform support queue</Link> ·
            <Link href="/sysop/readiness">
              Original source custody overview
            </Link>
          </p>
        </section>
      </div>
    </SysopShell>
  );
}
