import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";

export const metadata: Metadata = {
  title: "Evidence Retention & Custody · iCamp",
  description:
    "Owner-controlled evidence retention and independent custody review.",
};

export const dynamic = "force-dynamic";

const signals = [
  {
    label: "Independent head checkpoints",
    state: "External signed review required",
    description:
      "Verify the independently pinned rotation tail and at least two genuinely separate reviewer authorities.",
  },
  {
    label: "Owner renewal decisions",
    state: "No private receipts loaded",
    description:
      "Reconcile signed decisions offline; conflicting choices never approve an automatic renewal.",
  },
  {
    label: "Original source retention",
    state: "Original readback not established",
    description:
      "Review GitHub source artifacts separately from the downloaded CI metadata snapshot.",
  },
] as const;

export default async function CustodyRetentionPage() {
  await requireAnyCampgroundPermission(
    "it.health.read",
    "/workspaces/it-analysis/custody-retention",
  );

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">I.T. &amp; Analysis · Build 217</p>
          <h1>Evidence retention &amp; custody SLA</h1>
          <p className="hero-panel__lead">
            Owner-governed monitoring of expiry windows, independently signed
            checkpoints and renewal outcomes. Private evidence is deliberately
            not uploaded to iCamp or loaded in the production runtime.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="custody-gate-title">
          <SectionHeading
            id="custody-gate-title"
            eyebrow="Independent trust gate"
            title="External verification on HOLD"
            helpTopic="it.analysis"
            trailing={<span className="build-chip">HOLD · PRIVATE</span>}
          />
          <p>
            The production dashboard cannot see our private owner signatures,
            archive copies or offline custody ledger. Empty source evidence is
            <strong> not</strong> a zero-overdue finding, release approval or a
            live Comms Hub connection.
          </p>
          <div className="health-grid">
            {signals.map((signal) => (
              <article className="health-card" key={signal.label}>
                <span className="health-card__label">{signal.label}</span>
                <strong>{signal.state}</strong>
                <span>{signal.description}</span>
              </article>
            ))}
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="custody-review-title"
        >
          <SectionHeading
            id="custody-review-title"
            eyebrow="Offline dashboard workbench"
            title="Generate the redacted retention timeline"
            helpTopic="it.analysis"
          />
          <ol>
            <li>
              Verify the original source metadata, signed custody records and
              independent reviewer pins.
            </li>
            <li>
              Run the Build 217 local dashboard command from a trusted iCamp
              checkout.
            </li>
            <li>
              Open the generated HTML locally and review overdue, 7-day and
              14-day alerts, owner conflicts and signer diversity.
            </li>
            <li>
              Keep the signed evidence and identity enrollment outside GitHub
              and this application.
            </li>
          </ol>
          <p>
            <a href="https://github.com/RosevearCreations/iCamp/blob/main/docs/BUILD_217_CUSTODY_DIVERSITY_RENEWAL_DASHBOARD.md">
              Build 217 Windows operator guide
            </a>
          </p>
          <p>
            <Link href="/workspaces/it-analysis">
              Return to I.T. &amp; Analysis
            </Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
