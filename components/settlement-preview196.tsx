"use client";

import { useMemo, useState } from "react";

import {
  compareSettlementRows,
  parseSettlementCsv,
  type SettlementRow,
} from "@/lib/finance-close/core.mjs";

import styles from "@/app/workspaces/management/command/finance-close/finance-close.module.css";

export function SettlementPreview196({
  expected,
  incomplete,
}: Readonly<{ expected: SettlementRow[]; incomplete: boolean }>) {
  const [csv, setCsv] = useState("");
  const preview = useMemo(() => {
    if (!csv.trim()) return { comparisons: [], error: null };
    try {
      const parsed = parseSettlementCsv(csv);
      return {
        comparisons: compareSettlementRows(parsed, expected),
        error: null,
      };
    } catch (error) {
      return {
        comparisons: [],
        error:
          error instanceof Error
            ? error.message
            : "Could not parse settlement CSV.",
      };
    }
  }, [csv, expected]);

  return (
    <div className={styles.preview}>
      <p>
        Paste a provider-neutral CSV with columns{" "}
        <code>
          provider,provider_reference,currency,captured_cents,refunded_cents
        </code>
        . Comparisons happen in this browser only. Nothing is uploaded, saved,
        settled or paid.
      </p>
      <label htmlFor="settlement-csv-196">
        Settlement rows (up to 200; values in cents)
      </label>
      <textarea
        id="settlement-csv-196"
        rows={5}
        spellCheck={false}
        maxLength={80000}
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        placeholder={
          "provider,provider_reference,currency,captured_cents,refunded_cents\nmock,REFERENCE123,CAD,2500,0"
        }
      />
      {incomplete ? (
        <p role="alert" className={styles.warning}>
          Source rows are capped; unmatched/missing comparisons cannot prove
          full settlement.
        </p>
      ) : null}
      {preview.error ? (
        <p role="alert" className={styles.warning}>
          {preview.error}
        </p>
      ) : null}
      {preview.comparisons.length ? (
        <div className={styles.tableScroll}>
          <table>
            <caption>
              Non-binding settlement comparison; no financial changes
            </caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Reference</th>
                <th scope="col">Currency</th>
                <th scope="col">Imported captured</th>
                <th scope="col">Imported refund</th>
                <th scope="col">Status & evidence</th>
              </tr>
            </thead>
            <tbody>
              {preview.comparisons.map((row, index) => (
                <tr key={`${row.providerReference}-${index}`}>
                  <td>{row.provider}</td>
                  <td>{row.providerReference}</td>
                  <td>{row.currencyCode}</td>
                  <td>{row.capturedCents}</td>
                  <td>{row.refundedCents}</td>
                  <td>
                    {row.status}: {row.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
