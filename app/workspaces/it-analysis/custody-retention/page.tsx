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

        <section
          className="content-panel"
          aria-labelledby="source-recheck-heading"
        >
          <SectionHeading
            id="source-recheck-heading"
            eyebrow="Build 218 · Owner controlled"
            title="Original source recheck &amp; portable evidence"
            helpTopic="it.analysis"
            trailing={
              <span className="build-chip">Manual approval · HOLD</span>
            }
          />
          <p>
            Generate a scheduled review list for expiring GitHub artifacts,
            acknowledge SLA exceptions with actual owner signatures, and export
            a redacted cross-custodian evidence summary. Source GETs require an
            explicit owner-approved local command. No credential, signed receipt
            or archive copy is sent to the production page.
          </p>
          <p>
            <a href="https://github.com/RosevearCreations/iCamp/blob/main/docs/BUILD_218_SOURCE_RECHECK_OWNER_EXCEPTION_PORTABILITY.md">
              Build 218 source recheck and evidence export guide
            </a>
          </p>
        </section>
        <section
          className="content-panel"
          aria-labelledby="runner-manifest-heading"
        >
          <SectionHeading
            id="runner-manifest-heading"
            eyebrow="Build 219 · Independent signed review"
            title="Runner attestation, portable manifest &amp; closure review"
            helpTopic="it.analysis"
            trailing={
              <span className="build-chip">Signed field evidence · HOLD</span>
            }
          />
          <p>
            Review separately pinned operator attestations for approved
            read-only source checks and independent custodian signatures over
            redacted portable evidence. The offline closure workbench verifies
            matching artifact references but never treats GitHub metadata as
            original archive bytes or closes a retention exception
            automatically.
          </p>
          <p>
            <a href="https://github.com/RosevearCreations/iCamp/blob/main/docs/BUILD_219_RUNNER_ATTESTATION_MANIFEST_CLOSURE.md">
              Build 219 operator attestation and exception review guide
            </a>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
