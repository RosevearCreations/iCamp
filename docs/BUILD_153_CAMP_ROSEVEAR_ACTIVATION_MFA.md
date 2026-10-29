# iCamp Build 153 — Camp Rosevear private activation and MFA onboarding

## Scope and honest observed state

Build 152 created three username identities (`SampleCamper`, `CampRosevear`, `Rosevear`) in the existing iCamp Supabase project **disabled**, with Camp Rosevear kept **inactive** and explicitly synthetic. The `Rosevear` global platform grant is **pending**, not active. The sample passwords originally typed into chat are not acceptable privileged activation credentials; fresh private passwords are required.

Build 153 adds:
- Private global self-service account profiles at `/auth/profile`, distinct from booking-linked guest stay profiles and campground staff authorizations.
- Authenticated TOTP enrollment at `/auth/mfa`; a password must be reverified for setup, an encrypted per-user seed is persisted on the server, a code must be verified to reach AAL2, accepted time steps cannot be replayed, and repeated failures temporarily lock the factor. High assurance expires after 15 minutes.
- A narrowly guarded **manual** operator-only test activation command. It refuses the current iCamp production Supabase project, requires a different approved test project, a separate private secret store, new unique passwords and a synthetic-only single-campground database. It grants the Camp Rosevear manager role **only to that campground** and does not automatically approve global platform privileges.

## Actual owner/operator steps still required

1. Provision a **separate** Supabase project intended exclusively for nonproduction iCamp testing (do not use the current production project `cxgszmpbeswdikzofvjv`, and do not use the unrelated Rosevear Comms Hub project).
2. Apply canonical iCamp migrations to that test project and seed only the three disabled test identities, their approved synthetic Camp Rosevear fixture and the manager-only scoped assignment. No real guests, gates, payment providers, SMS or imported customer records.
3. In a trusted private operator environment set `ICAMP_APP_ENV=testing`, `ICAMP_ALLOW_TEST_ACCOUNT_ACTIVATION=true`, `ICAMP_TEST_SUPABASE_REF` to the **approved separate** test project reference, and supply `DATABASE_URL`, `ICAMP_TEST_GUEST_PASSWORD`, `ICAMP_TEST_MANAGER_PASSWORD`, `ICAMP_TEST_PLATFORM_PASSWORD` and `ICAMP_MFA_ENCRYPTION_KEY` directly from a protected secret store. Each new test password must be unique and at least 16 characters. The MFA key is a random **32-byte base64url** secret, server-only and never committed or copied into chat. Do not log or paste these values.
4. Run `node scripts/activate-camp-rosevear-test-accounts.mjs` first: it only displays the dry-run guard. Only on the verified isolated test host, invoke it with `--apply`. It verifies the synthetic tenant, disabled identities, role scope and pending platform grant in a transaction. It never activates a real external integration gateway.
5. Configure the test deployment runtime with its **separate** test `DATABASE_URL` and `ICAMP_MFA_ENCRYPTION_KEY`. Verify username login for all three identities and access to `/auth/profile`. The guest remains limited to guest surfaces; campground manager only to Camp Rosevear. Booking-linked guest profiles still appear only after an authorized test reservation.
6. Log in as the test `Rosevear` identity, set up TOTP on `/auth/mfa`, verify its code and confirm session AAL2. An independently verified owner and reviewer must **separately** accept the global platform-role activation, and must not approve their own role. The database enforces a distinct reviewer and the platform page requires AAL2 and a verified MFA factor.
7. Do not configure test DB credentials in production Vercel; do not expose `ICAMP_MFA_ENCRYPTION_KEY` through a `NEXT_PUBLIC_*` variable.

## QL-257 integration is an independent gate

The attached Comms Hub QL-257 owner handoff states that iCamp signer status remains `SIGNER_STATUS_UNKNOWN`, genuine QL-246 proof B is `NOT_AVAILABLE`, independent custodian/witness/reviewer are not authenticated, real gateway GET tests are `NOT_RUN`, and owner TEST-only approval is `NOT_GIVEN`. The mini-server relay stays off; inter-app connections stay `DISCONNECTED / HOLD`. These account onboarding changes neither create integration proof nor authorize any real gateway requests.

**Build completion criteria:** repository tests, database migration checks, dev/main checks and exact SHA Vercel deployment READY. **Operational activation is separate** and cannot be claimed without a real isolated test database and private credentials.
