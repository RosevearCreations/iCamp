import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { subscriptionAdapterFoundation } from "@/lib/tenant-subscription/foundation.mjs";
import { IndependentEvidenceReview } from "./review";

export const metadata: Metadata = {
  title: "Subscription & connection readiness · iCamp",
};

export default function SubscriptionFoundationPage() {
  const adapter = subscriptionAdapterFoundation();
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 159 · Standard theme</p>
          <h1>Subscription & connection readiness</h1>
          <p className="hero-panel__lead">
            A clearer view of the business side of iCamp: payment foundations,
            subscriber consent versions, and independently reviewed connection
            evidence.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/launch/readiness">
              Launch checklist
            </Link>
            <Link className="secondary-link" href="/integration/comms-hub">
              Connection centre
            </Link>
          </div>
        </section>

        <div className="ops-kpi-grid" aria-label="Build 159 operational status">
          <article className="ops-kpi">
            <div className="ops-kpi__icon" aria-hidden="true">
              ▣
            </div>
            <div>
              <span>Tenant billing</span>
              <strong>OFF</strong>
              <small>No live subscription provider</small>
            </div>
            <span className="ops-kpi__meter" aria-hidden="true" />
          </article>
          <article className="ops-kpi">
            <div
              className="ops-kpi__icon ops-kpi__icon--amber"
              aria-hidden="true"
            >
              ✓
            </div>
            <div>
              <span>Subscriber terms</span>
              <strong>Review needed</strong>
              <small>No approved acceptance registry</small>
            </div>
            <span className="ops-kpi__meter" aria-hidden="true" />
          </article>
          <article className="ops-kpi">
            <div
              className="ops-kpi__icon ops-kpi__icon--blue"
              aria-hidden="true"
            >
              ↔
            </div>
            <div>
              <span>Six-app connection</span>
              <strong>HELD</strong>
              <small>Independent custody pending</small>
            </div>
            <span className="ops-kpi__meter" aria-hidden="true" />
          </article>
        </div>

        <div className="ops-split-grid">
          <section className="content-panel ops-detail-card">
            <div className="ops-section-heading">
              <div>
                <p className="eyebrow">Subscription provider</p>
                <h2>Adapter foundation</h2>
              </div>
              <span className="ops-pill ops-pill--hold">Not connected</span>
            </div>
            <p>
              Provider-neutral functions are ready for reviewed sandbox
              implementation. No checkout, portal, webhook or recurring charge
              can execute from this foundation.
            </p>
            <div className="ops-status-row">
              <span>Selected adapter</span>
              <strong>{adapter.provider}</strong>
            </div>
            <div className="ops-status-row">
              <span>Checkout & customer portal</span>
              <strong className="ops-text-hold">Disabled</strong>
            </div>
            <div className="ops-status-row">
              <span>Signed lifecycle webhooks</span>
              <strong className="ops-text-hold">Not implemented</strong>
            </div>
            <div className="ops-status-row">
              <span>Lifecycle coverage defined</span>
              <strong>{adapter.required_events.length} event types</strong>
            </div>
            <p className="ops-inline-note">
              Campground reservation payments are separate from monthly SaaS
              subscription fees.
            </p>
          </section>

          <section className="content-panel ops-detail-card">
            <div className="ops-section-heading">
              <div>
                <p className="eyebrow">Subscriber agreements</p>
                <h2>Versioned consent design</h2>
              </div>
              <span className="ops-pill ops-pill--hold">Preview only</span>
            </div>
            <p>
              A deterministic document-version digest can be constructed for an
              explicit consent event. It is <strong>not</strong> a signed,
              stored, or legally binding receipt.
            </p>
            <ol className="ops-timeline">
              <li>
                <span>01</span>
                <div>
                  <strong>Approve legal documents</strong>
                  <small>
                    Agreement, privacy, fees, renewal, taxes and cancellations
                  </small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Register immutable versions</strong>
                  <small>
                    Bind exact published content to reviewed version identifiers
                  </small>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Collect authenticated consent</strong>
                  <small>
                    Explicit checkbox, time, actor and durable append-only
                    receipt
                  </small>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <IndependentEvidenceReview />
        <section className="content-panel ops-detail-card">
          <h2>Before a real subscription can launch</h2>
          <p>
            A chosen and authorized provider, restricted sandbox credentials,
            signed webhook verification, subscription lifecycle testing, a
            Canadian legal review, tax configuration, and durable per-tenant
            consent storage are still needed. Connection testing has its own
            independent proof and TEST-only authorization gate.
          </p>
          <Link href="/launch/audit">Review Build 158 owner intake →</Link>
        </section>
      </div>
    </AppShell>
  );
}
