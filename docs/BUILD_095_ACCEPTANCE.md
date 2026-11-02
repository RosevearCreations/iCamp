# iCamp Build 095 — Applicant Offer Delivery Consent, Versioned Disclosures & Manual Sign-Off Boundary

## Delivered

1. Private disclosure-version registry identifies the applicable jurisdiction, unique version code, approved restricted document reference, SHA-256 digest, and external legal-review source. A different authorized operator independently accepts the exact immutable version for internal use or rejects it.
2. Staff can attest applicant-specific consent for supervised in-person or verified secure-portal coordination only after Build 094 authorizes **internal preparation** and the disclosure version has passed independent internal review. The exact version and intended recipient reference are pinned. One consent per proposal; records are immutable.
3. A separate authorized operator records one decision per consent: `ready_for_manual_handoff` or `held`. Readiness requires an active campground and sale not already handed off. Review separation from intake opener, terms drafter, terms reviewer and consent recorder is enforced in database triggers.
4. Four append-only campground-scoped tables use FORCE RLS; no grants to Data API roles, private staff Web/PWA screen, accessible contextual ⓘ help, SQL verification and synthetic-only tests.

## Firm limits

- A manually approved coordination task is **not** loan approval, proof of applicant receipt, acknowledgement, signature, acceptance, contract formation, publication, financing transfer, payment, occupancy change or legal compliance determination.
- SHA-256 pins the supplied source identity only. It does not certify the legal sufficiency, timeliness, accessibility or accuracy of the disclosure; qualified professionals must review actual documents and applicable laws.
- No SMS, IVR, DTMF, email, secure-portal transmission, e-signature or delivery provider is invoked. Any eventual real delivery requires independently authorized channels, consent, audit and evidence gates.
- Store only opaque restricted IDs; never enter SIN, bank information, credit scores or full applicant contact data. Camp Rosevear synthetic examples are not real lender cases.

## Verification and next

- Migration `0127_permanent_unit_offer_delivery_boundary.sql` and matching verifier, unit tests, full Next application build, hosted Supabase security advisor and feature → `dev` → `main` CI.
- Next queued: **Build 096 — Manual Delivery Evidence Receipt, Applicant Acknowledgement & Exception Holds** (no automatic legal acceptance).
