# iCamp Build 262 — Independent Database Custody, External Adapter Readiness, Four Regional Themes and Expanded Rentals

## Financial evidence and safe activation
- The existing Build 261 audit already reads the real Vercel Production
  DATABASE_URL using a separately set hostname pin and verifies the original
  migration 0238 ledger SHA-256 and owner-only schema controls. Build 262 adds
  dual-signed **original database custody** checks bound to the exact
  VERCEL_GIT_COMMIT_SHA, database hostname SHA-256, migration 0238 checksum
  and separately enrolled custodian/reviewer Ed25519 public keys.
- Production-only server variables (no secrets ever entered in a chat):
  ICAMP_DB_CUSTODY262_ENVELOPE_JSON,
  ICAMP_DB_CUSTODY262_CUSTODIAN_PUBLIC_KEY_PEM,
  ICAMP_DB_CUSTODY262_REVIEWER_PUBLIC_KEY_PEM,
  ICAMP_DB_CUSTODY262_CUSTODIAN_ENROLLED,
  ICAMP_DB_CUSTODY262_REVIEWER_ENROLLED.
  Enrollment flags must only be set after real, independently authenticated
  custodians confirm their public keys out of band. Never generate fake
  production evidence or sign on behalf of real parties.
- Envelope JSON: {payload,custodianSignatureBase64,reviewerSignatureBase64}.
  Payload schema is icamp.production-db-custody.v1, with sourceRevision,
  databaseHostnameSha256, migrationVersion="0238",
  migrationChecksumSha256, custodianFingerprintSha256,
  reviewerFingerprintSha256, originalHostReviewReference, issuedAt and
  expiresAt. Each signer signs UTF-8 JSON.stringify(payload) bytes.
  Signatures are bounded to seven days; exact source changes invalidate them.
- A valid dual signature is cryptographic possession evidence, not conclusive
  proof of bank settlement, external identity, backup success or lawful
  acceptance. The Build 260 owner non-posting approval action now requires
  both Build 261 and Build 262 assurance gates.
- Readiness inspects the real payment and refund adapter factories WITHOUT
  making a live provider call. Both still reject non-mock providers in this
  release. That is reported as NOT INSTALLED, never fake READY.
- **Live settlement activation remains HOLD.** Even if the payment and refund
  adapters become available, independent bank settlement receipt verification
  and a separately authorized owner activation remain required. No capture,
  refund, accounting journal, HST remittance or legally effective book close.

## Four regional visual themes
The existing Standard / Meadow and Orbit Command themes are preserved.
The browser-level theme selector now also offers:
- Niagara Falls: waterfall blues and cascading gradients
- Nova Scotia Coast: maritime teal, slate and soft sunrise coral
- BC Snow Mountains: high-contrast alpine blue and snowy peaks
- Saskatchewan Gold: prairie wheat, canola gold and amber sky

The CSS uses locally rendered gradients (no externally fetched artwork),
reuses all app pages and status semantics, maintains legible dark text surfaces
and white hero text, and respects mobile layouts. Browser-local theme choice
does not modify campground tenant permission or publication.

## Expanded rental types
The manager rental screen gains 14 category starters for pedal/paddle boats,
kayaks, canoes, SUPs, fishing craft, boats, bicycles, mobility carts, camping
gear, generators and grills, kites, outdoor games, fishing kits, winter gear,
accessible equipment, guided horseback experiences and customizable others.
The guest rentals page explains these as possible types, not live inventory.

The starter picker populates editable descriptions and safety guidance only.
The existing source asset must be registered and operational; only a real
staff-published rental listing enters availability. Each physical asset
continues to provide one provisional request slot. No new inventory,
unconfirmed bookings, charges, rentals or automatic handovers are created.

Horseback riding is an **on-site guided experience** attached to a suitable
facility/program, never a self-serve unattended animal rental. Qualified
supervision, animal welfare, insurance, age restrictions and site-specific
legal checks are outside software automation and remain mandatory.

## Production checks
Protected CI must pass formatting, lint, typecheck, unit tests, full build,
database lifecycle, browser checks, CodeQL and Gitleaks. Source-exact changed
files are promoted through dev and protected main, then verified at the same
SHA on Vercel Production. Software release GREEN does not mean physical
original-host attestation or live payment/settlement authorization GREEN.
