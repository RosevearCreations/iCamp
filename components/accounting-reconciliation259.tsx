"use client";

import { useMemo, useState } from "react";

import {
  compareAccountingRows259,
  parseAccountingCsv259,
  type AccountingRow259,
} from "@/lib/finance-reconciliation259/core.mjs";

import styles from "@/app/workspaces/management/command/finance-close/finance-close.module.css";

export function AccountingReconciliation259({
  expected,
  incomplete,
}: Readonly<{ expected: AccountingRow259[]; incomplete: boolean }>) {
  const [csv, setCsv] = useState("");
  const result = useMemo(() => {
    if (!csv.trim()) return { comparisons: [], error: null };
    try {
      const rows = parseAccountingCsv259(csv);
      return {
        comparisons: compareAccountingRows259(rows, expected),
        error: null,
      };
    } catch (error) {
      return {
        comparisons: [],
        error:
          error instanceof Error ? error.message : "Invalid accounting CSV.",
      };
    }
  }, [csv, expected]);
  return (
    <div className={styles.preview}>
      <p>
        Paste an independently exported ledger for the selected campground day.
        Compare in this browser only. This does not upload, certify, journal,
        settle, or post financial data.
      </p>
      <label htmlFor="accounting-reconciliation259">
        CSV columns:
        currency,net_recorded_cents,invoices_issued_cents,succeeded_refunds_cents
      </label>
      <textarea
        id="accounting-reconciliation259"
        rows={5}
        maxLength={12000}
        spellCheck={false}
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        placeholder={
          "currency,net_recorded_cents,invoices_issued_cents,succeeded_refunds_cents\nCAD,0,0,0"
        }
      />
      {incomplete ? (
        <p className={styles.warning} role="alert">
          Source evidence is incomplete. Do not use this comparison to close the
          books.
        </p>
      ) : null}
      {result.error ? (
        <p className={styles.warning} role="alert">
          {result.error}
        </p>
      ) : null}
      {result.comparisons.length ? (
        <div className={styles.tableScroll}>
          <table>
            <caption>Local non-posting accounting comparison</caption>
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col">Net recorded (cents)</th>
                <th scope="col">Issued invoices (cents)</th>
                <th scope="col">Refunds (cents)</th>
                <th scope="col">Comparison</th>
              </tr>
            </thead>
            <tbody>
              {result.comparisons.map((row) => (
                <tr key={row.currencyCode}>
                  <td>{row.currencyCode}</td>
                  <td>{row.netRecordedCents}</td>
                  <td>{row.invoicesIssuedCents}</td>
                  <td>{row.succeededRefundsCents}</td>
                  <td>
                    <strong>{row.status}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {result.comparisons.length > 0 &&
      result.comparisons.every((row) => row.status === "matched") ? (
        <p className={styles.note}>
          Local numbers agree with the pasted rows. Independent settlement,
          source provenance, HST treatment and owner close approval remain
          unverified.
        </p>
      ) : null}
    </div>
  );
}
