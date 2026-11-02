import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { requireSignedIn } from "@/lib/auth/current-session";

import { MfaPanel } from "./mfa-panel";

export const metadata: Metadata = {
  title: "Authenticator security · iCamp",
};
export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const session = await requireSignedIn("/auth/mfa");
  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Secure account</p>
          <h1>Authenticator verification</h1>
          <p className="hero-panel__lead">
            {session.user.username ?? session.user.email} · A second factor is
            required for privileged platform access. Verified sessions expire
            their elevated assurance after 15 minutes.
          </p>
        </section>
        <MfaPanel />
      </main>
    </AppShell>
  );
}
