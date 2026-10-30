import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AcceptanceWorksheet } from "./worksheet";

export const metadata: Metadata = {
  title: "Pilot acceptance · iCamp",
};

export default function PilotAcceptancePage() {
  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 155 · Development pilot</p>
          <h1>Camp Rosevear pilot acceptance</h1>
          <p className="hero-panel__lead">
            Record reported checks across six operating areas. This checklist
            cannot certify a real campground, activate test accounts, authorize
            payments or release the public application.
          </p>
        </section>
        <AcceptanceWorksheet />
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
          </p>
        </section>
      </main>
    </AppShell>
  );
}
