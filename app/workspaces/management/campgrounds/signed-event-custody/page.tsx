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
  listSignedEventCustody,
} from "@/lib/release/build256-signed-events-postgres.mjs";
import {
  claimSignedEventAction,
  reviewSignedRevocationAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Signed event custody & revocation · iCamp",
  robots: { index: false, follow: false },
};
const path = "/workspaces/management/campgrounds/signed-event-custody";

export default async function SignedEventCustodyPage({
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
  const report = await listSignedEventCustody({
    actorUserId: session.user.id,
    campgroundId: selected.campgroundId,
  }).catch(() => ({
    status: "HOLD_ORIGINAL_EVENT_LEDGER_UNAVAILABLE",
    receipts: [],
    revocations: [],
    outbox: [],
  }));
  const revoked = new Set(report.revocations.map((row) => row.receiptId));
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 256 · Slave Application Shell</p>
          <h1>Signed event renewal, replay and revocation custody</h1>
          <p className="hero-panel__lead">
            iCamp is a governed Slave Application Shell. Genuine separately
            signed originals only; each independent review and cross-Master
            outbox record is HOLD and never signifies delivery.
          </p>
        </section>
        <section className="content-panel">
          <p>
            <Link href="/workspaces/management/campgrounds/independent-review">
              Original Master and database custody
            </Link>
            {" · "}
            <Link href="/sysop/security-governance">
              Security identity registry
            </Link>
          </p>
          <p role="status">
            <strong>{report.status}</strong> · Master CONNECTED HOLD · Owner
            ACCEPTED HOLD
          </p>
          {params.result ? <p role="status">Result: {params.result}</p> : null}
          <p>Current campground: {selected.campgroundId}</p>
          <p>
            Original packet and issuer pin are read solely from protected
            server configuration. If any independent Master source, signed
            issuer, or database migration is unavailable, intake fails closed.
          </p>
          <form action={claimSignedEventAction}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <button type="submit">
              Admit verified original signed event as HOLD
            </button>
          </form>
        </section>
        <section className="content-panel">
          <h2>Immutable original receipt claims</h2>
          {report.receipts.length ? (
            <ul>
              {report.receipts.map((row) => (
                <li key={row.id}>
                  <strong>{row.sourceApp}</strong> · {row.eventType}
                  {" · "}
                  {row.at} · Expires {row.expiresAt}
                  {" · "}
                  <code>{row.id}</code>
                  {revoked.has(row.id) ? " · independently revoked" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No genuine original signed events admitted.</p>
          )}
        </section>
        <section className="content-panel">
          <h2>Independent signed revocation review</h2>
          <p>
            Select a source receipt and a separately admitted Ed25519-signed
            security-exception receipt from the SAME original issuer. A
            different MFA-qualified owner must review. This queues only
            undelivered non-sensitive metadata to the three Masters.
          </p>
          <form action={reviewSignedRevocationAction}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Original source receipt
              <select name="revokedReceiptId" required defaultValue="">
                <option value="" disabled>
                  Select original
                </option>
                {report.receipts
                  .filter((row) => !revoked.has(row.id))
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.sourceApp} · {row.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Independently signed revocation receipt
              <select
                name="signedRevocationReceiptId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select genuine signed exception
                </option>
                {report.receipts
                  .filter(
                    (row) =>
                      row.eventType === "security_exception.v1" &&
                      row.revokesDigest,
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.sourceApp} · {row.id}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Revocation reason
              <select name="reasonCode" defaultValue="security_exception">
                <option value="security_exception">Security exception</option>
                <option value="issuer_key_compromised">
                  Issuer key compromised
                </option>
                <option value="receipt_replaced">Receipt replaced</option>
                <option value="consent_revoked">Consent revoked</option>
                <option value="source_revoked">Source revoked</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={!report.receipts.some((r) => r.revokesDigest)}
            >
              Record independently reviewed revocation (delivery HOLD)
            </button>
          </form>
          {report.revocations.map((row) => (
            <p key={row.id}>
              {row.reasonCode} · {row.receiptId} · {row.at}
            </p>
          ))}
        </section>
        <section className="content-panel">
          <h2>Undelivered cross-Master outbox</h2>
          {report.outbox.map((row) => (
            <p key={row.id}>
              {row.targetApp} · {row.status} · {row.at}
            </p>
          ))}
          {!report.outbox.length ? (
            <p>No signed revocation handoffs queued.</p>
          ) : null}
          <p>
            No scheduler, retry transport, recipient ACK, or brand customer
            records are transmitted. Devil n Dove and Rosie Dazzlers remain
            separate applications with governed Master routing contracts.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
