import { createHash, createPublicKey, verify } from "node:crypto";

import {
  compareAccountingRows259,
  parseAccountingCsv259,
} from "../finance-reconciliation259/core.mjs";
import { compareSettlementRows, localDay } from "../finance-close/core.mjs";

const HEX64 = /^[a-f0-9]{64}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const KEY = /^[a-z][a-z0-9_-]{1,63}$/u;
const REFERENCE = /^[A-Za-z0-9:_./-]{1,240}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function validCents(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2_000_000_000;
}

export function digest260(input) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function parseTaxInvoiceCsv260(csv) {
  if (typeof csv !== "string" || csv.length > 50_000)
    throw new Error("Tax invoice CSV must be under 50 KB.");
  const lines = csv.trim().split(/\r?\n/u);
  const header =
    "invoice_number,currency,taxable_base_cents,hst_cents,non_taxable_cents,security_deposit_cents,total_payable_cents";
  if (lines.shift()?.trim().toLowerCase() !== header)
    throw new Error("Tax invoice CSV header does not match the documented format.");
  if (lines.length > 500) throw new Error("Maximum 500 tax invoice rows.");
  const seen = new Set();
  return lines.filter(Boolean).map((line) => {
    const fields = line.split(",").map((value) => value.trim());
    if (
      fields.length !== 7 ||
      !/^INV-[A-Z0-9]{8,24}$/u.test(fields[0]) ||
      !CURRENCY.test(fields[1]) ||
      !fields.slice(2).every((value) => /^\d{1,10}$/u.test(value))
    )
      throw new Error("Invalid tax invoice CSV row.");
    const [invoiceNumber, currencyCode] = fields;
    if (seen.has(invoiceNumber))
      throw new Error("Duplicate invoice in tax evidence.");
    seen.add(invoiceNumber);
    const amounts = fields.slice(2).map(Number);
    if (!amounts.every(validCents))
      throw new Error("Tax invoice cents are outside the valid range.");
    const [taxableBaseCents, hstCents, nonTaxableCents, securityDepositCents, totalPayableCents] = amounts;
    if (
      taxableBaseCents + hstCents + nonTaxableCents + securityDepositCents !==
      totalPayableCents
    )
      throw new Error("Tax base, HST, non-taxable items and security deposit do not total the invoice.");
    return {
      invoiceNumber, currencyCode, taxableBaseCents, hstCents,
      nonTaxableCents, securityDepositCents, totalPayableCents,
    };
  });
}

export function compareTaxInvoices260(imported, invoices) {
  const expected = new Map(invoices.map((row) => [row.invoiceNumber, row]));
  if (expected.size !== invoices.length)
    throw new Error("Duplicate invoice source rows must be investigated.");
  const seen = new Set();
  const outcomes = imported.map((row) => {
    const invoice = expected.get(row.invoiceNumber);
    seen.add(row.invoiceNumber);
    if (!invoice) return { invoiceNumber: row.invoiceNumber, status: "unmatched" };
    const match =
      invoice.currencyCode === row.currencyCode &&
      invoice.reservationAmountCents ===
        row.taxableBaseCents + row.hstCents + row.nonTaxableCents &&
      invoice.securityDepositCents === row.securityDepositCents &&
      invoice.totalPayableCents === row.totalPayableCents;
    return { invoiceNumber: row.invoiceNumber, status: match ? "matched" : "variance" };
  });
  for (const invoice of invoices)
    if (!seen.has(invoice.invoiceNumber))
      outcomes.push({ invoiceNumber: invoice.invoiceNumber, status: "missing" });
  return outcomes;
}

export function verifyProviderPacket260(raw, {
  campgroundId, localDate, expected, provider,
  keyId, publicKeyPem, now = new Date(),
}) {
  if (typeof raw !== "string" || raw.length > 90_000)
    throw new Error("Signed provider evidence must be under 90 KB.");
  if (!publicKeyPem || !keyId || !provider || provider === "mock")
    throw new Error("HOLD: external provider signer is not independently enrolled.");
  let envelope;
  try { envelope = JSON.parse(raw); } catch {
    throw new Error("Signed provider evidence must be JSON.");
  }
  const { payload, signatureBase64 } = envelope ?? {};
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Missing signed provider payload.");
  if (
    payload.schema !== "icamp.provider-settlement.v1" ||
    payload.campgroundId !== campgroundId ||
    payload.localDate !== localDate ||
    payload.provider !== provider ||
    payload.keyId !== keyId ||
    !DATE.test(payload.localDate) ||
    typeof payload.statementId !== "string" ||
    !REFERENCE.test(payload.statementId) ||
    typeof payload.issuedAt !== "string" ||
    !Array.isArray(payload.rows) ||
    !payload.rows.length || payload.rows.length > 200
  )
    throw new Error("Signed provider document has invalid identity, scope or rows.");
  const issued = new Date(payload.issuedAt);
  if (
    Number.isNaN(issued.valueOf()) ||
    issued.toISOString() !== payload.issuedAt ||
    issued.valueOf() > now.valueOf() + 60_000 ||
    issued.valueOf() < now.valueOf() - 31 * 86400_000 ||
    issued.valueOf() < Date.parse(localDate + "T00:00:00Z") - 86400_000
  )
    throw new Error("Provider statement is stale, future-dated or outside the selected close period.");
  const seen = new Set();
  for (const row of payload.rows) {
    if (
      !row || row.provider !== provider || !KEY.test(row.provider) ||
      !REFERENCE.test(row.providerReference) ||
      !CURRENCY.test(row.currencyCode) ||
      !validCents(row.capturedCents) ||
      !validCents(row.refundedCents)
    )
      throw new Error("Signed provider row contains invalid source details.");
    const token = JSON.stringify([row.provider, row.currencyCode, row.providerReference]);
    if (seen.has(token)) throw new Error("Duplicate signed provider reference.");
    seen.add(token);
  }
  if (
    typeof signatureBase64 !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(signatureBase64) ||
    signatureBase64.length > 200
  )
    throw new Error("Provider signature is missing or invalid.");
  let authentic = false;
  try {
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519")
      throw new Error("Ed25519 provider key required.");
    authentic = verify(
      null,
      Buffer.from(JSON.stringify(payload)),
      key,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    throw new Error("Provider signature verification failed.");
  }
  if (!authentic) throw new Error("Provider signature verification failed.");
  if (!expected.length)
    throw new Error("No authoritative provider source rows to reconcile.");
  if (expected.some((row) => row.provider !== provider))
    throw new Error("Mixed or sandbox provider references block close approval.");
  const comparisons = compareSettlementRows(payload.rows, expected);
  if (comparisons.some((row) => row.status !== "matched"))
    throw new Error("Signed provider statement differs from original payment/refund sources.");
  return {
    signerKeyId: keyId,
    statementId: payload.statementId,
    rowCount: payload.rows.length,
    payloadDigest: digest260(payload),
    status: "ENROLLED_SIGNER_MATCHED_NOT_BANK_PROOF",
  };
}

export function evaluateClose260({
  snapshot, signedProviderJson, taxInvoiceCsv, accountingCsv, signer,
  now = new Date(),
}) {
  const blockers = [];
  const reconciliation = snapshot.reconciliation;
  if (
    reconciliation.incomplete ||
    reconciliation.internalReviewStatus !== "SOURCE_CHECKS_CLEAR" ||
    reconciliation.findings.length > 0 ||
    Object.values(snapshot.source.truncated ?? {}).some(Boolean)
  ) blockers.push("Internal finance evidence is incomplete or has exceptions.");
  const scopedInvoices = snapshot.invoices.filter(
    (row) => localDay(row.issuedAt, snapshot.source.timezone) === snapshot.source.localDate,
  );
  let taxComparison = [];
  let taxRows = [];
  try {
    taxRows = parseTaxInvoiceCsv260(taxInvoiceCsv);
    taxComparison = compareTaxInvoices260(taxRows, scopedInvoices);
    if (!scopedInvoices.length || taxComparison.some((row) => row.status !== "matched"))
      blockers.push("Independent invoice/HST export is missing or does not match every dated invoice.");
  } catch (error) {
    blockers.push("Invoice/HST evidence: " + String(error instanceof Error ? error.message : error));
  }
  let accountingRows = [];
  let accountingComparison = [];
  try {
    accountingRows = parseAccountingCsv259(accountingCsv);
    accountingComparison = compareAccountingRows259(
      accountingRows, reconciliation.accountingExpected,
    );
    if (
      !accountingRows.length ||
      !reconciliation.accountingExpected.length ||
      accountingComparison.some((row) => row.status !== "matched")
    ) blockers.push("Accounting export does not match every source currency and amount.");
  } catch (error) {
    blockers.push("Accounting evidence: " + String(error instanceof Error ? error.message : error));
  }
  let settlement = null;
  try {
    settlement = verifyProviderPacket260(signedProviderJson, {
      campgroundId: snapshot.source.campgroundId,
      localDate: snapshot.source.localDate,
      expected: snapshot.settlementExpected,
      ...signer,
      now,
    });
  } catch (error) {
    blockers.push("Provider evidence: " + String(error instanceof Error ? error.message : error));
  }
  const sourceDigest = digest260({
    source: snapshot.source,
    financeReview: snapshot.financeReview,
    reconciliation: snapshot.reconciliation,
    invoices: snapshot.invoices,
    schedules: snapshot.schedules,
  });
  const taxDigest = digest260(taxRows);
  const accountingDigest = digest260(accountingRows);
  const settlementDigest = settlement?.payloadDigest ?? null;
  const closePackageDigest = blockers.length === 0
    ? digest260({
        build: 260, sourceDigest, taxDigest, accountingDigest, settlementDigest,
        campgroundId: snapshot.source.campgroundId,
        localDate: snapshot.source.localDate,
      })
    : null;
  return {
    status: blockers.length ? "HOLD" : "READY_FOR_OWNER_NONPOSTING_DECISION",
    blockers,
    invoiceCount: scopedInvoices.length,
    taxComparison,
    accountingComparison,
    settlement,
    sourceDigest,
    taxDigest,
    accountingDigest,
    settlementDigest,
    closePackageDigest,
    // HST source arithmetic is NOT a legal tax classification review.
    disclaimer:
      "Owner approval attests this inspected evidence packet only. No bank settlement, HST filing, journal, tax advice or statutory book close occurs.",
  };
}

export function validatedApproval260(decision, reason, report) {
  if (decision !== "approve") throw new Error("An explicit owner approval is required.");
  if (
    report.status !== "READY_FOR_OWNER_NONPOSTING_DECISION" ||
    !HEX64.test(report.closePackageDigest ?? "")
  ) throw new Error("Owner approval is HOLD until every independent evidence gate passes.");
  const note = String(reason ?? "").trim();
  if (note.length < 20 || note.length > 700)
    throw new Error("Owner approval requires a 20–700 character evidence explanation.");
  return { note, closePackageDigest: report.closePackageDigest };
}
