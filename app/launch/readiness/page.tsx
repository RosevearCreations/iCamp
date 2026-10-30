import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LaunchWorksheet } from "./worksheet";

export const metadata: Metadata = { title: "Launch readiness · iCamp" };

export default function LaunchReadinessPage() {
  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 156 · Release gate</p>
          <h1>Launch, tenant billing and connections</h1>
          <p className="hero-panel__lead">
            Track the evidence needed before paid campground operations begin.
            This is an owner-reported readiness worksheet, not a production
            activation switch or independent approval.
          </p>
        </section>
        <LaunchWorksheet />
        <section className="content-panel">
          <h2>Required before opening to paying campgrounds</h2>
          <p>
            Legal terms and privacy review, a provider contract, genuine
            isolated tenant and payment tests, consent checks, connected device
            recovery, independent sign-off and operational support must all be
            completed. No customer billing, SMS, telephone calls or gate
            commands are performed by this page.
          </p>
          <Link href="/pilot/acceptance">Pilot acceptance</Link>
          {" · "}
          <Link href="/integration/comms-hub">Connection review</Link>
        </section>
      </main>
    </AppShell>
  );
}
