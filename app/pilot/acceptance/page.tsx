import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AcceptanceWorksheet } from "./worksheet";
import { Build200Review } from "./build200-review";
import { Build201Retest } from "./build201-retest";
import { Build202EvidenceIntake } from "./build202-evidence-intake";

export const metadata: Metadata = {
  title: "Pilot acceptance · iCamp",
};

export default function PilotAcceptancePage() {
  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">
            Build 202 · Independent source evidence and TEST gate
          </p>
          <h1>Camp Rosevear · pilot findings and guest/staff retest</h1>
          <p className="hero-panel__lead">
            Open the real guest and staff modules in sequence, record issue
            references, and keep source-file proof separate from real-device and
            independent acceptance. Build 201 keeps local notes available during
            navigation and adds portable device retest references. This
            workboard cannot activate payments, communications, test accounts or
            a public go-live.
          </p>
        </section>
        <Build200Review />
        <Build201Retest />
        <Build202EvidenceIntake />
        <details className="content-panel">
          <summary>Original six-area pilot worksheet (Build 155)</summary>
          <AcceptanceWorksheet />
        </details>
        <section className="content-panel">
          <h2>Remediation and release boundary</h2>
          <p>
            Each failed or blocked check requires a tracked defect, an owner, a
            retest and independent acceptance before the pilot can close. Actual
            hardware, payment and cross-browser testing must happen in an
            approved isolated environment. Never enter private customer details,
            credentials or device identifiers in this worksheet.
          </p>
          <p>
            <Link href="/integration/comms-hub">
              Comms Hub connection review
            </Link>
            {" · "}
            <Link href="/status">Application status</Link>
            {" · "}
            <Link href="/workspaces/it-analysis/resilience">I.T. recovery</Link>
          </p>
        </section>
      </main>
    </AppShell>
  );
}
