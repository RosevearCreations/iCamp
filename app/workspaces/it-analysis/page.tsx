import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { getSafeItSnapshot } from "@/lib/observability/health";

export const metadata: Metadata = {
  title: "I.T. & Analysis · iCamp",
  description: "iCamp system health and diagnostic operations workspace.",
};

export const dynamic = "force-dynamic";

export default function ItAnalysisPage() {
  const snapshot = getSafeItSnapshot();

  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">I.T. & Analysis</p>
          <h1>System health without exposing sensitive information.</h1>
          <p className="hero-panel__lead">
            Build 002 establishes diagnostics and support contracts. Until
            authentication, permissions and audit controls are available, this
            workspace intentionally shows only public-safe health information.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="it-health-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Runtime</p>
              <h2 id="it-health-heading">Health foundation</h2>
            </div>
            <span className="build-chip">{snapshot.health}</span>
          </div>

          <dl className="status-details">
            <div>
              <dt>Environment</dt>
              <dd>{snapshot.environment}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{snapshot.version}</dd>
            </div>
            <div>
              <dt>Build reference</dt>
              <dd>{snapshot.buildSha}</dd>
            </div>
            <div>
              <dt>Configuration</dt>
              <dd>{snapshot.readiness.configuration}</dd>
            </div>
          </dl>
        </section>

        <section className="content-panel" aria-labelledby="watchdog-heading">
          <p className="eyebrow">Lockup detection</p>
          <h2 id="watchdog-heading">External watchdog required</h2>
          <p>
            A frozen application cannot reliably announce that it is frozen.
            iCamp therefore exposes liveness/readiness contracts for an
            independent monitor to check from outside the application process.
          </p>
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Liveness</span>
              <strong>/api/health/live</strong>
              <span>Can the runtime answer?</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Readiness</span>
              <strong>/api/health/ready</strong>
              <span>Is required configuration usable?</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">External watchdog</span>
              <strong>
                {snapshot.featureFlags.externalWatchdog
                  ? "Enabled"
                  : "Not connected"}
              </strong>
              <span>Provider-neutral by design</span>
            </article>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="privacy-heading">
          <p className="eyebrow">Diagnostic privacy</p>
          <h2 id="privacy-heading">Sensitive diagnostics stay protected.</h2>
          <p>
            Detailed logs, traces, error payloads, client records and
            infrastructure information are deliberately unavailable here until
            authenticated I.T. permissions exist.
          </p>
          <Link className="primary-link primary-link--dark" href="/status">
            View client-safe status
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
