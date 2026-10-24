# Build 086 — Emergency Communication & Safety Guardrails

## Delivery

- Authenticated campground management register at `/workspaces/management/campgrounds/emergency-notices` with circular contextual help.
- Explicit notice targets: **campground**, **section**, **site/accommodation**, or **assigned staff**. Exact tenant-scoped foreign keys prevent selecting another campground's section or site.
- Append-only immutable drafts, independent approvals/rejections, cancellation and separately attested manual handoffs. Staff who wrote a plan cannot approve or reject it.
- Approval requires explicit acknowledgement of the local on-site emergency plan and the **absence of emergency-services dispatch**. Authorized manual handoff after approval requires a channel and evidence reference; only active campgrounds can record actual handoffs.
- Permissions distinguish notice read/draft, high-risk broadcast approval and on-site handoff attestation. Campground manager/owner approval remains independent from staff/security drafts.
- **No emergency provider calls, SMS, IVR broadcasts, receipts, siren/gate commands, evacuation automation or automatic guest-contact selection**. Handoff evidence is operator-attested, not a confirmed delivery.

## Operator/owner acceptance required

1. Prepare a real campground emergency-services directory, posted evacuation/assembly maps, accessible alternative communication methods and staff training before use. Call emergency services directly when necessary; software cannot summon responders.
2. Draft a campground-wide, single-section, single-site and staff-audience notice with clearly named physical response steps. A second manager must approve; author self-approval must fail.
3. Check malformed targeting, another tenant's section/site, cancelled/rejected decisions, duplicate approvals and retried event IDs are rejected or idempotently re-read.
4. With an active campground and actual on-site operations, independently attest a manual announcement or sign posting with a log reference. An approved notice alone is **not sent**, does not confirm guest delivery and must not be described as dispatched.
5. On inactive **Camp Rosevear**, verify drafts may be planned without credentials or real contacts, while real-world handoff records remain blocked.
6. Review all emergency communications against jurisdictional obligations, applicable consent rules and accessibility procedures with the owner and local authorities before live use.

## Verification

- `node --test tests/build086-emergency-notices.test.mjs` checks audience validation, approval requirements, manual handoff evidence and wiring constraints.
- `database/verify/0117_emergency_communication_guardrails.sql` verifies immutable forced-RLS tables, audited permissions and separated management authority.
- Main CI, CodeQL and Secret Scan must all pass on the exact production commit. This is **not** a physical evacuation or live-message delivery acceptance.
