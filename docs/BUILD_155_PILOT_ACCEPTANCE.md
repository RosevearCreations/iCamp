# Build 155 — Pilot Operational Acceptance & Remediation (dev only)

The `/pilot/acceptance` worksheet separates six owner-reported operational checks: front desk, maintenance, security/access, booking, POS and real device/browser compatibility. It exports an allowlisted, sanitized local JSON packet with counts and cannot promote a reported pass into independent verification or authorize public launch.

Camp Rosevear remains an inactive synthetic fixture. No live device, payment or browser result was collected as part of this implementation. Every failed or blocked area requires a tracked defect, retest and independent acceptance. Production operations and the Comms Hub integration remain held separately.

This build is intended for `dev` only. No merge to `main` or production deployment is authorized.
