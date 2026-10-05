import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Sign in · iCamp",
  description: "Sign in to iCamp.",
};

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";
  const error = params.error === "credentials";
  const status = typeof params.status === "string" ? params.status : null;

  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel auth-panel" aria-labelledby="login-heading">
          <SectionHeading
            eyebrow="Secure account"
            title="Sign in to iCamp"
            id="login-heading"
            helpTopic="auth.login"
          />

          {error ? (
            <p className="form-message form-message--error" role="alert">
              The email or password could not be verified.
            </p>
          ) : null}

          {status === "created" ? (
            <p className="form-message" role="status">
              Your guest account was created. You can sign in now.
            </p>
          ) : null}

          {status === "reset" ? (
            <p className="form-message" role="status">
              Your password was changed and previous sessions were revoked.
            </p>
          ) : null}

          <form className="auth-form" action="/api/auth/login" method="post">
            <input name="next" type="hidden" value={next} />

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
                autoComplete="current-password"
                maxLength={128}
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>

            <button className="primary-button" type="submit">
              Sign in
            </button>
          </form>

          <div className="auth-links">
            <Link href="/auth/recover">Forgot password?</Link>
            <Link href="/auth/register">Create a guest account</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
