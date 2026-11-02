import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OwnerAudit } from "./worksheet";

export const metadata: Metadata = {
  title: "Build 158 billing and evidence audit · iCamp",
};

export default function Build158AuditPage() {
  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 158 · Nonsecret review</p>
          <h1>Billing, subscriber terms and connection evidence</h1>
          <p className="hero-panel__lead">
            Track owner-reported progress without credentials, customer
            information, proof keys or private witness identities. This page
            cannot authorize contracts, subscription charges or gateway tests.
          </p>
        </section>
        <OwnerAudit />
        <section className="content-panel">
          <h2>Independent review still required</h2>
          <p>
            Billing needs a reviewed subscription adapter and provider-sandbox
            lifecycle tests. Subscriber terms need legal approval, published
            versions and acceptance evidence. Six-app connections separately
            need genuine signed proof B, tenant isolation and private approval
            before authenticated TEST requests.
          </p>
          <Link href="/launch/readiness">Launch readiness</Link>
          {" · "}
          <Link href="/integration/comms-hub">Connection review</Link>
        </section>
      </main>
    </AppShell>
  );
}
