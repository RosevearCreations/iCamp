# Build 134 — Independent Reopening Follow-Up Evidence Aging, Closure Recurrence Decision Replay & Owner Escalation Oversight

## iCamp source-of-truth audit

- Follow-up begins with a verified `verified_reopening_linked` Build 133 monitor, its earlier same-pair Build 130 owner reopening, and protected source proof; no unverified owner event is silently treated as a verified resolution.
- An ordered append-only chain captures independent reopening evidence, closure recurrence decision replay and owner escalation oversight. Separate reviewers are required. Reopened evidence age, due-date aging and peer/owner exceptions are computed by PostgreSQL, not trusted from the browser.
- A completed replay or resolved owner escalation cites a real Build 130 `independent_followup_verify / verify_followup_evidence` event whose `root_reopen_id` matches the exact Build 133 linked owner reopening. Thirty-day overdue gaps require escalation, and unresolved peer/owner exceptions cannot be described as stable.
- No action changes operational campground holds, reservations, payments, customers, case status or owner decisions. Owner records remain append-only and protected by forced RLS, strict campground-pair permissions, independent reviewers and immutable triggers.

## Rosevear Integration Contract v1 readiness (supplied handoff)

- The only gateway is **AI Data Platform**. iCamp remains the owner of campgrounds, sites, reservations, guests and passes; no other application receives iCamp database credentials.
- Server-only `GET /api/integration/v1/health` and `GET /api/integration/v1/capabilities` enforce short-lived HMAC-SHA256 signed gateway requests with key ID, exact path, 5-minute timestamp freshness and a campground UUID. A durable private append-only receipt enforces **atomic unique gateway/key/nonce** replay suppression; credentials never enter the browser.
- Both endpoints **fail closed by default** (`HOLD` / HTTP 503) until the owner configures per-environment server secrets and an explicit campground allowlist. Unknown or unapproved campgrounds are denied, not mapped to a different tenant. The only successful connection state is `TESTING`, never `CONNECTED` without owner approval.
- Capabilities deliberately return `[]`; reservations/site reference APIs, signed events, cross-app commands, external contact, provider dispatch and live data movement remain disabled. See `docs/INTEGRATION_V1_ICAMP_READINESS.md`.

## Release evidence

- New migration `0164_independent_reopening_followup_replay_oversight.sql` plus verification; locally and in CI it must pass PostgreSQL migration, verify and idempotent replay.
- `npm test`, TypeScript, ESLint, Prettier, optimized Next.js production build and browser E2E all pass.
- GitHub feature PR into `dev`, promotion PR into `main`; on the synchronized final commit CI, CodeQL and Secret Scan all pass for **both** branches.
- Hosted Supabase migration 0164 and SQL verification applied only after an ephemeral CI database pass. Check security advisories and confirm no unrequested customer records changed. No live website deployment is implied by GitHub Actions alone.
