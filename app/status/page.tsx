import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { SystemHealthSummary } from "@/components/system-health";
import {
  getPublicHealthSnapshot,
  getVersionSnapshot,
} from "@/lib/observability/health";

export const metadata: Metadata = {
  title: "System Status · iCamp",
  description: "Public-safe iCamp service status.",
};

export const dynamic = "force-dynamic";

export default function StatusPage() {
  const health = getPublicHealthSnapshot();
  const version = getVersionSnapshot();

  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Global client status</p>
          <h1>iCamp system status</h1>
          <p className="hero-panel__lead">
            This page intentionally shows only safe service information.
            Internal diagnostics, logs, infrastructure details and client data
            are not exposed here.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="status-heading">
          <SectionHeading
            eyebrow="Current condition"
            title={health.status}
            id="status-heading"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">{health.environment}</span>}
          />

          <SystemHealthSummary />

          <dl className="status-details">
            <div>
              <dt>Application version</dt>
              <dd>{version.version}</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>{version.releaseId}</dd>
            </div>
            <div>
              <dt>Last status check</dt>
              <dd>{health.timestamp}</dd>
            </div>
          </dl>
        </section>

        <section className="content-panel" aria-labelledby="status-help-heading">
          <SectionHeading
            eyebrow="Need help?"
            title="Client-facing status is intentionally limited."
            id="status-help-heading"
            helpTopic="it.analysis"
          />
          <p>
            When a problem occurs, iCamp error screens provide a safe support
            reference. Authorized I.T. staff will later use that reference to
            correlate a report with protected diagnostic events.
          </p>
          <Link className="primary-link primary-link--dark" href="/">
            Return to iCamp
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
