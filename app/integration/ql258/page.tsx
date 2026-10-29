import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";

import { Worksheet } from "./worksheet";

export const metadata: Metadata = {
  title: "QL-258 Owner Action Review · iCamp",
};

export default function Ql258Page() {
  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 154 · QL-258</p>
          <h1>iCamp evidence and activation HOLD</h1>
          <p className="hero-panel__lead">
            Application deployment and six-app integration are separate
            decisions. No gateway operation is enabled by this worksheet.
          </p>
        </section>
        <section className="content-panel">
          <h2>Verified source checkpoint</h2>
          <p>
            The original QL-246 proof file returned HTTP 404 on 29 October
            2026 at immutable Build 153 main commit
            461cc344c930578806f860702d74517c75038f0d.
            Later commits require separate verification.
          </p>
          <p>
            Camp Rosevear remains a synthetic, inactive campground in the
            existing database. Production test logins are not activated and
            private signer custody has not been independently verified.
          </p>
        </section>
        <Worksheet />
        <section className="content-panel">
          <p>
            No owner TEST approval has been given. The integration remains
            DISCONNECTED / HOLD with twelve live pilot holds.
          </p>
          <Link href="/status">Back to iCamp status</Link>
        </section>
      </main>
    </AppShell>
  );
}
