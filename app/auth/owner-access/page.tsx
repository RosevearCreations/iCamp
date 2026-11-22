import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = {
  title: "Privileged account recovery · iCamp",
  description: "Secure original owner enrollment support",
  robots: { index: false, follow: false },
};
export default function OwnerAccessHelp() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel auth-panel">
          <h1>iCamp platform owner access recovery</h1>
          <p>
            A Rosevear platform owner account may require separate enrollment,
            verified recovery email and multifactor authentication before it can
            sign in. Changing a password does not enable a disabled account or
            activate a pending privileged grant.
          </p>
          <p>
            For security, contact an already verified independent platform owner
            or the original database custodian through the established private
            administrator channel. They should independently confirm the
            production database host, recover/verify the account contact,
            approve the owner binding, provision a fresh password using a
            private secret store and enroll an MFA factor. Revoke previous
            sessions.
          </p>
          <p>
            Do not send passwords, reset tokens, database URLs, private keys or
            MFA seeds into a public support ticket, chat, repository or
            screenshots. This page does not reveal whether any particular
            account exists.
          </p>
          <p>
            For our first sign-in, use the owner-issued, expiring recovery
            credential at{" "}
            <Link href="/auth/owner-setup">Rosevear first-password setup</Link>.
            It can only create a missing password once and does not approve
            elevated access or MFA automatically.
          </p>
          <p>
            <Link href="/auth/login?next=%2Fsysop">
              Return to Rosevear operator sign-in
            </Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
