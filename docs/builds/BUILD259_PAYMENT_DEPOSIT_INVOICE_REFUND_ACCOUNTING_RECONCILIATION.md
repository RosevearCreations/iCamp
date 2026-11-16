# iCamp Build 259 — Payment, Deposit, Invoice, Refund & Accounting Reconciliation Controls

## Scope

Add a property-scoped, staff-only reconciliation page at
`/workspaces/management/command/finance-reconciliation`. It builds on the
existing Build 042 payment schedules, Build 043 invoices/receipts, Build 045
refund safeguards and Build 196 source-grounded finance close. No new
payment-provider credentials, financial-write privileges, database migrations,
scheduled jobs, or cross-application release dependency are introduced.

## Controls and important limitations

- Enforce staff session and BOTH finance and reservation-read access.
- Use original tenant-scoped RLS source queries; enforce 500-row source caps and
  mark incomplete evidence HOLD rather than infer missing records.
- Compare original invoice total, currency and security-deposit breakdown with
  the reservation payment schedule.
- Surface missing invoices, receipt mismatch, failed/pending refunds,
  unverified provider references, deposit coverage gaps and possible overcapture.
- Keep CAD and any other currencies separated; use integer cents only.
- A deposit "covered" classification means recorded captures in the bounded
  evidence window reached the deposit amount. It is **not** an allocation
  statement and does not prove clearing or bank settlement.
- Compare a pasted provider statement using the existing Build 196 local CSV
  preview. Compare a pasted accounting export locally with the Build 259
  amount-only preview; neither payload is uploaded or saved.
- Never automatically capture, refund, issue a tax invoice, transfer funds,
  journal, reconcile a bank, close books, or mark independent evidence VERIFIED.
- The owner/checker must separately verify provider settlement, accounting
  register/HST treatment and close authority. Existing production database
  migration provenance and original-host authority holds remain independent.
- Source queries are intentionally non-atomic across Build 196 and Build 259
  reads; changes during an inspection require a fresh review. This report
  cannot serve as a signed immutable accounting snapshot.

## Verification

`npm test` includes Build 259 source, mismatch, truncation and import-negative
tests. Protected PR Verify/Browser/Database/CodeQL/secret scan and the Vercel
production commit should be checked against the exact promoted SHA.
