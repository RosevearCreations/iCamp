"use client";

import { useActionState } from "react";

import {
  initialFinanceReviewState260,
  reviewFinanceClose260Action,
} from "@/app/workspaces/management/command/finance-close260/actions";

import styles from "@/app/workspaces/management/command/finance-close/finance-close.module.css";

export function FinanceClose260Review({
  campgroundId,
  day,
  ownerCandidate,
}: Readonly<{
  campgroundId: string;
  day: string;
  ownerCandidate: boolean;
}>) {
  const [result, submit, pending] = useActionState(
    reviewFinanceClose260Action,
    initialFinanceReviewState260,
  );
  return (
    <section className="content-panel">
      <h2>Independently verified evidence and owner review</h2>
      <p>
        This form sends evidence to the authenticated iCamp server only for
        verification. The raw provider statement and tax/accounting CSVs are
        not saved to the approval ledger. Only fixed hashes and source identifiers
        are retained after an authorized decision.
      </p>
      <form action={submit} className={styles.preview}>
        <input type="hidden" name="campgroundId" value={campgroundId} />
        <input type="hidden" name="day" value={day} />
        <label htmlFor="finance260-provider">
          Provider-signed JSON envelope (enrolled signer only)
        </label>
        <textarea
          id="finance260-provider"
          name="signedProviderJson"
          rows={5}
          maxLength={90000}
          spellCheck={false}
          required
          placeholder='{"payload":{"schema":"icamp.provider-settlement.v1", "...":"..."},"signatureBase64":"..."}'
        />
        <label htmlFor="finance260-tax">
          Independent invoice/HST export (original invoice numbers, integer cents)
        </label>
        <textarea
          id="finance260-tax"
          name="taxInvoiceCsv"
          rows={5}
          maxLength={50000}
          spellCheck={false}
          required
          placeholder={
            "invoice_number,currency,taxable_base_cents,hst_cents,non_taxable_cents,security_deposit_cents,total_payable_cents"
          }
        />
        <label htmlFor="finance260-accounting">
          Accounting CSV export (source movement and invoice amounts)
        </label>
        <textarea
          id="finance260-accounting"
          name="accountingCsv"
          rows={4}
          maxLength={12000}
          spellCheck={false}
          required
          placeholder={
            "currency,net_recorded_cents,invoices_issued_cents,succeeded_refunds_cents"
          }
        />
        <label htmlFor="finance260-reason">
          Owner evidence explanation (required if approving; 20–700 characters)
        </label>
        <textarea
          id="finance260-reason"
          name="reason"
          rows={3}
          maxLength={700}
          placeholder="Describe the independent provider evidence and accountant review."
        />
        <div className="hero-actions">
          <button
            type="submit"
            className="secondary-link"
            name="decision"
            value="inspect"
            disabled={pending}
          >
            Inspect evidence (no approval)
          </button>
          {ownerCandidate ? (
            <button
              type="submit"
              className="primary-button"
              name="decision"
              value="approve"
              disabled={pending}
            >
              Owner approve evidence packet only
            </button>
          ) : null}
        </div>
      </form>
      <div aria-live="polite" role="status" className={styles.meta}>
        <p><strong>Decision status:</strong> {pending ? "Checking original sources..." : result.status}</p>
        <p><strong>Dated invoices inspected:</strong> {result.invoiceCount}</p>
        {result.statementId ? <p><strong>Signed statement:</strong> {result.statementId}</p> : null}
        {result.packageDigest ? (
          <p><strong>Evidence package SHA-256:</strong> <code>{result.packageDigest}</code></p>
        ) : null}
        {result.recordId ? (
          <p><strong>Immutable approval receipt:</strong> {result.recordId}</p>
        ) : null}
        {result.blockers.map((item, index) => (
          <p key={index} className={styles.warning}>{item}</p>
        ))}
      </div>
      <p className={styles.note}>
        A matching signed statement verifies the enrolled signer and source references,
        not arrival of funds at the bank. Taxable status, HST filings, bank
        statements, ledger journals and statutory book close still require
        independent accountant/owner controls. A different source snapshot
        invalidates the reviewed evidence hash.
      </p>
    </section>
  );
}
