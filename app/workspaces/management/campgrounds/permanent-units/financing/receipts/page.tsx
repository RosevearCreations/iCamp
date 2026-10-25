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
import { getReceiptDashboard } from "@/lib/permanent-unit-receipts/postgres.mjs";
import {
  manualReceiptAction,
  applicantResponseAction,
  exceptionAction,
} from "./actions";
import styles from "../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Manual delivery evidence & exceptions · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/receipts";
const reasons = [
  "identity_mismatch",
  "disclosure_dispute",
  "delivery_failure",
  "consent_withdrawn",
  "other",
];
export default async function ReceiptsPage({
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
      (await listAssignedCampgrounds(session.user.id)).map(async (x) => ({
        ...x,
        allowed: await hasCampgroundPermission(
          session.user.id,
          x.campgroundId,
          "permanent_unit.transfer",
        ),
      })),
    )
  ).filter((x) => x.allowed);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((x) => x.campgroundId === params.campground) ?? allowed[0];
  const data = await getReceiptDashboard(
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
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/delivery">
            Delivery consent
          </Link>
          <span>/</span>
          <span>Evidence receipts</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 096 · Restricted evidence</p>
          <h1>Manual delivery receipt &amp; acknowledgement</h1>
          <p className="hero-panel__lead">
            Maintain a source-linked staff record of an external manual handoff,
            optional applicant response evidence and separately cleared
            exceptions.
          </p>
          <p>
            <strong>
              No delivery or response is performed by this screen.
            </strong>{" "}
            These are staff attestations from independently retained evidence,
            not proof of legally compliant service, electronic signature, credit
            acceptance, loan approval, payment or transfer of ownership. Never
            paste applicant financial or identity documents here.
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
            id="receipt-camp"
            eyebrow="Restricted property"
            title="Select campground"
            helpTopic="permanent.receipts"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
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
            {data.campground.name} · {data.receipts.length} manual evidence
            receipts · {data.exceptions.length} exception events
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="receipt-ledger"
            eyebrow="Exact disclosure lineage"
            title="Manual handoff evidence ledger"
            helpTopic="permanent.receipts"
          />
          {!data.consents.length ? (
            <p>
              No delivery consents yet. Start at{" "}
              <Link href="/workspaces/management/campgrounds/permanent-units/financing/delivery">
                consent and disclosures
              </Link>
              .
            </p>
          ) : null}
          {data.consents.map((c) => {
            const signoff = data.signoffs.find((s) => s.consent_id === c.id),
              receipt = data.receipts.find((r) => r.consent_id === c.id);
            const response = receipt
              ? data.responses.find((a) => a.receipt_id === receipt.id)
              : undefined;
            const latest = data.exceptions.find((e) => e.consent_id === c.id),
              held = latest?.event_type === "hold";
            return (
              <article className="content-panel" key={c.id}>
                <h3>
                  {c.buyer_display_name} · disclosure {c.version_code}
                </h3>
                <p>
                  <strong>Channel:</strong> {c.consent_channel} ·{" "}
                  <strong>Recipient source:</strong> {c.recipient_reference} ·{" "}
                  <strong>Document SHA-256:</strong>{" "}
                  <code>{c.content_sha256}</code>
                </p>
                <p>
                  <strong>Sign-off:</strong>{" "}
                  {signoff?.decision ?? "Awaiting sign-off"} ·{" "}
                  <strong>Exception:</strong>{" "}
                  {held
                    ? "ACTIVE HOLD"
                    : latest
                      ? "Cleared after independent review"
                      : "None recorded"}
                </p>
                {latest ? (
                  <p>
                    Latest exception: {latest.reason_code} ·{" "}
                    {latest.evidence_reference} · {latest.note}
                  </p>
                ) : null}
                <form action={exceptionAction} className={styles.formGrid}>
                  {hidden}
                  <input type="hidden" name="consentId" value={c.id} />
                  <label>
                    Exception action
                    <select
                      name="eventType"
                      defaultValue={held ? "clear" : "hold"}
                    >
                      <option value="hold" disabled={held}>
                        Place manual delivery on hold
                      </option>
                      <option value="clear" disabled={!held}>
                        Independently clear existing hold
                      </option>
                    </select>
                  </label>
                  <label>
                    Reason
                    <select name="reasonCode">
                      {reasons.map((r) => (
                        <option key={r} value={r}>
                          {r.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Restricted evidence source
                    <input
                      name="evidenceReference"
                      minLength={8}
                      maxLength={400}
                      required
                    />
                  </label>
                  <label>
                    Specific exception or resolution rationale
                    <textarea
                      name="note"
                      minLength={12}
                      maxLength={800}
                      required
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Record append-only exception event
                  </button>
                </form>
                {receipt ? (
                  <>
                    <p>
                      <strong>Delivery evidence:</strong>{" "}
                      {receipt.evidence_reference} · {receipt.delivered_at} ·{" "}
                      {receipt.note}
                    </p>
                    {response ? (
                      <p>
                        <strong>Applicant response:</strong> {response.response}{" "}
                        · {response.evidence_reference} · {response.note}
                      </p>
                    ) : (
                      <form
                        action={applicantResponseAction}
                        className={styles.formGrid}
                      >
                        {hidden}
                        <input
                          type="hidden"
                          name="receiptId"
                          value={receipt.id}
                        />
                        <label>
                          Externally documented applicant response
                          <select name="response">
                            <option value="receipt_confirmed" disabled={held}>
                              Receipt confirmed (not agreement acceptance)
                            </option>
                            <option value="receipt_disputed">
                              Receipt disputed
                            </option>
                            <option value="no_response">
                              No response documented
                            </option>
                          </select>
                        </label>
                        <label>
                          Actual response time (UTC)
                          <input
                            type="datetime-local"
                            name="responseAt"
                            required
                          />
                        </label>
                        <label>
                          Restricted response evidence ID
                          <input
                            name="evidenceReference"
                            minLength={8}
                            maxLength={400}
                            required
                          />
                        </label>
                        <label>
                          Response context / identity verification
                          <textarea
                            name="note"
                            minLength={12}
                            maxLength={800}
                            required
                          />
                        </label>
                        <button className="primary-button" type="submit">
                          Record separate applicant response evidence
                        </button>
                      </form>
                    )}
                  </>
                ) : signoff?.decision === "ready_for_manual_handoff" &&
                  !held ? (
                  <form
                    action={manualReceiptAction}
                    className={styles.formGrid}
                  >
                    {hidden}
                    <input type="hidden" name="consentId" value={c.id} />
                    <input type="hidden" name="signoffId" value={signoff.id} />
                    <input
                      type="hidden"
                      name="channel"
                      value={c.consent_channel}
                    />
                    <label>
                      Actual manual delivery time (UTC)
                      <input
                        type="datetime-local"
                        name="deliveredAt"
                        required
                      />
                    </label>
                    <label>
                      Restricted external handoff evidence ID
                      <input
                        name="evidenceReference"
                        minLength={8}
                        maxLength={400}
                        required
                      />
                    </label>
                    <label>
                      Independent recipient verification ID
                      <input
                        name="recipientVerificationReference"
                        minLength={8}
                        maxLength={400}
                        required
                      />
                    </label>
                    <label>
                      Specific manual handoff facts
                      <textarea
                        name="note"
                        minLength={12}
                        maxLength={800}
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Attest to externally performed manual handoff
                    </button>
                  </form>
                ) : (
                  <p>
                    Receipt entry unavailable until separate sign-off is ready
                    and exceptions cleared.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
