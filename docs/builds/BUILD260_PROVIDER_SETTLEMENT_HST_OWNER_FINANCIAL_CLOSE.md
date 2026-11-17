# iCamp Build 260 — Signed Settlement Evidence, HST/Invoice Checks & Owner Non-Posting Close

## Purpose
Extend Build 259 with a **fail-closed** review of an independently signed provider
settlement statement, original invoice/HST arithmetic, exported accounting amounts,
and an owner-only, non-posting approval of the exact reviewed evidence packet.

## Verification boundary
- **No external provider is live by default**. The current provider adapter is
  sandbox-only. Neither pasted CSV, operator text, nor a self-asserted VERIFIED
  label proves clearing. A genuine external provider must explicitly enrol an
  independent Ed25519 signing key, pinned via server-only environment values:
  ICAMP_SETTLEMENT260_PROVIDER, ICAMP_SETTLEMENT260_KEY_ID, and
  ICAMP_SETTLEMENT260_PUBLIC_KEY_PEM. Do NOT manufacture a provider signing key
  or substitute a team-owned key as proof that a provider settled funds.
- Provider JSON envelope: {payload,signatureBase64}, with payload fields
  schema="icamp.provider-settlement.v1", campgroundId, localDate (YYYY-MM-DD),
  provider, keyId, statementId, issuedAt (UTC ISO), rows. Each row has
  provider, providerReference, currencyCode, capturedCents, refundedCents.
  Signature covers UTF-8 JSON.stringify(payload), generated and signed by
  the enrolled independent issuer. Key rotation requires explicit re-enrolment.
- The signed statement must match every original Build 196 provider reference and
  amount. Missing entries, duplicates, sandbox references, stale/future or
  cross-property documents fail closed. An authentic signer plus matching rows
  is **not** bank clearing confirmation.
- Tax CSV header:
  invoice_number,currency,taxable_base_cents,hst_cents,non_taxable_cents,security_deposit_cents,total_payable_cents
  Each original dated invoice must match both cents and currency.
  The CSV is a separately obtained export. Arithmetic cannot determine what
  is legally taxable, whether HST was collected, or whether tax is filed.
  Ontario's rate or taxability is NOT inferred from the invoice total.
- Accounting CSV reuses Build 259 exact currency-by-currency cents comparison.
  No automatic cross-currency aggregation or data guessing.
- The owner-only approval record is immutable, tenant RLS-scoped, and stores
  the hashes of the exact observed sources and evidence, NOT raw provider
  payloads/customer records. Any later changed source requires new review.
  The request is authenticated, checked again server-side, subject to a genuine
  current owner-authority database guard, and separately audited.
- Owner approval signifies **reviewed evidence packet only**, never posting,
  charge, refund, tax certification, bank settlement or legal book close.
  Production DB migration / independently enrolled external source remain
  separate deployment-time prerequisites. While absent, the UI stays HOLD.

## Verification
Run npm test, npm run lint, npm run typecheck and npm run build. Apply migration
0238 through the approved database-migration process and execute its verify
script with genuine production provenance before activating owner close approvals.
Never simulate provider proof, original-host authority, DB migrations or close.
