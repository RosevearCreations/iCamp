# iCamp Build 093 — Office Financing Application Intake

## Delivered

1. Restricted staff-only financing interest against one existing, open Build 092 permanent-unit sale case at an active campground. One intake per sale case. Requested CAD amount recorded in exact cents, together with a private CRM contact reference and explicit, source-linked applicant consent attestation.
2. Append-only statuses for four required evidence categories: identity/consent, secure income-document receipt, unit sale terms, and disclosures. The app stores **source references only**, not documents or private financial contents.
3. Separate independent completeness triage: complete for external review, return incomplete, or withdrawn. The opener and every evidence author are excluded from review; all four latest document statuses must be received for completeness. No approval can happen after a sale closes.
4. FORCE RLS, `icamp_app`-only insert/read, campground-scoped transfer permissions, immutable records, no direct Data API grants. Dedicated Web/PWA screen and contextual ⓘ help.

## Firm limits

- No SIN, bank account, raw salary, credit report, risk score, credit pull, approval, interest rate, lender submission, signed loan, money movement, ownership transfer, or automatic sale closure.
- Contact records and sensitive files must stay in independently approved, access-controlled systems. Reference text is visible to transfer-authorized staff; enter opaque source IDs only.
- Web/PWA staff intake only. SMS/IVR/DTMF can request staff follow-up but cannot take documents or decide financing. Synthetic Camp Rosevear may demonstrate references without submitting to real lenders.
- External office-lending compliance, application retention/deletion and lender integration require separate approved builds before real applicant data is onboarded.

## Verification

- Migration `0125_permanent_unit_financing_intake.sql`, verifier `0125_permanent_unit_financing_intake.sql`, local verification suite and database security advisor.
- Promote via feature → `dev` → `main` after CI gates are green.

## Next

Build 094 — Financing Terms & Independent Offer Authorization (design/controls before any live offers).
