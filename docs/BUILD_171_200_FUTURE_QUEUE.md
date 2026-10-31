# iCamp Next 30 Builds — 171–200

**Status:** Approved 30-build sequence. Build 171's code and acceptance contract are recorded in `BUILD_171_RECOVERY_SNAPSHOT_OWNER_REQUEST.md`; check actual CI/deployment evidence before treating it as promoted. Builds 172–200 are planned only, not yet implemented or owner-approved. **Baseline:** Build 170. **Next after Build 171:** Build 172. Review scope against current code and authoritative records at the start of each build so existing functionality is extended, not duplicated.

## Operating boundaries for all 30 builds

- Every customer, staff, provider and cross-property read/write requires server authorization, tenant-scoped PostgreSQL RLS, safe errors, audit events where appropriate, rate limits and tests for stale/concurrent updates. No browser-local state is misrepresented as authoritative evidence.
- **Billing / Omnichannel are HELD / DISCONNECTED.** Do not make actual customer charges, subscriptions, refunds, outbound calls/SMS, cross-app gateway GETs, live dispatch or physical gate commands without separately verified original evidence, provider/legal clearance, independent reviewer/owner approval and explicit activation. Provider-sandbox and read-only work must remain isolated and disabled by default.
- Each UI build requires accessible Standard Theme desktop/tablet/phone flows, keyboard operation, visible focus, 200% reflow, appropriate reduced-motion behaviour, inline ⓘ help, error/retry/empty/stale states, and source freshness when relevant. Later themes must reuse shared tokens rather than duplicating business logic.
- **Channel contract:** Guest Web/PWA features also need a published IVR/DTMF and SMS/MMS support matrix, but these channels remain disabled while held. Provide a staffed, authenticated or secure-link fallback when appropriate. Visual mapping/complex document review is explicitly Web/PWA-only with an accessible text alternative. Staff-only screens are Web/PWA with no spurious IVR/DTMF equivalence.
- Each build delivers its own migrations if needed, rights/retention assessment, audit/accessibility/performance tests, dependency safety, `dev` CI and preview checks, promotion PR gates, exact-commit `main` production verification and a correctly queued successor. **GREEN means verified deployment of the implemented code, never approval of held business operations.**

## Wave 1 — Existing trust, evidence and customer booking (171–176)

### Build 171 — Scenario Recovery Checksum Exception Review, Escalation Handoff Snapshot Continuity & Standard Theme Independent Owner Acceptance Request Summary

- **Outcome:** Finish the Build 170 follow-up without treating local checksum matches, missing cases or owner checklists as verified acceptance.
- **Scope:** Explain mismatch/untrusted checksum exceptions before recovery; preserve bounded, permission-safe source snapshot references across escalation handoffs where authoritative data permits; prepare a complete, reviewable independent owner accessibility acceptance *request*, separate from the acceptance decision.
- **Done when:** Cross-user/campground backup imports fail safely; changed/missing source records remain open for triage; request summaries contain no fabricated signatures; keyboard, zoom, phone and tablet regressions pass. **Channels:** Staff Web/PWA; no outbound communications or provider actions.

### Build 172 — Independent Owner Review Intake, Accessibility Evidence & Decision Ledger

- **Outcome:** Replace fragmented browser-only review notes with a properly scoped, durable handoff process when authorized.
- **Scope:** Separate preparer, independent reviewer and actual owner decision roles; retain immutable source references and versioned device/accessibility findings; show pending/rejected/recheck/approved *actual* decisions without auto-approval. If approved server-side workflow is unavailable, ship only read-only review/integration contracts and keep submission disabled.
- **Done when:** Unauthorized actors cannot accept their own request; recheck remains required after corrective work; original evidence/time/actor is distinguishable from a draft. **Channels:** Staff Web/PWA only.

### Build 173 — Accessible Campsite/Cottage Discovery, Availability Filters & Side-by-Side Comparison

- **Outcome:** Help a guest choose the right accommodation before beginning checkout.
- **Scope:** Extend real site/cottage inventory with campsite type, accessible features *actually attested by a campground*, dates, occupancy, pet/vehicle rules, amenities, photo quality and saved comparisons; synchronized text-list/map results and no invented availability.
- **Done when:** Filters and three-way comparisons reflect authorized live availability, provide keyboard/screen-reader equivalents, and handle expired holds visibly. **Channels:** Public Web/PWA; accessible text/staff-assisted fallback; IVR/SMS only as future provider-gated adapters.

### Build 174 — Transparent Booking Total, Fee Breakdown & Policy Preview

- **Outcome:** Make the real cost and key restrictions clear *before* a guest confirms a reservation.
- **Scope:** A server-generated, expiring, currency-correct quote showing nightly rates, person/vehicle/add-on fees, applicable configured tax, deposit, cancellation terms and the last-priced-at time; consistent public, office and print summaries.
- **Done when:** Displayed total matches the canonical quote; changed rates/expired holds demand re-quote; no hardcoded taxes, hidden mandatory costs, or premature payment collection. **Channels:** Web/PWA and assisted/secure-link quote; IVR/SMS amount summaries gated.

### Build 175 — Booking Draft Save-and-Resume & Safe Cross-Device Recovery

- **Outcome:** Keep guests from losing booking selections when interrupted.
- **Scope:** Time-limited signed-in or secure one-time return-link drafts, explicit consent and expiry, idempotent mutation, draft-vs-reservation clarity and server revalidation of inventory/price on return.
- **Done when:** Another guest cannot open a draft, recovery does not create a hold/charge, stale values revalidate and drafts expire/delete as configured. **Channels:** Web/PWA; staff-assisted fallback; secure-link delivery must not imply live outbound messaging.

### Build 176 — Reservation Change/Cancellation Preview & Guest Decision Controls

- **Outcome:** Give guests predictable options without forcing all routine changes through the office.
- **Scope:** Authenticated change-date/site and cancellation *previews*, policy/fee differences, time windows, owner review where required and a reversible or reasoned handoff for actions needing payment-provider approval.
- **Done when:** Every action rechecks current row/version, availability and permission; paid booking changes cannot silently refund/charge while billing is HELD; guest sees confirmed vs requested state. **Channels:** Web/PWA, secure assisted fallback; provider-gated voice/SMS status only.

## Wave 2 — Guest stay, services and accessibility (177–184)

### Build 177 — Arrival Planner, Pre-Registration & Check-In Readiness

- **Outcome:** Shorten arrival-day desk work and improve guest preparedness.
- **Scope:** Real reservation arrival windows, campground rules, vehicle/visitor details, optional accessibility needs, missing-document prompts and a staff-verifiable preregistration checklist; avoid collecting unnecessary sensitive information.
- **Done when:** Guests can amend permitted details, staff see fresh readiness and an incomplete checklist never becomes gate access or a check-in approval. **Channels:** Web/PWA; office-assisted alternative; future IVR/SMS summary only.

### Build 178 — Unified My Stay Mobile Hub & Status Timeline

- **Outcome:** Consolidate the existing profile/stay/assistance pages into one useful camper dashboard.
- **Scope:** Authorized reservation status, arrival/departure, campsite details, visitor/pass status, open assistance cases, campground notices, documents and links to actions with freshness/empty/error states.
- **Done when:** Another guest's records cannot be viewed, changes refresh in place, navigation works at phone width/large text and stale values are flagged. **Channels:** Guest Web/PWA, staffed authenticated lookup fallback.

### Build 179 — In-App Assistance Conversation & Case Progress

- **Outcome:** Let campers see what happened after they reported an issue.
- **Scope:** Extend existing assistance triage with authenticated in-app guest/staff case comments, attachments under current media rules, timeline, clear assignment/status and urgent escalation labels; no implied guaranteed response time.
- **Done when:** Replies and status transitions are tenant/guest scoped and audited, unsafe files fail validation, and no actual SMS, email or dispatch leaves the system. **Channels:** Web/PWA and staff desk; outbound channels remain HELD.

### Build 180 — Accessible Map/List Wayfinding, Amenities & Directions

- **Outcome:** Make a campground navigable on foot and with assistive technology.
- **Scope:** Extend the existing photo/polygon map with accessible searchable site/amenity list, named destinations, campground-supplied paths/accessibility notes and clearly marked unavailable directions; do not fabricate route times or safety access.
- **Done when:** Keyboard/text users find the same destinations as map users, closed/maintenance areas remain correctly marked and owner-supplied route information is traceable. **Channels:** Visual Web/PWA map plus nonvisual text list and staff-assisted description.

### Build 181 — Events & Recreation Discovery, Capacity & Registration

- **Outcome:** Help guests discover activities and allow staff to manage interest and attendance.
- **Scope:** Real campground calendar, eligibility/age notices, attendance caps, waitlist, free reservation confirmation and organizer workboard. Paid access remains preview/hold-only without a validated provider.
- **Done when:** Two simultaneous registrations cannot exceed capacity; changes/cancellations are visible and records respect campsite/guest privacy. **Channels:** Web/PWA, front-desk registration; paid/IVR/SMS actions gated.

### Build 182 — Amenity/Equipment Rental Availability & Reservation Planner

- **Outcome:** Let guests plan canoes, kayaks, halls and other rentals without double-booking.
- **Scope:** Owner-configured availability, equipment readiness/inspection restrictions, buffer times, eligibility, staff pickup/return workflow and a quote/hold that is not payment.
- **Done when:** Concurrency prevents overlaps, unsafe/unavailable equipment cannot be reserved and actual rentals remain subject to staff confirmation. **Channels:** Web/PWA, staffed fallback; payment channels HELD.

### Build 183 — Guest Store Catalogue, Cart Draft & Campsite Delivery Planning

- **Outcome:** Make firewood, ice and other items easier to find and request.
- **Scope:** Tenant-specific catalog, real stock visibility, cart drafts, campsite/pickup time preference, delivery zones, stock reservations where valid, and staff fulfillment review; no live checkout without authorization.
- **Done when:** Oversells/expired inventory are blocked, stock and delivery restrictions are visible, and draft orders cannot create a financial obligation. **Channels:** Web/PWA and staff-assisted order preview; provider payment/notifications HELD.

### Build 184 — Guest Feedback, Service Recovery & Moderated Reviews

- **Outcome:** Capture honest feedback and help managers address recurring problems.
- **Scope:** Post-stay verified feedback, private service-recovery case links, guest-controlled review visibility, moderation/appeal history, accessibility and respectful response templates.
- **Done when:** Staff cannot fabricate verified guest ratings; private incident details never appear in public reviews; owners can see issue-to-resolution outcomes. **Channels:** Web/PWA, staffed response fallback; outbound notifications gated.

## Wave 3 — Front desk, safety, workforce and commerce operations (185–193)

### Build 185 — Front Desk Unified Arrival/Departure & Exception Workboard

- **Outcome:** Cut the number of screens needed to run the daily campground desk.
- **Scope:** Combine real reservation arrivals/departures, holds, preregistration, unpaid-*status* flags, visitor exceptions and work-order blockers in permission-aware sortable queues, each linking to its canonical action.
- **Done when:** Counts reconcile with full source sets (or clearly disclose limits), actions refresh without phantom approvals, and staff keyboard workflows work at busy-desk speed. **Channels:** Staff Web/PWA.

### Build 186 — Housekeeping/Maintenance Turnover & Availability Release Controls

- **Outcome:** Keep an unready site or cottage off sale until correctly cleared.
- **Scope:** Connect existing checkout, cleanup, cottage inspections, maintenance blocking and supervisor release with evidence, who/when stamps and reopening safeguards.
- **Done when:** Incomplete work/failed safety inspection cannot automatically free inventory; duplicate workers and race conditions are handled and overrides need audited authority. **Channels:** Staff Web/PWA, offline-safe worklist where appropriate.

### Build 187 — Canonical Security Incident Cases & Independent Closure Evidence

- **Outcome:** Fill the explicit gap in `REQUIREMENTS_COVERAGE.md` between security event signals and actual incident management.
- **Scope:** Tenant-private security/safety incident intake, restricted attachments, severity, assignee, escalation, investigation chronology, independent closure review and reopen trail linked to but distinct from gate/access events.
- **Done when:** Permission and RLS tests protect witnesses/guests; a disappearing alert cannot close a case; independent evidence and safety incident retention are enforced. **Channels:** Restricted staff Web/PWA; emergency contact channels remain governed by existing authorization and hold rules.

### Build 188 — Visitor/Vehicle/Access Credential Lifecycle & Safe Reconciliation

- **Outcome:** Prevent outdated or duplicated passes from creating access confusion.
- **Scope:** Reconcile guest/visitor/vehicle enrollment, expiry, revocation and access logs with recorded campground policies; allow staff to detect inconsistent assignments without issuing commands to external hardware.
- **Done when:** Revoked/expired access is correctly rejected in app-side authorization tests, operator override requires reason, and physical gate execution stays disabled until independently authorized. **Channels:** Staff Web/PWA; physical integration HELD.

### Build 189 — Offline Field Work Queue, Conflict Resolution & Sync Audit

- **Outcome:** Improve reliability for grounds/maintenance teams with poor signal.
- **Scope:** Extend the existing offline maintenance foundation to filtered assignments, device-local draft protection, safe image queues, version-aware re-sync, merge/resolve UX and a non-duplicative audit trail.
- **Done when:** Conflicting edits require review rather than last-write-wins, lost connectivity cannot falsely mark work complete and RLS applies on server replay. **Channels:** Staff Web/PWA offline-capable; IVR/SMS not required.

### Build 190 — Shift Scheduling, Training/Qualification & Handoff Readiness

- **Outcome:** Help managers assign the right trained staff and hand off outstanding work.
- **Scope:** Role/department schedules, availability, qualification expiry, certification prerequisites for sensitive work, shift handoff notes and workload flags; protect employment data.
- **Done when:** Unqualified assignments are warned/blocked according to policy; labor/availability conflicts are visible and cross-campground employment data stays private. **Channels:** Staff Web/PWA.

### Build 191 — Vendor Service Requests, Contract/SLA & Follow-Up Evidence

- **Outcome:** Track external waste, septic, repairs and infrastructure services without lost requests.
- **Scope:** Restricted vendor profiles, contract documents, repeat service schedules, work-order links, owner-set response targets and invoice-intake handoffs (not payable execution).
- **Done when:** Contract expirations and overdue work are visible, no sensitive supplier data leaks to guests and no unapproved external purchase/order is sent. **Channels:** Authorized staff Web/PWA.

### Build 192 — Store Inventory, POS Session & Stock Reconciliation

- **Outcome:** Reduce unexplained inventory differences and support staff accountability.
- **Scope:** Receipt/transfer/damage/return ledger, register session opening/closing, variance review and stock reorder suggestions using the existing product/POS concepts; separate bookkeeping from actual processor settlement.
- **Done when:** Every change has an attributed reason, concurrency cannot sell negative available stock, and accounting exceptions reconcile to canonical evidence. **Channels:** Staff Web/PWA; card/payment settlement remains HELD.

### Build 193 — Seasonal Renewal, Winterization & Spring-Reopening Owner Queue

- **Outcome:** Give annual-site operators one clear path through renewal and seasonal readiness.
- **Scope:** Extend current seasonal contract, winterization and spring inspection data with renewal intent/preference, owner alerts as in-app tasks, linked signoffs and unresolved deficiency queues.
- **Done when:** Annual terms/expiry are versioned, missing winter/spring safety work blocks readiness, and no automatic charge or externally sent notice occurs. **Channels:** Guest/owner Web/PWA and assisted office; outbound messaging HELD.

## Wave 4 — Management quality, control, resilience and launch (194–200)

### Build 194 — Role-Aware Operations Dashboard, Saved Layouts & Actionable Drilldowns

- **Outcome:** Make management, I.T., status and statistics screens more readable and operationally useful.
- **Scope:** Extend Standard Theme's real-source Command cards with configurable layouts, favorites, saved filters, role-safe KPI drilldowns, responsive inspector panels, clear error/stale indicators and ⓘ help. No duplicated backend metric definitions.
- **Done when:** Save/recovery works per user and campground; unauthorized cards cannot be opened through deep links; layouts remain accessible on phone, tablet and desktop. **Channels:** Staff Web/PWA.

### Build 195 — Source-Grounded Occupancy Forecasts, Scenario Confidence & Export Provenance

- **Outcome:** Move beyond historical current-month comparisons toward explicit planning forecasts *only when data supports them*.
- **Scope:** Document seasonal time horizons, inventory/capacity limits, sample-size/coverage and uncertainty bands, actual-vs-projected backtests, scenario explanation, source timestamps and export provenance. Preserve earlier checksum tools as byte checks, not signatures.
- **Done when:** Insufficient history shows unavailable, observed data is distinguishable from projections, and forecasts never make a booking or cash decision automatically. **Channels:** Staff Web/PWA with printable accessible summaries.

### Build 196 — Financial Exception Review, Refund Readiness & End-of-Day Close

- **Outcome:** Help operators reconcile the finance trail before activating paid flows.
- **Scope:** Source-linked exception inbox for deposits/ledger/receipts/refunds, maker-checker adjustment approvals, end-of-day close worksheets, provider-neutral settlement import previews and independent variance review.
- **Done when:** No unsupported transaction is invented, every adjustment is audited and live refunds/settlement remain disabled without approved payment-provider activation. **Channels:** Restricted staff Web/PWA.

### Build 197 — Guest Privacy Requests, Consent History, Retention & Export

- **Outcome:** Give campground and platform administrators a safe way to answer guest data requests.
- **Scope:** Consent/version ledger, authenticated access/correction/export/deletion request queue, hold/exception rules, retention preview and provenance of what was disclosed or withheld; configure to applicable jurisdiction and obtain legal review.
- **Done when:** Tenant and identity boundaries hold, exports exclude other guests/witnesses, and retention jobs are tested in preview before irreversible erasure. **Channels:** Authenticated Web/PWA plus verified manual request route; no automatic external delivery.

### Build 198 — Backup/Restore Drills, Performance Budgets & Incident Runbooks

- **Outcome:** Prove the live application can recover and remain responsive under realistic load.
- **Scope:** Repeatable backup/restore and tenant-isolation drills in isolated nonproduction, actionable health/SLO panels, queue/job replay controls, database query budgets, synthetic outage tests and incident/rollback playbooks.
- **Done when:** Recovery points/times are measured rather than assumed, restored data passes tenant/privacy checks and deployment rollback is demonstrated without risking production data. **Channels:** I.T. Web/PWA; public-safe status only.

### Build 199 — Tenant Subscription Sandbox Lifecycle & Legal Consent Gate

- **Outcome:** Prepare controlled monthly campground subscriptions without claiming provider or legal approval.
- **Scope:** Provider-neutral, default-off sandbox adapter for test checkout, invoices, renewals, cancellations, retry/idempotent signed webhooks, disputes/refunds and authenticated versioned consent; separate billing permissions and secrets.
- **Done when:** Official test-mode evidence covers normal and failure cases, signer/reviewer roles are separate, no real charge is possible, and any missing provider/legal/source approval leaves activation **HELD**. **Channels:** Platform admin Web/PWA; provider TEST-only, no outbound production communication.

### Build 200 — Full Guest/Staff Pilot Acceptance, Omnichannel Proof Review & Go-Live Decision

- **Outcome:** Convert many individually working features into a real, end-to-end campground experience.
- **Scope:** Camp Rosevear fixture/pilot walkthrough for search→quote→reservation→arrival→stay→help→checkout; separate desk→turnover→maintenance→management and privacy/recovery journeys; real-device accessibility, independent signoff and owner-readable release scoreboard. Reassess *original* Comms Hub evidence, consent and TEST-only gateway boundaries separately.
- **Done when:** Each journey has reproducible evidence, known issues, ownership and independent decision; external provider/source proof and owner approval are not inferred from a GREEN deployment. Unmet gates remain clearly **HELD / DISCONNECTED**, with an explicit post-200 queue decision. **Channels:** Web/PWA tested; IVR/SMS only if independently approved, otherwise documented staff/secure-link fallback.

## Queue management

1. Start with **171**; after each completed build update `BUILD_QUEUE.md`, this plan's completion state, source-of-truth requirements and exact next build.
2. Check duplicate or already-working capabilities against production before coding. Convert outdated planned work into targeted improvements with the same user outcome, not redundant screens or competing data models.
3. Do not treat the legacy 001–156 roadmap or the presence of a route/migration as proof of real-world acceptance. Confirm hosted database migration status and exact production SHA separately.
4. **Build 200 is a checkpoint, not the end of iCamp.** Extend the queue after real pilot evidence and remaining user priorities are reviewed.
