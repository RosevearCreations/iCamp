import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessShell } from "@/components/access-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { inspectOwnAccount287 } from "@/lib/build287/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My platform access readiness · iCamp",
  robots: { index: false, follow: false },
};

export default async function PlatformReadinessPage() {
  const session = await requireStaff("/sysop");
  if (session.assuranceLevel !== "aal2") redirect("/auth/mfa?next=%2Fsysop");
  const result = await inspectOwnAccount287(session);
  const rows = [
    ["Fresh server-verified MFA session", result.sessionVerified],
    ["Read-only database inspection", result.querySucceeded],
    ["Configured database host pin matches", result.hostPin === "matches"],
    ["Migration ledger present", result.migrationLedger],
    ["Independent owner-binding table present", result.ownerBindingTable],
    [
      "My verified MFA factor and required policy",
      result.mfaVerified && result.mfaRequired,
    ],
    ["My active platform grant", result.grantActive],
    ["My independently reviewed owner binding", result.bindingVerified],
  ] as const;
  return (
    <AccessShell>
      <section className="content-panel auth-panel">
        <h1>My platform access readiness</h1>
        <p>Signed in: {session.user.username ?? session.user.email}</p>
        <p role="status">{result.status}</p>
        <p>
          This report reads only your own access prerequisites. A matching host
          pin is not independent database custody or migration certification.
        </p>
        <dl className="status-details">
          {rows.map(([label, passed], index) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {index > 2 &&
                (!result.querySucceeded || !result.sessionVerified)
                  ? "Not inspected"
                  : passed
                    ? "Present"
                    : "Not established"}
              </dd>
            </div>
          ))}
        </dl>
        <h2>Safe next action</h2>
        <p>
          If the ledger or binding table is absent, the original database
          custodian must reconcile the actual schema against canonical
          migrations, verify a recoverable backup and rehearse the repair on an
          isolated restore before approved production migration.
        </p>
        <p>
          An independent reviewer must verify owner identity and approve the
          platform grant and binding. Do not reset a working password, replace
          Authy, self-approve or activate a campground role as a substitute.
        </p>
        <p>
          This screen does not change credentials, approve access or establish
          that any other account is ready to sign in.
        </p>
        <div className="auth-links">
          <Link href="/sysop">Retry administrator access</Link>
          <Link href="/auth/owner-access">Trusted owner recovery guidance</Link>
          <Link href="/auth/account">My account</Link>
        </div>
      </section>
    </AccessShell>
  );
}
