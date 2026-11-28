import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AccessShell } from "@/components/access-shell";
import { SectionHeading } from "@/components/section-heading";
import { safeReturnPath } from "@/lib/auth/request-security";
import { workspaceKind288 } from "@/lib/build288/workspace.mjs";

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
  const next = safeReturnPath(
    typeof params.next === "string" ? params.next : null,
  );
  const workspace = workspaceKind288(next);
  const platform = workspace === "platform";
  const campground = workspace === "campground";
  const guest = workspace === "guest";
  const Shell = platform ? AccessShell : AppShell;
  const error = params.error === "credentials";
  const status = typeof params.status === "string" ? params.status : null;

  return (
    <Shell>
      <div className="page-stack">
        <section
          className="content-panel auth-panel"
          aria-labelledby="login-heading"
        >
          <SectionHeading
            eyebrow="Secure account"
            title={
              platform
                ? "Platform administrator sign-in"
                : campground
                  ? "Campground owner or staff sign-in"
                  : guest
                    ? "Camper / guest sign-in"
                    : "Sign in to iCamp"
            }
            id="login-heading"
            helpTopic="auth.login"
          />

          {error ? (
            <p className="form-message form-message--error" role="alert">
              The username, email, or password could not be verified.
            </p>
          ) : null}

          {params.error === "workspace" ? (
            <p role="alert" className="form-message form-message--error">
              This account type does not match the selected workspace. Choose
              the correct sign-in entrance. Your existing session was not
              changed.
            </p>
          ) : null}

          {status === "registration" ? (
            <p className="form-message" role="status">
              If the address was eligible for a new guest account, registration
              is complete. You can sign in or use account recovery without iCamp
              revealing whether an address was already registered.
            </p>
          ) : null}

          {status === "owner-first-password" ? (
            <p className="form-message" role="status">
              Rosevear first password has been set. Sign in with username
              Rosevear and the personal password we just chose. After sign-in,
              complete authenticator enrollment at Account MFA. GOD MODE still
              requires independently verified platform owner approval.
            </p>
          ) : null}

          {status === "reset" ? (
            <p className="form-message" role="status">
              Your password was changed and previous sessions were revoked.
            </p>
          ) : null}

          <p>
            {platform
              ? "Use your authorized platform operator account (Rosevear)."
              : campground
                ? "Use your assigned campground account (for example, CampRosevear)."
                : guest
                  ? "Use your guest account (for example, SampleCamper)."
                  : "Choose your workspace before signing in."}
          </p>
          <div className="auth-links">
            <Link href="/auth/login?next=%2Fsysop">Platform administrator</Link>
            <Link href="/auth/login?next=%2Fcampground">
              Campground owner or staff
            </Link>
            <Link href="/auth/login?next=%2Fguest%2Fhub">Camper / guest</Link>
          </div>
          <form className="auth-form" action="/api/auth/login" method="post">
            <input name="next" type="hidden" value={next} />

            <label>
              <span>Username or email</span>
              <input
                autoComplete="username"
                name="email"
                placeholder={
                  platform
                    ? "Rosevear"
                    : campground
                      ? "CampRosevear"
                      : guest
                        ? "SampleCamper"
                        : "Username or email"
                }
                required
                type="text"
                maxLength={320}
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
            <Link href="/auth/owner-access">Platform owner access help</Link>
            <Link href="/auth/owner-setup">Rosevear first-password setup</Link>
            <Link href="/auth/mfa">Authenticator setup after login</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
