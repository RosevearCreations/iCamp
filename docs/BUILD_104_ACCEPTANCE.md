# iCamp Build 104 — Owner Handoff Resolution Reassessment & Independent Review Acceptance

## Operator delivery

- The Build 103 owner outcomes screen links to a dedicated independent review workspace.
- For each existing Build 103 administrative handoff resolution, an active, separately authorized owner records immutable reassessment evidence: `resolution_supported`, `additional_evidence_needed`, or `resolution_requires_revisit`.
- Non-supporting reassessments must include a manual next-review date within 90 days; supported reassessments must not invent another open deadline.
- A separate owner can accept only the latest supported reassessment. Exactly one acceptance is recorded for each resolution; acceptance retains its own evidence reference and note.
- Reviewer must differ from the original resolution actor. Acceptor must differ from the latest independent reviewer. Two-person control works when the original resolver later acknowledges the independent review.

## Database & security

- Migration `0135_owner_handoff_resolution_review.sql` introduces separate append-only reassessment and acceptance tables. It derives both organizations and both campgrounds from the source resolution, not hidden form inputs.
- Active `owner_admin` plus `permanent_unit.transfer` permission is independently required on both source and target properties for all reads and inserts; enforced again by forced row-level security with the `icamp_app` role.
- A per-resolution transaction advisory lock serializes reassessment/acceptance races; latest-reviewed evidence and reviewer separation are checked inside database triggers.
- The public and Supabase client roles have no direct read/write grants. No UPDATE/DELETE grants exist, and immutable triggers protect both records.
- Evidence is internal coordination context only. Do not record applicant names, contact information, financial identifiers, financing decisions, documents or lending-risk predictions.
- Neither action changes applicant or unit status, clears exception holds, sends messages, moves cases, creates work automatically or issues offers.

## Release acceptance

1. `npm run verify` passes formatter, lint, type-check, all test files (including Build 104) and production compilation.
2. Feature checks including migration verification and re-application, browser end-to-end, CodeQL and Gitleaks all complete successfully against the feature SHA.
3. The hosted iCamp Supabase project receives migration `0135` once, only after feature migrations pass. A read-only query confirms both tables, forced RLS and restricted grants; the Supabase security adviser reports no findings.
4. Feature PR merges into `dev`, promotion PR merges into `main` only after all promotion gates pass, and all final protected-`main` commit checks are GREEN.
5. GitHub production-branch GREEN is not an assertion of a separate live-hosting smoke test; runtime verification must be reported independently if performed.

Next queued Build 105: Cross-Campground Owner Resolution Evidence Search & Export Acceptance.
