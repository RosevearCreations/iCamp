# Build 113 — Reopen Review Owner Action Plans & Independent Hold Resolution

- Dual-campground authorized owners record append-only, time-bounded action plans against the latest Build 112 hold/reopen recommendation; action owner must differ from the independent exception reviewer.
- Another owner independently records continued hold or verified resolution, with a source evidence reference, frozen exception counts and an immutable rationale.
- The database serializes against Build 109 review changes, rejects stale review/plan/decision/reassessment/outcome evidence and rechecks current independently unclosed source cases. Reopened cases must be independently accepted before a hold can be resolved.
- History is protected by forced directed-pair RLS and server-only `icamp_app` select/insert permissions; no updates, public table access or definer bypass.
- Web/PWA staff controls only; IVR/DTMF and SMS/MMS intentionally perform no sensitive audit actions. No automatic applicant, payment, lending, transfer, retention, case or notification changes.
- Required gates: full `npm run verify`, database migrations 0141–0144 in order, SQL verification and all remote CI/deployment checks.

Next expected: **Build 114 — Hold Resolution Follow-Up Aging & Independent Recurrence Oversight**.
