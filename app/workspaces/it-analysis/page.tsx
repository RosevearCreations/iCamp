import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { getCommunicationsHealth } from "@/lib/communications/postgres.mjs";
import { getOperationalQueueHealth } from "@/lib/jobs/postgres.mjs";
import { getMediaStorageHealth } from "@/lib/media/postgres.mjs";
import { getMessagingGatewayHealth } from "@/lib/messaging/postgres.mjs";
import { getSafeItSnapshot } from "@/lib/observability/health";
import { getVoiceGatewayHealth } from "@/lib/voice/postgres.mjs";

export const metadata: Metadata = {
  title: "I.T. & Analysis · iCamp",
  description: "iCamp system health and diagnostic operations workspace.",
};

export const dynamic = "force-dynamic";

export default async function ItAnalysisPage() {
  await requireAnyCampgroundPermission(
    "it.health.read",
    "/workspaces/it-analysis",
  );
  const snapshot = getSafeItSnapshot();
  const [
    queueHealth,
    mediaHealth,
    communicationsHealth,
    messagingHealth,
    voiceHealth,
  ] = await Promise.all([
    getOperationalQueueHealth(),
    getMediaStorageHealth(),
    getCommunicationsHealth(),
    getMessagingGatewayHealth(),
    getVoiceGatewayHealth(),
  ]);
  const renderedAt = new Date().toISOString();

  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">I.T. & Analysis</p>
          <h1>System health without exposing sensitive information.</h1>
          <p className="hero-panel__lead">
            Runtime health stays sanitized, while authenticated I.T. operators
            can now see aggregate queue and scheduler signals without exposing
            job payloads, credentials or private infrastructure details.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="it-health-heading">
          <SectionHeading
            eyebrow="Runtime"
            title="Health foundation"
            id="it-health-heading"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">{snapshot.health}</span>}
          />

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

        <section
          className="content-panel"
          aria-labelledby="queue-health-heading"
        >
          <SectionHeading
            eyebrow="Background operations"
            title="Queue & scheduler health"
            id="queue-health-heading"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">{queueHealth.status}</span>}
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Jobs</span>
              <strong>
                {queueHealth.jobs.queued} queued · {queueHealth.jobs.running}{" "}
                running
              </strong>
              <span>
                {queueHealth.jobs.deadLetter} dead-letter ·{" "}
                {queueHealth.jobs.overdue} overdue
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Workers</span>
              <strong>{queueHealth.workers.active} active</strong>
              <span>{queueHealth.workers.stalled} stalled</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Scheduler</span>
              <strong>{queueHealth.schedules.schedulerState}</strong>
              <span>
                {queueHealth.schedules.active} active schedule(s) ·{" "}
                {queueHealth.schedules.overdue} overdue
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Leases</span>
              <strong>{queueHealth.jobs.expiredLeases} expired</strong>
              <span>Payloads remain private</span>
            </article>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="communications-health-heading"
        >
          <SectionHeading
            eyebrow="Omnichannel"
            title="Communications health"
            id="communications-health-heading"
            helpTopic="it.analysis"
            trailing={
              <span className="build-chip">{communicationsHealth.status}</span>
            }
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Delivery</span>
              <strong>
                {communicationsHealth.delivery.queued} queued ·{" "}
                {communicationsHealth.delivery.submitted} submitted
              </strong>
              <span>
                {communicationsHealth.delivery.delivered} delivered ·{" "}
                {communicationsHealth.delivery.failed} failed
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Overdue</span>
              <strong>{communicationsHealth.delivery.overdue}</strong>
              <span>Delivery/call work past the health threshold</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Retries</span>
              <strong>
                {communicationsHealth.retries.retryableFailures} retryable
              </strong>
              <span>
                {communicationsHealth.retries.terminalAttemptFailures} terminal
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Provider events</span>
              <strong>{communicationsHealth.providers.events24h} in 24h</strong>
              <span>
                Endpoints, bodies and provider payloads remain private
              </span>
            </article>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="messaging-health-heading"
        >
          <SectionHeading
            eyebrow="SMS / MMS"
            title="Messaging gateway health"
            id="messaging-health-heading"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">{messagingHealth.status}</span>}
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Lines</span>
              <strong>{messagingHealth.lines.active} active</strong>
              <span>{messagingHealth.lines.sandbox} sandbox</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Traffic</span>
              <strong>{messagingHealth.messages.inbound24h} inbound in 24h</strong>
              <span>{messagingHealth.messages.outbound24h} outbound in 24h</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Command safety</span>
              <strong>
                {messagingHealth.messages.gatedCommands24h} gated in 24h
              </strong>
              <span>Identifier and natural-language commands stay validation-gated</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Delivery failures</span>
              <strong>{messagingHealth.messages.failed24h} in 24h</strong>
              <span>Message bodies and phone numbers remain private</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">MMS intake</span>
              <strong>{messagingHealth.attachments.pendingScan} pending scan</strong>
              <span>Photos remain gated by secure-media validation</span>
            </article>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="voice-health-heading"
        >
          <SectionHeading
            eyebrow="Voice / IVR"
            title="Voice gateway health"
            id="voice-health-heading"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">{voiceHealth.status}</span>}
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Lines</span>
              <strong>{voiceHealth.lines.active} active</strong>
              <span>{voiceHealth.lines.sandbox} sandbox</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Calls</span>
              <strong>{voiceHealth.calls.active} active</strong>
              <span>{voiceHealth.calls.failed24h} failed in 24h</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">IVR</span>
              <strong>{voiceHealth.ivr.active} active</strong>
              <span>{voiceHealth.ivr.expired} expired sessions</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">DTMF keypad</span>
              <strong>{voiceHealth.dtmf.inputs24h} inputs in 24h</strong>
              <span>
                {voiceHealth.dtmf.invalid24h} invalid ·{" "}
                {voiceHealth.dtmf.timeouts24h} timeouts; digits never shown
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Transfer fallback</span>
              <strong>{voiceHealth.calls.transferFallbacks}</strong>
              <span>
                Phone numbers, keypad digits, audio and transcripts remain
                private
              </span>
            </article>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="media-health-heading"
        >
          <SectionHeading
            eyebrow="Storage"
            title="Media & document health"
            id="media-health-heading"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">{mediaHealth.status}</span>}
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Registry</span>
              <strong>{mediaHealth.registered} registered</strong>
              <span>{mediaHealth.active} active</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Quarantine</span>
              <strong>{mediaHealth.quarantined}</strong>
              <span>Requires operator review when non-zero</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Active classes</span>
              <strong>
                {mediaHealth.byClassification.public} public ·{" "}
                {mediaHealth.byClassification.internal} internal
              </strong>
              <span>
                {mediaHealth.byClassification.confidential} confidential
              </span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Diagnostic privacy</span>
              <strong>Metadata protected</strong>
              <span>Object paths and document contents remain private</span>
            </article>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Tracking"
            title="I.T. view freshness"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={renderedAt}
            sectionKey="workspace.it-analysis"
          />
        </section>

        <section className="content-panel" aria-labelledby="watchdog-heading">
          <SectionHeading
            eyebrow="Lockup detection"
            title="External watchdog required"
            id="watchdog-heading"
            helpTopic="it.analysis"
          />
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
          <SectionHeading
            eyebrow="Diagnostic privacy"
            title="Sensitive diagnostics stay protected."
            id="privacy-heading"
            helpTopic="it.analysis"
          />
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
