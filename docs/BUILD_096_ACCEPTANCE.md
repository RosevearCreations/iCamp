# Build 096 — Manual Delivery Evidence Receipt, Applicant Acknowledgement & Exception Holds

## Scope and business boundary

- Build 095 consent and approved manual handoff sign-off are prerequisites for staff recording **externally performed** handoff evidence. Record the timestamp, matching permitted channel, restricted delivery reference, separate recipient verification reference, and contextual note.
- An independently recorded applicant response is limited to `receipt_confirmed`, `receipt_disputed`, or `no_response`, referencing a separately retained source. It is **not** agreement acceptance, electronic signature, legal service proof or finance approval.
- Exception holds may be entered before or after a handoff. A current hold blocks recording a new handoff and any affirmative receipt confirmation. Only a different staff actor may clear a hold with source-linked evidence, and prior events remain readable and immutable.
- No real transmission, notifications, finance disbursement, contract execution, ownership transfer or payment is performed. The operator must ensure the actual external process and documentation satisfy applicable law and campground policy.

## Verification

1. Run `npm run verify`, including `tests/build096-manual-delivery.test.mjs` and Next production build.
2. Apply `0128_permanent_unit_manual_delivery_evidence.sql` to the intended iCamp Supabase project, then execute `database/verify/0128_permanent_unit_manual_delivery_evidence.sql`.
3. Confirm RLS is forced, Data API roles have no direct privileges, and immutable append-only triggers are attached. Query Supabase Security Advisor.
4. With synthetic users in Camp Rosevear, test that absent/held Build 095 signoff, mismatched recipient channel, a different campground, an active hold, duplicate receipts and same-operator applicant response all fail. Check that the hold creator cannot clear their own hold.
5. Independently test a matching manually documented receipt with separate operator, followed by a source-backed receipt confirmation. Retain no real applicant documents in test fixtures.
6. Verify `dev`, `main` and final commit check runs all GREEN before claiming production source promotion. Hosted application runtime deployment must be verified separately.

## Operator notes

Visit Management → Permanent units → Financing consent and disclosures → Build 096 receipts. Source references must not contain SINs, bank details or borrower files. After any dispute, put an exception hold in place until a separate operator documents the resolution.
