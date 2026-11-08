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
          <h1>Historical QL-258 owner evidence review</h1>
          <p className="hero-panel__lead">
            This October 2026 owner-intake checkpoint is preserved as historical
            evidence. Application deployment and live six-app integration remain
            separate decisions. No gateway operation is enabled here.
          </p>
        </section>
        <section className="content-panel">
          <h2>Verified source checkpoint</h2>
          <p>
            The original QL-246 proof file returned HTTP 404 on 29 October 2026
            at immutable Build 153 main commit
            461cc344c930578806f860702d74517c75038f0d. Later commits require
            separate verification.
          </p>
          <p>
            At that original checkpoint Camp Rosevear was synthetic and
            inactive, production test logins had not been activated, and private
            signer custody had not been independently verified. This is not a
            current database status check.
          </p>
        </section>
        <Worksheet />
        <section className="content-panel">
          <p>
            This worksheet recorded no owner TEST approval and twelve pilot
            holds in its original review. It is not a current Comms Hub
            connection reading or a prerequisite for campground editing.
          </p>
          <Link href="/workspaces/it-analysis/release-status">
            Current release status
          </Link>
          {" · "}
          <Link href="/status">Back to iCamp status</Link>
        </section>
      </main>
    </AppShell>
  );
}
