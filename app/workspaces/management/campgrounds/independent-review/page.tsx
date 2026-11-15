import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  listSourceRemediationEvidence,
  protectedThreeMasterFreshness,
} from "@/lib/release/build254-security-postgres.mjs";
import {
  DECISIONS,
  MASTER_PLANES,
} from "@/lib/release/build254-security-core.mjs";
import {
  claimProtectedReceiptAction,
  independentRemediationDecisionAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Independent signed-source review · iCamp",
  robots: { index: false, follow: false },
};
const path = "/workspaces/management/campgrounds/independent-review";

export default async function IndependentReviewPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; result?: string }>;
}>) {
  const session = await requireStaff(path);
  if (session.assuranceLevel !== "aal2")
    redirect("/auth/mfa?next=" + encodeURIComponent(path));
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (item) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return grant?.roleCodes.includes("owner_admin") &&
          grant.permissions.includes("staff.manage") &&
          grant.permissions.includes("reservation.modify")
          ? item
          : null;
      }),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (
    !allowed.length ||
    (params.campground &&
      !allowed.some((entry) => entry.campgroundId === params.campground))
  )
    redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const [evidence, masters] = await Promise.all([
    listSourceRemediationEvidence({
      actorUserId: session.user.id,
      campgroundId: selected.campgroundId,
    }).catch(() => ({
      status: "HOLD_SOURCE_LEDGER_UNAVAILABLE",
      claims: [],
      decisions: [],
      truncated: false,
    })),
    Promise.resolve(protectedThreeMasterFreshness()),
  ]);
  const resolved = new Set(evidence.decisions.map((r) => r.claimId));
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel">
          <p className="eyebrow">Build 254 · independent restricted review</p>
          <h1>
            Original receipt replay protection &amp; remediation decisions
          </h1>
          <p className="hero-panel__lead">
            Meadow and Orbit remain unchanged. Only an MFA-qualified campground
            owner can record verified original source claims. A different
            authorized reviewer must record any HOLD disposition.
          </p>
        </section>
        <section className="content-panel">
          <p>
            <Link href="/workspaces/management/campgrounds/fulfillment-priority">
              Return to campground fulfillment
            </Link>
          </p>
          <p role="status">
            <strong>{evidence.status}</strong> · Owner acceptance HOLD.
          </p>
          {params.result ? <p role="status">Result: {params.result}</p> : null}
          <p>Campground: {selected.campgroundId}</p>
          <p>
            Receipts come only from independently verified protected original
            source signatures. Duplicate nonce claims are rejected across all
            campgrounds and organizations.
          </p>
          <form action={claimProtectedReceiptAction}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Signed original type
              <select name="receiptType" defaultValue="database_provenance">
                <option value="database_provenance">
                  Independent database provenance
                </option>
                <option value="master_source">
                  Three-Master original source
                </option>
              </select>
            </label>
            <label>
              Master plane (only for Master receipt)
              <select name="masterPlane" defaultValue="ai-data-platform">
                {MASTER_PLANES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Record genuine signed receipt as HOLD</button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Original three-Master receipt freshness</h2>
          <p>
            All three signed originals current:{" "}
            <strong>{masters.allCurrent ? "SOURCE ONLY" : "HOLD"}</strong>
          </p>
          <ul>
            {masters.results.map((row) => (
              <li key={row.plane}>
                {row.plane}: {row.status} — {row.horizon}
              </li>
            ))}
          </ul>
          <p>
            Fresh signatures do not grant receiver ON, Master CONNECTED or owner
            approval.
          </p>
        </section>
        <section className="content-panel">
          <h2>Tenant-private source claims</h2>
          <ul>
            {evidence.claims.map((claim) => (
              <li key={claim.id}>
                <strong>{claim.receiptType}</strong> {claim.masterPlane ?? ""}
                {" · "}
                {claim.decision} · {claim.at} · <code>{claim.id}</code>
                {resolved.has(claim.id) ? " · reviewed" : ""}
              </li>
            ))}
          </ul>
          {!evidence.claims.length ? <p>No signed claims admitted.</p> : null}
        </section>
        <section className="content-panel">
          <h2>Second-person independent remediation</h2>
          <p>
            A different owner must review the original claim. Only HOLD, reject,
            or requests for new evidence are allowed.
          </p>
          <form action={independentRemediationDecisionAction}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Original unreviewed source claim
              <select name="claimId" required defaultValue="">
                <option value="" disabled>
                  Choose a source receipt
                </option>
                {evidence.claims
                  .filter((claim) => !resolved.has(claim.id))
                  .map((claim) => (
                    <option key={claim.id} value={claim.id}>
                      {claim.receiptType} {claim.masterPlane ?? ""} — {claim.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Decision
              <select name="decision" defaultValue="hold">
                {DECISIONS.map((decision) => (
                  <option key={decision} value={decision}>
                    {decision.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Explanation (12–300 characters)
              <textarea
                name="explanation"
                required
                minLength={12}
                maxLength={300}
                rows={3}
              />
            </label>
            <button
              type="submit"
              disabled={!evidence.claims.some((c) => !resolved.has(c.id))}
            >
              Record independent HOLD/review
            </button>
          </form>
          {evidence.decisions.map((decision) => (
            <p key={decision.id}>
              {decision.decision} · {decision.claimId} · {decision.at}
            </p>
          ))}
          {evidence.truncated ? <p>Older records are not displayed.</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
