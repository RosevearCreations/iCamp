import Link from "next/link";
import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";
import { listPlatformAccounts286 } from "@/lib/platform/postgres.mjs";

export const dynamic = "force-dynamic";
export default async function PlatformAccountsPage() {
  const { session } = await requireSysop("/sysop");
  const accounts = await listPlatformAccounts286(
    session.user.id,
    session.assuranceLevel,
  );
  return (
    <SysopShell>
      <section className="content-panel">
        <h1>User accounts and access</h1>
        <p>
          Platform operator directory. Campground guest and staff records belong
          to their assigned tenant. No passwords, recovery tokens or
          authenticator keys are displayed.
        </p>
        {accounts ? (
          <div className="account-directory286">
            {accounts.map((account, index) => (
              <article className="content-panel" key={index}>
                <h2>{account.username ?? "Username not configured"}</h2>
                <p>
                  Account: {account.account_state} · Platform grant:{" "}
                  {account.grant_state}
                </p>
                <p>
                  Owner binding: {account.binding_state ?? "Missing"} · Owner
                  slot: {account.owner_slot ?? "None"}
                </p>
                <p>
                  MFA: {account.mfa_enrolled ? "Enrolled" : "Not verified"} ·{" "}
                  {account.mfa_required ? "Required" : "Not required"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p role="status">Directory unavailable. Access was not granted.</p>
        )}
        <h2>Account maintenance</h2>
        <p>
          Use the existing protected account and recovery controls. Independent
          owner approval remains required for changes to privileged grants; this
          directory does not grant or reset accounts.
        </p>
        <div className="auth-links">
          <Link href="/auth/profile">Maintain my profile</Link>
          <Link href="/auth/mfa?next=%2Fsysop">Verify my MFA</Link>
          <Link href="/auth/owner-access">Privileged account recovery</Link>
          <Link href="/auth/login?next=%2Fcampground">
            Switch to campground account
          </Link>
        </div>
      </section>
    </SysopShell>
  );
}
