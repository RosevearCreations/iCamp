# iCamp Build 089 — Spring Reopening & Return-to-Service Safety

## Delivery

Build 089 follows Build 087's required winter shutdown and Build 088's eligible winter-open readiness, without treating either winter approval as spring return-to-service authority.

1. Campground management publishes a permanent, versioned site reopening checklist with **six required safety domains**: water-restoration/no-water inspection, electrical/heating, drainage/sanitation, fire/emergency, safe grounds and emergency access, and overall site/structure condition. Additional local required or optional steps preserve their exact published version.
2. Staff create an inspection for an active accommodation. A winter-closed seasonal/yearly assignment must be explicitly linked to that same accommodation, and the database automatically pins its **latest canonical winter-close event** and winter cycle. A standalone site without an active winter-closed assignment may also be inspected without changing its operational or booking state.
3. Inspectors record append-only source-linked observations. Every defect must link an active canonical maintenance work order for the site/campground. All related work orders must be **completed**, and the affected steps re-inspected with acceptable current evidence, before approval.
4. A lead, main foreman or authorized manager independently approves/rejects. Approval is barred for anyone who opened or inspected the case, for incomplete/defective steps, inactive Camp Rosevear, inactive accommodations, stale closure events or the wrong spring cycle. Approval is immutable and does **not** perform an opening action.
5. The existing canonical seasonal/yearly `reopened` transition is protected by a **database trigger** requiring an approved Build 089 inspection for that assignment's *latest* winter-close event. Authorized management performs this distinct transition through its existing desk. Any later winter close invalidates older approvals for reopening.
6. Rich dedicated Management UI with ⓘ help, campground-scoped roles, private FORCE RLS, no direct Data API grants, full audit history and clear phone/SMS/IVR authenticated-web handoff boundaries.

## Camp Rosevear and safety boundaries

- Camp Rosevear remains inactive synthetic data. It can exercise policy publication and inspection evidence but **cannot approve actual physical inspections or reopen a live assignment**. No simulated inspector is represented as having verified actual campground equipment.
- Reviewers must inspect actual conditions and independently verify required local water-quality, electrical, fire, health and operating clearances. Software evidence is not proof of those conditions or a substitute for local rules and staff qualifications.
- No gate, water, heat, power, booking, rate, payment, safety closure or emergency communication is automatically changed by spring approval. Canonical long-term reopening does not itself create transient booking availability. Other facility restrictions must be separately resolved.
- Web/PWA provides the authenticated operational console. IVR/DTMF and SMS can securely hand off to the console; they never originate or approve physical-safety evidence.

## Verification and promotion

- Database migration `0121_spring_reopening_return_to_service.sql` and matching verifier are tested in a rollback-only transaction against Supabase and then applied with post-migration advisor checks.
- Follow-up migration `0122_spring_reopening_read_policy_consolidation.sql` folds the exact winter and spring read-permission union into the canonical read policies on four shared operational tables. It preserves existing roles while avoiding multiple permissive policy scans; its independent verifier and hosted dry run must pass.
- `tests/build089-spring-reopening.test.mjs` covers required domains, cycle calculation, defect work orders, source evidence, closure pinning, immutable independent sign-off, RLS and integrated help.
- Full `npm run verify`: Prettier, lint, TS, tests and Next production build.
- Feature branch → `dev` → `main`. Require CI application/browser/database, CodeQL and Secret Scan GREEN for each PR and final production `main` push before closing the build.

## Follow-up

Build 090 will review seasonal reopening evidence with the campground owner and reconcile cross-system operational holds and final site-availability acceptance. It must not silently alter independent subsystem safety decisions.
