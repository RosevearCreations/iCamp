# Build 190 — Shift Scheduling, Training/Qualification & Handoff Readiness

Status: implementation in release validation. **GREEN requires completed checks, production deployment and exact-SHA readback**, not this document.

## Scope and staff operating controls

- Private campground-scoped, staff-only Web/PWA scheduling workboard at `/workspaces/management/campgrounds/staff-shifts`, linked from the management campground hub. Employees see their own shifts, availability, qualifications and associated handoffs; schedule managers see a bounded property roster and planned workload. Independent training verifiers can see qualification decisions with source references.
- Authorized managers plan immutable, 30-minute to 16-hour shifts no more than 180 days ahead. The PostgreSQL insert guard rejects overlapping assignments (serialized per staff member by an advisory transaction lock), active self-declared unavailability and sensitive assignments without unrevoked independent qualification through the shift's end. Safety-sensitive mappings: aquatics/pool lifeguard, waterfront/waterfront monitor, equipment/equipment operator, food service/food safety.
- Staff can declare and explicitly clear their own unavailable windows. Subsequent unavailability declarations do not silently cancel existing shifts: the workboard flags them for human review. Shift cancellations are append-only manager decisions and do not delete the original schedule evidence.
- Training verification/revocation is source-backed, expiry-bounded, immutable, campground-scoped and performed by a manager other than the subject staff member. A schedule is **not** the specialized lifeguard/waterfront facility operating readiness decision; existing asset-specific evidence, supervisory procedures and prerequisites still apply.
- Workboard displays assignment duration, a 7-day hours estimate, short-rest flags, missing/expired qualifications, unavailability conflicts and 30-day qualification expiries. Review flags are not automatically considered legal employment/payroll determinations. UTC form fields avoid DST ambiguity; display times use each campground's time zone.
- Authorized manager/source staff record immutable summary and outstanding-work handoffs. The receiving staff member alone can acknowledge a specific directed handoff, using their own audit-backed evidence. An unassigned handoff or unacknowledged handoff remains visibly outstanding; a manager cannot impersonate receipt.
- Five `icamp_private` tables have forced row-level security; no anonymous/authenticated access and no application updates/deletes. Database triggers enforce active staff membership, authorized actors, independent evidence, cross-property composite foreign keys and immutable history. Authenticated writes also append the existing private audit ledger within the transaction.

## Release acceptance gates

1. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and Playwright browser E2E.
2. PostgreSQL 17 CI: apply migration `0202_build190_staff_shift_readiness.sql`, run full `database/verify` collection and `npm run build190:verify` rollback-only proof for authorization, independent qualification, expiry, overlapping shifts, availability, handoffs, immutable evidence and cross-campground RLS. No test staffing data persists.
3. Apply the numbered hosted migration to the linked iCamp Supabase project only after passing CI. Run the same SQL contract and compare Supabase security/performance advisors against the pre-build baseline.
4. Feature PR → `dev`, with green Verify / Browser E2E / Database migrations / CodeQL / Secret Scan and exact-head READY Vercel preview. Promote `dev` → `main` only after gates, sync `dev` to final `main` SHA and prove both deployments READY, public `/api/version` exact SHA and `/api/health/ready`, post-merge push workflows and no runtime errors.

## Holds, parity, queue

Staff Web/PWA is the required channel; no employee private data is published to public or IVR/SMS surfaces. Labor law compliance, payroll, safety certification issuance, physical entry control, external calls/messages, Billing and Omnichannel activation are explicitly out of scope and **HELD / DISCONNECTED**. Next queued Build 191: Vendor Service Requests, Contract/SLA & Follow-Up Evidence.
