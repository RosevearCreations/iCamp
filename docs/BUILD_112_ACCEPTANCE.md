# Build 112 — Independent Acceptance Exception Monitoring & Evidence Reopen Review

## Owner-visible delivery

- New private Web/PWA workbench shows a bounded list of Build 111 accepted evidence and later exception counts.
- Independently authorized owners can append monitoring, exception-hold or evidence-reopen recommendation reviews, each with an evidence reference and rationale.
- Database rechecks accepted source, current review/decision/reassessment/outcome chain, live unresolved and later source-case counts under the existing Build 109 advisory lock. It rejects unsupported reopen recommendations and cannot silently mark a drifted acceptance as healthy.
- Reviewers must differ from the prior reassessor, outcome author and acceptance auditor.
- Forced directed-pair owner RLS, append-only records, server-only database operations, no anonymous/service-role table access and strict input validation.
- No source receipt, case, closure acceptance, financing applicant, payment, transfer, retention object, phone/SMS or notification is mutated. IVR/DTMF and SMS/MMS have a documented **safe no-action fallback** because these audit decisions require private Web/PWA staff authorization.

## Verification gates

- `npm run verify`, SQL migration `0143_owner_acceptance_exception_reopen.sql`, SQL verification and database provider security checks.
- Validate clean monitoring, later exceptions, independently accepted source-case changes, stale audit chain, same-actor forgery, cross-pair forgery, immutable history and bounded-list warnings.
- Only promote after Build 110 and Build 111 prerequisite migrations and their independent release gates pass.

Next expected: **Build 113 — Reopen Review Owner Action Plans & Independent Hold Resolution**.
