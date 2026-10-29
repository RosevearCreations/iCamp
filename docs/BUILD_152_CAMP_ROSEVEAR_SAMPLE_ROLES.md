# Build 152 — Camp Rosevear sample accounts and platform administrator

Camp Rosevear already exists in the hosted iCamp database as an **inactive synthetic/test-only campground**, with a separate inactive synthetic organization. Its two prior staff fixtures are disabled. They are not real accounts that can sign in.

The owner requested:
- `SampleCamper`: guest account, tied to future Camp Rosevear test reservations (guest account itself is global; guest profile access remains booking-linked).
- `CampRosevear`: campground manager, assigned only to Camp Rosevear, not a platform administrator.
- `Rosevear`: platform operator with overall statistics and application management scope. This must never use a campground `owner_admin` assignment as an accidental global bypass.

## Provisioning and activation boundaries

Usernames are case-insensitive. The sign-in form accepts username or email. Email remains the account-recovery identifier; no delivery address has been supplied for these fictional identities.

**Never put plaintext credentials into repository source, SQL migrations, GitHub Actions, or Vercel.** The supplied demonstration passwords are visible in chat, so they must be replaced before opening an accessible environment. Provision credentials privately using the app's scrypt password hasher and a protected one-time process. Do not grant platform access on the strength of a password alone.

The demo campground and named identities remain inactive/pending pending secure activation, verified reachable login environment, tenant isolation, and test scope. Global `Rosevear` is never auto-activated: a separately approved global role, independent reviewer, verified MFA factor and AAL2 session are required. The platform dashboard at `/platform` is read-only and refuses all other sessions.

## Data flow

1. Guest signs in as SampleCamper and sees only personal account details; after an authorized test reservation, the guest profile becomes associated with Camp Rosevear.
2. CampRosevear signs in as a staff identity, receives explicit Camp Rosevear assignment roles and can enter only that campground workspace.
3. Rosevear's verified platform role sees aggregate organization/campground/account counts in a separate guarded platform dashboard, **not** private guests or campground write controls by default.
4. All future profile, preferences, contacts, billing, staff invitations and account recovery work will remain scoped by server-derived user ID, organization/campground authorization and audit trails.

The separate QL-256 inter-app signing and owner TEST-only gate stays DISCONNECTED/HOLD.
