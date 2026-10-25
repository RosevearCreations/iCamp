# iCamp Build 103 — Owner Planning Follow-Up Outcomes & Cross-Campground Resolution Evidence

## Delivered scope

- Owner-only follow-up outcomes for an existing Build 102 owner-to-owner planning handoff: coordination in progress, additional owner review needed, target review completed, or unable to proceed.
- Source-plan-linked, immutable outcome notes and evidence references; ongoing outcomes have a next action within 90 days, terminal outcomes cannot have an additional next action.
- One immutable administrative planning resolution for each handoff, explicitly citing the **latest terminal** outcome: owner coordination complete, close planning unresolved, or recommend a new plan. A per-plan transaction advisory lock guards outcome/resolution races.
- Dedicated owner outcome and resolution workspace, campground selection, status history, bounded-coverage notice and contextual ⓘ help. Navigation originates from the Build 102 owner planning screen.
- Both source and destination campgrounds independently require a current `owner_admin` assignment plus `permanent_unit.transfer` permission, for reads and writes in the server as well as forced-RLS `icamp_app` policies.

## Privacy and side-effect boundaries

- Outcomes and resolutions are internal planning evidence, never applicant credit scores, financing decisions, offers, delivery acknowledgements, delivery exception releases or legal/compliance determinations.
- No automatic inter-campground applicant transfer, messaging, task creation, finance ledger mutation or new handoff creation occurs.
- Evidence-reference and note validation prohibit obvious direct contact and financial identifiers; operators must use internal document references and synthetic Camp Rosevear data when trialling. Do not copy applicant data into planning evidence.
- No UPDATE or DELETE grants; append-only SQL triggers and unique resolution constraint.
- Portfolio and evidence history queries are deliberately bounded. A missing older record in a truncated view is **not** evidence of absence.

## Acceptance gates

1. Run `npm run verify` (Prettier, ESLint, TypeScript, unit and Next production build). The Build 103 test file exercises the shared normalization, outcome eligibility, latest-first mapping, read/write authorization structure and migration/verification safeguards.
2. Feature PR to `dev`: all required GitHub checks GREEN, including PostgreSQL migration verification, browser e2e, CodeQL and secret scanning.
3. Apply `0134_owner_handoff_outcomes_resolution.sql` once to the hosted iCamp Supabase project, after successful feature migration CI. Verify forced RLS, restricted privileges, both tables and security advisor state.
4. Merge feature into `dev`; promote `dev` into `main` only when promotion checks are GREEN. Independently verify final `main` SHA and all production-branch checks GREEN.
5. A GREEN GitHub production branch is a source/CI promotion signal. It is not a claim that separate runtime hosting or finance workflows were live-tested unless independent deployment evidence is available.

Next planned Build 104: Owner Handoff Resolution Reassessment & Independent Review Acceptance.
