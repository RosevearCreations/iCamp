import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Rosevear login help · iCamp",
  robots: { index: false, follow: false },
};
export default function OwnerDiagnosticsPage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel auth-panel">
          <p className="eyebrow">Build 275 · protected recovery help</p>
          <h1>Rosevear login diagnostics</h1>
          <p>
            Sign in with username Rosevear and the personal password selected
            during one-time setup. The one-time recovery credential is not
            your daily password.
          </p>
          <p>
            If setup is on hold, the credential may have expired or been used,
            or the original database may be unavailable. A verified owner must
            confirm the original account and trusted issuer before any reset.
            Repeated password guesses can temporarily lock access.
          </p>
          <p>
            After login, complete authenticator verification. Operator access
            still requires an independently approved owner binding.
            This public page intentionally does not reveal any account,
            database, credential, secret or source-signer status.
          </p>
          <p>
            <Link href="/auth/owner-setup">First-password setup</Link>
            {" · "}
            <Link href="/auth/login?next=%2Fauth%2Fmfa">Sign in</Link>
            {" · "}
            <Link href="/auth/owner-access">Trusted recovery guidance</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
