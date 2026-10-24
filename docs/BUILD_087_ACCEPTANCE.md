# iCamp Build 087 — Seasonal/Yearly Winterization Workflow

## Scope

Implement a campground-scoped, human-attested winter shutdown record for the existing Build 047 seasonal/yearly assignments. No electrical, water, heating, gate or other physical equipment is remotely controlled.

1. Campground management publishes immutable, versioned shutdown checklists. **Water shutoff and water-line draining are required**; each property can add required/optional local utility steps.
2. Assigned staff open one run for each long-term assignment per winter operating year. Runs retain the checklist version; publishing changes does not rewrite historical evidence.
3. Staff log append-only observed step results, field notes and evidence references. A failed step must reference a canonical maintenance work order. Mandatory steps cannot be marked optional.
4. The authorized maintenance lead/main foreman or owner records a decision after evidence review; approval is blocked unless the latest evidence for every required/optional step is acceptable. Approval must be independently performed by someone who did not start or record the run's work.
5. The canonical seasonal assignment cannot transition into `winter_closed` if flagged `winterization_required`, unless an approved sign-off exists for that assignment's current winter operating year. Removing the winterization flag on a signed assignment is blocked.
6. Privileged Management UI: `/workspaces/management/campgrounds/winterization`, discoverable from the campground and long-term assignment desks, with contextual ⓘ help.

## Camp Rosevear demonstration boundary

Camp Rosevear is synthetic and inactive. It may be used to verify draft templates, runs and sample evidence, but **cannot claim physical shutdown completion** or obtain live sign-off while inactive. Do not change its lifecycle merely to create apparently authentic utility-work approvals. All simulation-only fixtures must remain distinct from actual customer reservations, real invoices and physical-work compliance records.

## Security / access

- `winterization.read`, `winterization.record`, `winterization.template.manage`, existing `winterization.signoff` are campground-specific, role-gated permissions.
- All four tables have FORCE RLS and no direct `anon`, `authenticated`, or `service_role` grants. The server uses a short-lived `icamp_app` transaction context and checks actor identity and assignment scope in SQL triggers.
- Evidence, checklists and reviews cannot be updated or deleted. Rejected runs can accept further correction; approved runs are terminal.
- Approval is independently attested and forbidden for inactive demo campgrounds. An owner/manager cannot bypass required winter sign-off by simply flipping an assignment's state.

## Acceptance and promotion gates

- SQL migration `0118_seasonal_yearly_winterization.sql` and its `database/verify/0118_seasonal_yearly_winterization.sql` run against the actual connected Supabase project (including negative permission tests where feasible).
- Unit contract tests under `tests/build087-winterization.test.mjs` validate mandatory water steps, custom/optional steps, source evidence, work orders, winter-year derivation, and immutable security surface.
- `npm run verify`: formatting, ESLint, TypeScript, automated tests, Next production build.
- Merge feature into `dev` after checks; promote `dev` into `main` only when all required checks pass, then verify production `main` SHA matches candidate and all production CI/CodeQL/Secret Scan jobs are GREEN.

## Intentional limitations / future builds

- Build 088: cold-weather *active/occupied* site alternative including verified insulation/heated-water measures and readiness rules.
- Build 089: independent spring reopening and return-to-service inspections.
- Physical inspections, local plumbing/winterization standards and site-safe procedures remain campground staff responsibilities; software never proves a pipe has been drained or a valve actually turned.
- Web/PWA provides complete interactive workflow. Telephone/IVR/DTMF and SMS may announce that on-site staff need to open the secure authenticated Management web screen but cannot submit, approve, spoof or infer physical-safety attestations through those channels.
