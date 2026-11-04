import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { getOperationalQueueHealth } from "@/lib/jobs/postgres.mjs";
import { getSafeItSnapshot } from "@/lib/observability/health";
import { RESILIENCE_BUDGETS } from "@/lib/resilience/core.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resilience & recovery · iCamp I.T.",
  description:
    "Protected nonproduction restore drill, operational thresholds and incident playbooks.",
  robots: { index: false, follow: false },
};

export default async function ResiliencePage() {
  await requireAnyCampgroundPermission(
    "it.health.read",
    "/workspaces/it-analysis/resilience",
  );
  const health = getSafeItSnapshot();
  const queues = await getOperationalQueueHealth();
  const budgets = Object.values(RESILIENCE_BUDGETS);

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/it-analysis">I.T. &amp; Analysis</Link>
          <span>/</span>
          <span>Resilience</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 198 · Recovery readiness</p>
          <h1>Backup drills, performance budgets &amp; incident response</h1>
          <p className="hero-panel__lead">
            Live configuration and queue readings are separate from CI drill
            evidence. Passing a synthetic restore is not proof of production
            recovery, a real backup schedule, or a production recovery-point
            objective.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/api/health/ready">
              Inspect readiness
            </Link>
            <Link className="secondary-link" href="/workspaces/it-analysis">
              Full I.T. dashboard
            </Link>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="resilience-readings"
        >
          <SectionHeading
            eyebrow="Observed now"
            title="Operational signals"
            id="resilience-readings"
            helpTopic="it.analysis"
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">
                Configuration readiness
              </span>
              <strong>{health.readiness.configuration}</strong>
              <span>
                This checks configuration only, not database restore or
                failover.
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Queue exceptions</span>
              <strong>
                {queues.jobs.deadLetter} dead-letter · {queues.jobs.overdue}{" "}
                overdue
              </strong>
              <span>
                Review first; do not replay without permission and source
                inspection.
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Workers</span>
              <strong>
                {queues.workers.stalled} stalled · {queues.jobs.expiredLeases}{" "}
                expired leases
              </strong>
              <span>Alert on unexpected growth or blocked processing.</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Recovery evidence</span>
              <strong>CI fixture only</strong>
              <span>
                Production RPO, RTO and provider backup verification: not
                established here.
              </span>
            </article>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="resilience-budgets">
          <SectionHeading
            eyebrow="Explicit targets"
            title="Performance budgets"
            id="resilience-budgets"
            helpTopic="it.analysis"
          />
          <p>
            Thresholds are test targets, not live measured values. Run the
            read-only probe and attach its dated, source-labelled JSON to an
            incident review.
          </p>
          <div className="health-grid">
            {budgets.map((budget) => (
              <article className="health-card" key={budget.label}>
                <span className="health-card__label">{budget.label}</span>
                <strong>p95 ≤ {budget.p95Ms} ms</strong>
                <span>
                  {budget.sampleMinimum} samples minimum · no live histogram
                  attached
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="resilience-drill">
          <SectionHeading
            eyebrow="CI-tested procedure"
            title="Isolated backup &amp; restore"
            id="resilience-drill"
            helpTopic="it.analysis"
          />
          <ol>
            <li>
              Seed the synthetic `icamp_ci` database on local PostgreSQL 17.
            </li>
            <li>
              Run the Build 198 command with <code>ICAMP_APP_ENV=test</code> and
              explicit drill acknowledgment.
            </li>
            <li>
              The command copies a consistent logical backup into a new random
              local database.
            </li>
            <li>
              Compare source/restore counts, verify forced privacy RLS, and
              prove an unknown actor sees no campground rows.
            </li>
            <li>
              Capture observed elapsed time, then destroy only the uniquely
              named disposable target.
            </li>
          </ol>
          <p>
            <strong>Safety:</strong> production URLs, remote hosts and non-test
            environments are rejected. The drill never runs a production
            restore.
          </p>
        </section>

        <section
          className="content-panel"
          aria-labelledby="resilience-incidents"
        >
          <SectionHeading
            eyebrow="Operator response"
            title="Incident &amp; rollback runbook"
            id="resilience-incidents"
            helpTopic="it.analysis"
          />
          <ol>
            <li>
              <strong>Detect:</strong> confirm health, readiness, exact build
              SHA and queue symptoms; open an incident with time and affected
              campground scope.
            </li>
            <li>
              <strong>Contain:</strong> freeze risky writes and queued replays;
              keep billing, SMS, gate commands and external integrations HELD.
            </li>
            <li>
              <strong>Diagnose:</strong> capture read-only deployment logs,
              errors and privacy-safe evidence; distinguish a database outage
              from application failure.
            </li>
            <li>
              <strong>Recover:</strong> use a reviewed rollback to the last
              known-good production deployment if safe; never restore a
              production database from a test artifact.
            </li>
            <li>
              <strong>Verify:</strong> independently retest authorization,
              tenancy, booking states, queues and health before resuming writes.
            </li>
            <li>
              <strong>Close:</strong> record owner decision, observed downtime,
              unresolved risks and retention-approved audit references.
            </li>
          </ol>
          <p>
            Automated replay, failover and rollback remain intentionally
            disabled from this page; they require a reviewed operator change
            decision.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
