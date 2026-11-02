import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listAccessReconciliation } from "@/lib/access-reconciliation/postgres.mjs";
import { reviewCredentialAction } from "./actions";

import styles from "./reconciliation.module.css";

const PATH = "/workspaces/security/credentials";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Access credential reconciliation · iCamp",
  description:
    "Private visitor, vehicle and stay credential consistency review.",
  robots: { index: false, follow: false },
};

function displayDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-CA", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " UTC"
    : "Not set";
}
function label(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AccessCredentialReconciliationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(PATH);
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel">
          <h1>Reconciliation unavailable</h1>
          <p>The database is not configured. No changes were made.</p>
        </section>
      </AppShell>
    );
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions: string[] = authorization?.permissions ?? [];
        const canRead =
          permissions.includes("access.credential.issue") ||
          permissions.includes("access.credential.revoke");
        return canRead
          ? {
              ...campground,
              canReview: permissions.includes("access.reconciliation.review"),
            }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const board = await listAccessReconciliation({
    actorUserId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/security">Security</Link>
          <span>/</span>
          <span>Credential reconciliation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 188 · Safe in-app access controls</p>
          <h1>Visitor, Vehicle &amp; Credential Reconciliation</h1>
          <p className="hero-panel__lead">
            Check the canonical credential against visitor, vehicle-pass or
            checked-in stay status. Expired, revoked, inactive and duplicate
            source assignments are denied in the in-app verdict. Review notes do
            not issue, revive or operate physical passes.
          </p>
          <p>
            <Link href="/workspaces/security/dashboard">
              Back to access operations
            </Link>{" "}
            ·{" "}
            <Link href="/workspaces/security/incidents">
              Security incident cases
            </Link>
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.success}>
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={styles.error}>
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <h2>Campground and review scope</h2>
          <form className={styles.scope} method="get">
            <label>
              Campground{" "}
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Review property
            </button>
          </form>
          <p className={styles.note}>
            Scanned {board.items.length} of {board.total} credentials at{" "}
            {displayDate(board.scannedAt)}. {board.needsAttention} of the
            displayed credentials need attention.{" "}
            {board.total > board.items.length
              ? "This is a bounded preview; refine operational review in batches before assuming all assignments are clear."
              : "All recorded credentials were considered."}
          </p>
          <p className={styles.note}>
            <strong>Physical gate execution: HELD.</strong> No connected-device
            commands, secret tokens, SMS or IVR actions run here. Staff-assisted
            follow-up only.
          </p>
        </section>
        <section className="content-panel">
          <h2>Canonical credential decisions</h2>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Enrollment</th>
                  <th>Validity</th>
                  <th>In-app verdict</th>
                  <th>Reasoned review</th>
                </tr>
              </thead>
              <tbody>
                {board.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.credentialNumber}</strong>
                      <small>
                        {label(item.credentialType)} · {label(item.subjectKind)}
                      </small>
                      <small>{item.subjectLabel}</small>
                      <small>Hint: {item.displayHint ?? "Not provided"}</small>
                    </td>
                    <td>
                      {label(item.sourceKind)}
                      <small>
                        {item.sourceNumber ?? "No linked pass number"}
                      </small>
                      <small>Source: {label(item.sourceStatus)}</small>
                      <small>
                        Assignment:{" "}
                        {item.assignmentStatus
                          ? label(item.assignmentStatus)
                          : "Not applicable"}
                      </small>
                      {item.duplicateCount > 1 &&
                      (item.sourceKind === "visitor" ||
                        item.sourceKind === "vehicle_pass") ? (
                        <strong className={styles.warning}>
                          Multiple overlapping assignments (
                          {item.duplicateCount})
                        </strong>
                      ) : null}
                    </td>
                    <td>
                      Credential: {label(item.status)}
                      <small>From {displayDate(item.validFrom)}</small>
                      <small>Until {displayDate(item.validUntil)}</small>
                      {item.sourceValidUntil ? (
                        <small>
                          Source until {displayDate(item.sourceValidUntil)}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <strong
                        className={
                          item.verdict.allowed ? styles.allowed : styles.warning
                        }
                      >
                        {item.verdict.allowed ? "VALID IN APP" : "DENIED"}
                      </strong>
                      <small>{label(item.verdict.reason)}</small>
                    </td>
                    <td>
                      {selected.canReview ? (
                        <form
                          action={reviewCredentialAction}
                          className={styles.review}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="credentialId"
                            value={item.id}
                          />
                          <input
                            type="hidden"
                            name="rowVersion"
                            value={item.rowVersion}
                          />
                          <label>
                            Review disposition{" "}
                            <select
                              name="disposition"
                              defaultValue="acknowledged"
                            >
                              <option value="acknowledged">Acknowledged</option>
                              <option value="override_reviewed">
                                Operator override reviewed (no access grant)
                              </option>
                            </select>
                          </label>
                          <label>
                            Required reason{" "}
                            <textarea
                              name="reason"
                              required
                              minLength={20}
                              maxLength={1000}
                              rows={2}
                              placeholder="Document mismatch, source checked and next step"
                            />
                          </label>
                          <button type="submit" className="primary-button">
                            Record review
                          </button>
                        </form>
                      ) : (
                        <span>Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!board.items.length ? (
            <p>No credential records are visible for this property.</p>
          ) : null}
        </section>
        <section className="content-panel">
          <h2>Recent reconciliation evidence</h2>
          <ul className={styles.history}>
            {board.reviews.map((review, index) => (
              <li key={`${review.credentialId}-${review.observedAt}-${index}`}>
                <strong>{label(review.disposition)}</strong> ·{" "}
                {label(review.verdict)} · {displayDate(review.observedAt)}
                <small>
                  Credential record {review.credentialId} ·{" "}
                  {label(review.status)} / {label(review.sourceStatus)}
                </small>
                <p>{review.reason}</p>
              </li>
            ))}
          </ul>
          {!board.reviews.length ? (
            <p>
              No reviews recorded. Credentials are evaluated from their current
              canonical records.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
