import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Choose a new password · iCamp",
  description: "Complete iCamp password recovery.",
};

export default async function ResetPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invalid = params.status === "invalid";

  return (
    <AppShell>
      <div className="page-stack">
        <section
          className="content-panel auth-panel"
          aria-labelledby="reset-heading"
        >
          <SectionHeading
            eyebrow="Account recovery"
            title="Choose a new password"
            id="reset-heading"
            helpTopic="auth.recovery"
          />

          {invalid ? (
            <p className="form-message form-message--error" role="alert">
              That recovery link is invalid, expired, or has already been used.
            </p>
          ) : null}

          <form
            className="auth-form"
            action="/api/auth/recovery/reset"
            method="post"
          >
            <input name="token" type="hidden" value={token} />

            <label>
              <span>New password</span>
              <input
                autoComplete="new-password"
                maxLength={128}
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>

            <button className="primary-button" disabled={!token} type="submit">
              Change password
            </button>
          </form>

          {!token ? (
            <p className="field-guidance">
              A valid recovery link is required before a password can be
              changed.
            </p>
          ) : null}

          <div className="auth-links">
            <Link href="/auth/recover">Request a new recovery link</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
