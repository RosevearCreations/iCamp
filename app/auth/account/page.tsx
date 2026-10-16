import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";

export const metadata: Metadata = {
  title: "Account · iCamp",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSignedIn("/auth/account");

  return (
    <AppShell>
      <div className="page-stack">
        <section
          className="content-panel auth-panel"
          aria-labelledby="account-heading"
        >
          <SectionHeading
            eyebrow="Secure account"
            title="Your iCamp session"
            id="account-heading"
            helpTopic="auth.sessions"
          />

          <dl className="status-details">
            <div>
              <dt>Email</dt>
              <dd>{session.user.email}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd>{session.user.accountType}</dd>
            </div>
            <div>
              <dt>Session assurance</dt>
              <dd>{session.assuranceLevel}</dd>
            </div>
          </dl>

          {session.user.accountType === "guest" ? (
            <>
              <p>
                <Link href="/guest/stay">Open My Stay guest portal →</Link>
              </p>
              <p>
                <Link href="/guest/profile">
                  Manage saved stay information & history →
                </Link>
              </p>
            </>
          ) : null}

          <form action="/api/auth/logout" method="post">
            <button className="primary-button" type="submit">
              Sign out
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
