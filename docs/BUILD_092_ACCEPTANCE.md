# iCamp Build 092 — Permanent Unit Sale/Transfer Workflow

## Delivery

1. Staff open a buyer application case only against a Build 091 approved seller listing and matching private buyer inquiry. The seller ownership event, accommodation and campground are pinned. A buyer inquiry cannot be reused for another sale case.
2. Append-only, source-linked evidence covers six closing domains: buyer application, unit condition/safety inspection, external fee receipt with exact CAD amount, sale documents, closing checklist and replacement occupancy-agreement evidence. Latest result in every domain must be a pass.
3. An authorized independent reviewer either rejects or approves. Approval is prohibited for the opener, any evidence author, incomplete/defective cases, stale seller ownership or inactive properties. Decision is immutable.
4. A separate third authorized operator records the approved unit-owner handoff, requiring signed closing and agreement references. The new owner ledger event and closing receipt are written atomically or neither is retained. Duplicate closing is barred.
5. Dedicated campground-scoped management UI with contextual ⓘ help, private FORCE RLS and no direct Data API grants.

## Boundaries

- The application **does not** verify legal title, settle money, transfer campground land ownership, replace a canonical seasonal/yearly assignment, clear safety holds or create a booking. Those actions require their own authorized workflows and actual human/legal confirmation.
- Recorded receipts and signed-document references are operator-attested source links, not evidence of actual payment or legal entitlement without independent review.
- Inactive synthetic Camp Rosevear may serve as a sandbox for draft/evidence exercises, but must not finalize a real handoff. Approvals and finalization require active property.
- Web/PWA supports authenticated staff controls. IVR/DTMF/SMS can hand off to staff only, not originate or approve a sale.

## Verification

- Migration `0124_permanent_unit_sale_transfer.sql`, matching SQL verifier, rollback-only hosted PostgreSQL proof, migration application and Supabase Security Advisor.
- `tests/build092-permanent-unit-transfer.test.mjs` validates all required step names, fees, evidence states and normalization.
- Full local verification and feature → `dev` → `main` GitHub CI, browser, database and security gates.

## Next

Build 093 — Office Financing Application Intake, using confidential documents and strict independent boundaries; no financing is implied by Build 092.
