# iCamp Build 266 — Support SLA and telemetry acceptance

## Implemented source scope
- Severity-specific **provisional response targets**: critical 1 hour, priority 8 hours, routine 48 hours, measured on the original campground support case `created_at` and `reviewed_at` records.
- Unresolved cases are flagged overdue only when the original timestamp exceeds the target and a valid review timestamp has not been observed. Invalid, future, missing timestamps remain unknown.
- MFA Sysop page displays aggregate observed queue and overdue first-review counts, not sensitive tenant names, narratives, identities, or personal data.
- Observed case telemetry is a support-queue signal **not real tenant request traffic**, site latency, P95, gateway failures or usage analytics.

## Required before production GREEN
- Verify original production DB migration 0241 and independently corroborate 0242 if introduced.
- Verify GitHub CI, protected dev and main commits, and exact SHA Vercel READY in the original production environment.
- Enroll authenticated telemetry provider with tenant-level consent and scope. Do not claim traffic/latency metrics until original measurements exist.
- Dedicated persistent case ownership, role-restricted Sysop reply/assignment actions, actual paging and SLA escalation remain outstanding. Targets here are monitoring criteria, not staffed service guarantees.
- Preserve separation of campground application, iCamp Sysop and external provider activation; no gate, bank, host reboot or messaging permissions from this build.

## Acceptance
Run `node --test tests/build266-sla.test.mjs`; run repository verify and production migration acceptance. Do not label production GREEN until independent evidence is verified.
