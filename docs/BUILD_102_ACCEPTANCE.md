# iCamp Build 102 — Owner Trend Review Annotations & Cross-Campground Follow-Up Handoff Planning

## Delivered

An owner-only planning screen at `/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning` extends Build 101 without changing its aggregate reporting logic. Owners can annotate one of the most recent twelve UTC activity weeks at a source campground, selecting a reporting metric, interpretation, internal evidence reference, non-personal operations note and future review date. A subsequent immutable handoff plan links to that source annotation and identifies a different campground with an active Owner / Administrator assignment for the same operator. The target may belong to another organization when *both* active assignments are independently authorized.

Hosted database migration `0133_owner_finance_trend_handoff.sql` introduces two append-only ledgers and a narrowly scoped internal owner authorization helper. Tables use forced RLS, no public API role grants, `icamp_app` SELECT/INSERT only, per-campground owner checks for trend annotations and **two** independent owner checks for handoff plans. A private helper checks active assignment, owner role and finance-operations permission from the trusted server-set user identity; each write also verifies the supplied actor identity. Immutable triggers reject changes or deletion. Date guards constrain annotations to retained UTC weeks and next reviews/handoffs to 90 days.

The design is **risk-neutral**: no applicant contact information, IDs, credit/eligibility scoring, financing proposals, payment instruments, automated messages, transfers, operator task assignment or exception release. Owner notes are explicit operational text with client and server validation and bounded length. The UI displays only owner-authorized records (latest 100 per type across the first 50 owner campgrounds, with coverage warnings).

## Acceptance

1. `npm run verify`: formatting, ESLint, TypeScript, automated tests, optimized Next.js build pass, including the Build 102 planning page and contextual help route.
2. `database/verify/0133_owner_finance_trend_handoff.sql` validates RLS, restricted grants, immutable triggers and dual-campground permission policy on a fresh database.
3. Hosted Supabase migration 0133 is applied once; inspect tables/policies and run Security Advisor; report any pre-existing findings rather than reducing permissions.
4. Unit/security tests prove date/metric validation, distinct target enforcement, sensitive-text guardrails, read-only/append-only access and owner-scoped SQL queries.
5. Feature → `dev` and `dev` → `main` checks are all GREEN; verify the exact final protected `main` HEAD. Independently hosted site publication is outside this GitHub promotion gate.
