import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  BUILD199_SCENARIOS,
  runBuild199Scenario,
} from "@/lib/tenant-subscription/build199-sandbox.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Subscription sandbox · iCamp I.T.",
  robots: { index: false, follow: false },
};

export default async function SubscriptionSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  await requireAnyCampgroundPermission(
    "subscription.sandbox.run",
    "/workspaces/it-analysis/subscription-sandbox",
  );
  const requested = (await searchParams).scenario ?? "normal";
  const scenario = Object.hasOwn(BUILD199_SCENARIOS, requested)
    ? requested
    : "normal";
  const report = runBuild199Scenario(scenario);

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/it-analysis">I.T. &amp; Analysis</Link>
          <span>/</span>
          <span>Subscription sandbox</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 199 · isolated test lifecycle</p>
          <h1>Monthly campground subscriptions · sandbox studio</h1>
          <p className="hero-panel__lead">
            Authenticated local fixtures verify webhook signatures, idempotent
            delivery and subscription transitions. These are synthetic events,
            not official Stripe test receipts or approved Canadian subscription
            terms. No payment provider is contacted.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/launch/subscriptions">
              Legal &amp; connection readiness
            </Link>
            <Link
              className="secondary-link"
              href={`/api/it/subscriptions/sandbox?scenario=${scenario}`}
            >
              Export source-labelled JSON evidence
            </Link>
          </div>
        </section>
        <div className="ops-kpi-grid" aria-label="Sandbox controls">
          <article className="ops-kpi">
            <div>
              <span>Production SaaS billing</span>
              <strong>OFF</strong>
              <small>No live checkout, renewal or charge</small>
            </div>
          </article>
          <article className="ops-kpi">
            <div>
              <span>Scenario signatures verified</span>
              <strong>{report.signed_events_verified}</strong>
              <small>Fresh in-memory test key · no secrets stored</small>
            </div>
          </article>
          <article className="ops-kpi">
            <div>
              <span>Provider &amp; legal activation</span>
              <strong>HELD</strong>
              <small>
                Original test receipts and reviewed documents missing
              </small>
            </div>
          </article>
        </div>
        <section className="content-panel ops-detail-card">
          <div className="ops-section-heading">
            <div>
              <p className="eyebrow">Choose an isolated workflow</p>
              <h2>Lifecycle scenarios</h2>
            </div>
            <span className="ops-pill ops-pill--hold">TEST ONLY</span>
          </div>
          <div
            className="hero-actions"
            role="group"
            aria-label="Sandbox scenario"
          >
            {Object.entries(BUILD199_SCENARIOS).map(([key, item]) => (
              <Link
                key={key}
                href={`?scenario=${key}`}
                className={key === scenario ? "primary-link" : "secondary-link"}
                aria-current={key === scenario ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p>
            <strong>{report.label}</strong> · final subscription state:{" "}
            <strong>{report.lifecycle.subscription_state}</strong> · payment:{" "}
            {report.lifecycle.payment_state} · risk:{" "}
            {report.lifecycle.risk_state}.
          </p>
          <ol className="ops-timeline">
            {report.events.map((item, index) => (
              <li key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.type}</strong>
                  <small>Signature checked · duplicate event ignored</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="ops-inline-note">
            Source SHA-256: <code>{report.source_sha256}</code> ·{" "}
            {report.duplicate_deliveries_ignored} duplicate deliveries tested.
            The hash describes test fixtures, not provider-issued evidence.
          </p>
        </section>
        <section className="content-panel ops-detail-card">
          <div className="ops-section-heading">
            <div>
              <p className="eyebrow">Legal &amp; operational stop conditions</p>
              <h2>Consent and independent verification</h2>
            </div>
            <span className="ops-pill ops-pill--hold">NO-GO</span>
          </div>
          <ol>
            <li>
              Separate I.T. fixture-run permission from independent finance
              review.
            </li>
            <li>
              Register genuine, independently approved terms and privacy
              document hashes.
            </li>
            <li>
              Authenticate the real subscriber and record a version-bound,
              append-only affirmative receipt.
            </li>
            <li>
              Attach original provider TEST-mode webhook, checkout, renewal,
              failure and refund/dispute receipts.
            </li>
            <li>
              Validate source signer, tax and cancellation wording, privacy
              retention and explicit owner approval.
            </li>
          </ol>
          <p>
            The example consent is{" "}
            <strong>unsigned, unpersisted and nonbinding</strong>. Live provider
            secrets, production webhooks and external billing are not
            configured. A GREEN application deployment does not authorize
            subscription activation.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
