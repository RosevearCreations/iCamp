import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LocalCheck } from "./LocalCheck";
import { CommsTransportCheck } from "./transport-check";
import { Build201HandshakePreflight } from "./handshake-preflight";

export const metadata: Metadata = { title: "Comms Hub Connection · iCamp" };

export default function CommsHubConnectionPage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">I.T. · Current source of truth</p>
          <h1>Comms Hub connection and legacy diagnostics</h1>
          <p className="hero-panel__lead">
            Confirm current connection, owner enrollment and help access in the
            Comms Hub itself. Local source checks do not determine remote
            status.
          </p>
        </section>
        <p className="hero-panel__lead">
          <a
            href="https://rosevear-comms-hub.devilndovelive.workers.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Rosevear Comms Hub · six-app connection centre
          </a>{" "}
          — view the owning Comms control plane for its latest authenticated
          status.
        </p>
        <section className="content-panel">
          <h2>Current deployment and help</h2>
          <p>
            <Link href="/workspaces/it-analysis/release-status">
              View current iCamp release status
            </Link>
          </p>
          <p>
            Do not interpret an older disconnected TEST fixture as a live
            connection failure. Provider authentication and real message
            delivery must be checked separately.
          </p>
        </section>
        <details className="content-panel">
          <summary>
            Historical source preflight tools (not release prerequisites)
          </summary>
          <p>
            These QL-265 / Build 201 tools preserve a local TEST-era report.
            Their fixed HOLD responses are not an authenticated Comms Hub
            connection check.
          </p>
          <LocalCheck />
          <CommsTransportCheck />
          <Build201HandshakePreflight />
          <Link href="/integration/ql258">
            Historical owner intake worksheet
          </Link>
        </details>
      </div>
    </AppShell>
  );
}
