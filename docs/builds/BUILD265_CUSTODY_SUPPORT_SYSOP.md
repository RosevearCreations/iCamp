# iCamp Build 265 — Original Custody, Guest Safety and Separate SaaS/Campground Control Planes

## Core product boundaries
There are **three separate readiness dimensions**, never one misleading total:
1. **Campground tenant application:** the self-service SaaS product a campground operates, including sites, maps, stays, events, rentals, maintenance, staff, local IT, local complaints, facilities, inventory, receipts and customization.
2. **iCamp platform owner/Sysop shell:** multi-tenant operations oversight, platform support, source-verified complaints, service performance, traffic, locks, incidents, operational queue errors, releases, rollback/backup and cross-app telemetry. No automatic permission to inspect unrelated tenant guest records.
3. **External activation:** banks, SMS/voice/email, gates, providers, host-reboot witness, real licensed animal/instructor operations and independent seven-peer signed ACKs. Code contracts do **not** equal enrolled provider operations. As requested, the external operations progress baseline is 0% until original independently verified activation evidence exists.

## Build 265 implemented source
- Migration 0241 adds tenant-scoped durable original guest safety acknowledgment, staff pickup/return custody observation, independent staff on-site supervised pilot observation and campground support/complaint cases; private FORCE RLS, no direct app grants and guards for tenant, roles, original source, sequencing and immutable receipts.
- /guest/rentals includes explicit safety and terms checkboxes for a real staff-reserved equipment item. It records SHA-256 of the displayed safety statement. This is NOT a universal legal waiver, insurance acceptance, payment or unattended handover.
- /workspaces/management/campgrounds/rental-custody265 records manual, original staff-observed pickup and return references. Pickup requires active, source-backed, within-date equipment and original guest safety acknowledgment; return follows pickup. Cancellation of a picked-up item requires a return first. Animal self-service is excluded.
- /workspaces/management/campgrounds/rental-custody265 also accepts a *different authorized staff member's* immutable internal supervised-pilot observation; neither it nor its signed evidence references prove insurance, qualified external instructor licensing, animal welfare certification or a live public customer pilot.
- /workspaces/management/campgrounds/operations-centre265 gives campground owners a dedicated, permission-scoped local operations and customization hub: their campground/site structure, accommodations, map, rentals, events, booking rules, store, maintenance, guest assistance and local IT links, and real tenant-scoped locked-up/performance/complaint/change tickets with status transitions and audit history.
- /sysop/support265 gives MFA-only iCamp Sysop separate **aggregate** cross-campground support counts, current protected source build information and privacy-safe seven peer ACK status (no tenant guest data). Original signed receipts are verified with independently enrolled peer public keys and exact pinned source/receiver SHAs, 60-second expiry, signature and nonce. Not equivalent to seven live CONNECTED peers.
- The operating tenant must be able to manage its own rentals/events/site changes without full-platform Sysop intervention. The platform shell must eventually support direct authenticated operator response, persistent case comments, actual metrics/trace ingestion, tenant-specific diagnostics by consent/authorization, alert paging and audited recovery workflows. These remain outstanding.

## Release and physical activation
- Build 265 code GREEN means CI source, ephemeral test migrations and Vercel exact main SHA READY; it does not certify production migration 0241 was applied to the *original* production PostgreSQL, or authorize any bank payment, messaging, remote reboot, gateway/gate unlock or actual real-customer horse ride.
- Signed peer ACKs can show original receipt evidence only. Live authenticated transport enrollment/continuous monitoring and independently observed Windows reboot still HOLD unless original field receipts exist.
- Reactivation of external providers must remain owner-controlled and fail-closed. No fake 7/7 state or zero-traffic charts.

## Scoring rules
- Every future meaningful build should target a 5–10 percentage point improvement **in the feature group genuinely completed and accepted**, not artificially advance all individual categories or overall product completion each time. Small fragments should be consolidated. Record before, after, evidence and any blockers. Zero improvement is an honest result when real-world proof is missing.
- The accompanying Word source of truth scores separately the campground SaaS, Sysop/IT support shell and external activation. Public and internal pages are counted as implemented source when verified, not automatically as fully functional.
