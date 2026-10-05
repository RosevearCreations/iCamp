import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Recover account · iCamp",
  description: "Request iCamp password recovery.",
};

export default async function RecoverPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const params = await searchParams;
  const requested = params.status === "requested";

  return (
    <AppShell>
      <div className="page-stack">
        <section
          className="content-panel auth-panel"
          aria-labelledby="recover-heading"
        >
          <SectionHeading
            eyebrow="Account recovery"
            title="Reset your password"
            id="recover-heading"
            helpTopic="auth.recovery"
          />

          {requested ? (
            <p className="form-message" role="status">
              If that account is eligible for recovery, the recovery workflow has
              been requested. iCamp does not reveal whether an email address
              exists.
            </p>
          ) : (
            <p className="field-guidance">
              Enter the account email. The response is intentionally identical
              whether or not the address exists.
            </p>
          )}

          <form
            className="auth-form"
            action="/api/auth/recovery/request"
            method="post"
          >
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                required
                type="email"
              />
            </label>

            <button className="primary-button" type="submit">
              Request password reset
            </button>
          </form>

          <div className="auth-links">
            <Link href="/auth/login">Return to sign in</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
