import Link from "next/link";
import { AccessShell } from "@/components/access-shell";
import { requireSignedIn } from "@/lib/auth/current-session";

export const dynamic = "force-dynamic";
export default async function PlatformDeniedPage() {
  const session = await requireSignedIn("/sysop");
  return (
    <AccessShell>
      <section className="content-panel auth-panel">
        <h1>Platform administrator access not approved</h1>
        <p>
          Signed in: {session.user.username ?? session.user.email} ·{" "}
          {session.user.accountType} · {session.assuranceLevel}
        </p>
        <p>
          {session.assuranceLevel !== "aal2"
            ? "Fresh authenticator verification is required."
            : "Your MFA session is verified, but the platform grant, independent owner binding or required database schema has not passed authorization. This is not a password failure."}
        </p>
        <p>
          Campground permissions never grant platform administrator access.
          Contact the trusted original owner or database custodian to review the
          missing approval.
        </p>
        <div className="auth-links">
          <Link href="/auth/mfa?next=%2Fsysop">
            Verify existing authenticator
          </Link>
          <Link href="/auth/owner-access">Owner recovery guidance</Link>
          <Link href="/auth/account">My account</Link>
          <Link href="/auth/login?next=%2Fcampground">Campground sign-in</Link>
        </div>
      </section>
    </AccessShell>
  );
}
