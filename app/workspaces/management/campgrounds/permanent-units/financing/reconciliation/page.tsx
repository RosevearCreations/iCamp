import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import { getReconciliationDashboard } from "@/lib/permanent-unit-reconciliation/postgres.mjs";
import { reconcileEvidenceAction, reviewClosureAction } from "./actions";
import styles from "../../../reservations/reservations.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance delivery evidence reconciliation · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/reconciliation";
export default async function ReconciliationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(path),
    params = await searchParams;
  const allowed = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (c) => ({
        ...c,
        allowed: await hasCampgroundPermission(
          session.user.id,
          c.campgroundId,
          "permanent_unit.transfer",
        ),
      })),
    )
  ).filter((c) => c.allowed);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((c) => c.campgroundId === params.campground) ?? allowed[0];
  const data = await getReconciliationDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const hidden = (
    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/receipts">
            Delivery receipts
          </Link>
          <span>/</span>
          <span>Reconciliation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 097 · Independent operator review</p>
          <h1>Finance delivery evidence reconciliation</h1>
          <p className="hero-panel__lead">
            Snapshot version-pinned delivery and response evidence, flag
            incomplete records, and independently review internal follow-up or
            closure.
          </p>
          <p>
            <strong>Administrative closure only.</strong> This screen does not
            issue credit, validate legal disclosure compliance, deliver or
            accept an agreement, transfer ownership, move money, or treat
            silence as consent.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={`${styles.notice} ${styles.error}`}>
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="recon-camp"
            eyebrow="Private campground"
            title="Select property"
            helpTopic="permanent.reconciliation"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((c) => (
                  <option value={c.campgroundId} key={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open
            </button>
          </form>
          <p>
            {data.campground.name} · {data.reconciliations.length} snapshots ·{" "}
            {data.reviews.length} closure reviews
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="recon-ledger"
            eyebrow="Source-linked snapshots"
            title="Review manual delivery lineage"
            helpTopic="permanent.reconciliation"
          />
          {!data.consents.length ? (
            <p>
              No consented handoff cases yet. Start with{" "}
              <Link href="/workspaces/management/campgrounds/permanent-units/financing/delivery">
                delivery consent
              </Link>
              .
            </p>
          ) : null}
          {data.consents.map((c) => {
            const signoff = data.signoffs.find((s) => s.consent_id === c.id),
              receipt = data.receipts.find((r) => r.consent_id === c.id),
              ack = receipt
                ? data.responses.find((a) => a.receipt_id === receipt.id)
                : undefined;
            const exception = data.exceptions.find(
                (e) => e.consent_id === c.id,
              ),
              held = exception?.event_type === "hold";
            const complete =
              !!receipt &&
              !!ack &&
              ack.response === "receipt_confirmed" &&
              !held &&
              signoff?.decision === "ready_for_manual_handoff";
            const snapshots = data.reconciliations.filter(
              (r) => r.consent_id === c.id,
            );
            const closed = snapshots.some((r) =>
              data.reviews.some(
                (v) =>
                  v.reconciliation_id === r.id &&
                  v.decision === "closed_internal_evidence",
              ),
            );
            return (
              <article key={c.id} className="content-panel">
                <h3>
                  {c.buyer_display_name} · {c.version_code}
                </h3>
                <p>
                  <strong>Document SHA-256:</strong>{" "}
                  <code>{c.content_sha256}</code> ·{" "}
                  <strong>Manual sign-off:</strong>{" "}
                  {signoff?.decision ?? "Missing"}
                </p>
                <p>
                  <strong>Delivery evidence:</strong>{" "}
                  {receipt?.evidence_reference ?? "Missing"} ·{" "}
                  <strong>Applicant response:</strong>{" "}
                  {ack?.response ?? "Missing"} · <strong>Exception:</strong>{" "}
                  {held ? "ACTIVE HOLD" : exception ? "Cleared" : "None"}
                </p>
                <p>
                  <strong>Reconciliation:</strong>{" "}
                  {complete
                    ? "Evidence fields complete — requires independent review"
                    : "Follow-up required"}{" "}
                  · <strong>Administrative closure:</strong>{" "}
                  {closed ? "Previously closed" : "Open"}
                </p>
                {!closed ? (
                  <form
                    action={reconcileEvidenceAction}
                    className={styles.formGrid}
                  >
                    {hidden}
                    <input type="hidden" name="consentId" value={c.id} />
                    <input
                      type="hidden"
                      name="receiptId"
                      value={receipt?.id ?? ""}
                    />
                    <input
                      type="hidden"
                      name="acknowledgementId"
                      value={ack?.id ?? ""}
                    />
                    <input
                      type="hidden"
                      name="disclosureVersionId"
                      value={c.version_id}
                    />
                    <input
                      type="hidden"
                      name="disclosureSha256"
                      value={c.content_sha256}
                    />
                    <input
                      type="hidden"
                      name="lastExceptionEventId"
                      value={exception?.id ?? ""}
                    />
                    <input
                      type="hidden"
                      name="completeness"
                      value={complete ? "evidence_complete" : "needs_followup"}
                    />
                    <label>
                      Independent reconciliation source ID
                      <input
                        name="reconciliationReference"
                        minLength={8}
                        maxLength={400}
                        required
                      />
                    </label>
                    <label>
                      Evidence comparison / missing items
                      <textarea
                        name="note"
                        minLength={12}
                        maxLength={800}
                        rows={2}
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Pin immutable evidence snapshot
                    </button>
                  </form>
                ) : null}
                {snapshots.map((r) => {
                  const decision = data.reviews.find(
                    (v) => v.reconciliation_id === r.id,
                  );
                  return (
                    <article key={r.id} className="content-panel">
                      <h4>
                        {r.completeness} · {r.reconciliation_reference}
                      </h4>
                      <p>
                        {r.note} ·{" "}
                        {decision
                          ? `Reviewed: ${decision.decision}`
                          : "Awaiting independent reviewer"}
                      </p>
                      {!decision ? (
                        <form
                          action={reviewClosureAction}
                          className={styles.formGrid}
                        >
                          {hidden}
                          <input
                            type="hidden"
                            name="reconciliationId"
                            value={r.id}
                          />
                          <label>
                            Independent operator outcome
                            <select
                              name="decision"
                              defaultValue={
                                r.completeness === "evidence_complete" && !held
                                  ? "closed_internal_evidence"
                                  : "returned_for_rework"
                              }
                            >
                              <option value="returned_for_rework">
                                Return evidence for rework
                              </option>
                              <option
                                value="closed_internal_evidence"
                                disabled={
                                  r.completeness !== "evidence_complete" ||
                                  held ||
                                  closed
                                }
                              >
                                Close internal evidence review only
                              </option>
                            </select>
                          </label>
                          <label>
                            Restricted review source
                            <input
                              name="reviewReference"
                              minLength={8}
                              maxLength={400}
                              required
                            />
                          </label>
                          <label>
                            Independent closure rationale
                            <textarea
                              name="note"
                              minLength={12}
                              maxLength={800}
                              required
                            />
                          </label>
                          <button className="primary-button" type="submit">
                            Record independent closure review
                          </button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
