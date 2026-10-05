import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Create guest account · iCamp",
  description: "Create an iCamp guest account.",
};

export default async function RegisterPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const params = await searchParams;
  const review = params.status === "review";

  return (
    <AppShell>
      <div className="page-stack">
        <section
          className="content-panel auth-panel"
          aria-labelledby="register-heading"
        >
          <SectionHeading
            eyebrow="Guest account"
            title="Create an iCamp account"
            id="register-heading"
            helpTopic="auth.register"
          />

          {review ? (
            <p className="form-message form-message--error" role="alert">
              The account could not be created with those details. Check the
              information and try again.
            </p>
          ) : null}

          <form className="auth-form" action="/api/auth/register" method="post">
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

            <label>
              <span>Password</span>
              <input
                autoComplete="new-password"
                aria-describedby="password-guidance"
                maxLength={128}
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>

            <p className="field-guidance" id="password-guidance">
              Use at least 12 characters. A long memorable passphrase is welcome.
            </p>

            <button className="primary-button" type="submit">
              Create guest account
            </button>
          </form>

          <div className="auth-links">
            <Link href="/auth/login">Already have an account? Sign in</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
