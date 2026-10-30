import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LocalCheck } from "./LocalCheck";

export const metadata: Metadata = { title: "Comms Hub Connection · iCamp" };

export default function CommsHubConnectionPage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">I.T. · QL-265</p>
          <h1>Comms Hub connection</h1>
          <p className="hero-panel__lead">
            Local contract self-check and separate private approval gate.
          </p>
        </section>
        <LocalCheck />
        <Link href="/integration/ql258">Owner intake worksheet</Link>
      </div>
    </AppShell>
  );
}
