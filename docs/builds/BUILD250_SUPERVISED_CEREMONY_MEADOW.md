# iCamp Build 250 — Supervised Source HEALTHY Ceremony & Owner Review Gate

## Green Meadow theme preservation

- The **Standard / Meadow** design belongs to iCamp itself, **not** Camp Rosevear. Its canonical source is `lib/theme/standard.mjs`; the existing untouched photo is `public/themes/standard/meadow-hero.webp`; its green palette, backgrounds and hero are in `app/standard-theme.css`.
- The app shell defaults to Standard / Meadow, and offers Orbit Command as a **separate** header visual selector. The selection is saved as `icamp.visualTheme.v1` in the current browser's localStorage, not in tenant data or on the server. On another browser the Meadow default is retained. Orbit is in `app/orbit-theme.css`.
- Accessibility/status meaning is independent of theme. No guest or Camp Rosevear settings are overwritten. Do not remove either theme or image asset in future shell redesigns.

## Supervised source evidence ceremony

1. The original-device signed packet must first pass Ed25519 pin and unique nonce checks in Build 247. Build 249 must then record an independent, same-campground, fresh original-device witness distinct from field reporter, source reviewer and verifier.
2. The latest owner's dossier snapshot must pass full persisted v1 hash recomputation, current source totals and exact deployment SHA.
3. Each of AI Data Platform, Rosevear Comms Hub and Rosevear AI Hub must produce a separately signed and currently valid **SOURCE_HEALTHY_OBSERVED** receipt validated by protected, independently authenticated Ed25519 pins. No browser input can introduce signer keys or receipts.
4. The *iCamp original source* must separately sign a domain-separated `icamp.original-source-healthy.v1` receipt, binding campground ID, current exact deployed SHA, latest dossier SHA-256, independent signer key ID, timestamp and nonce. Verify with separate server-only `ICAMP_SOURCE_HEALTH_PIN_JSON`, `ICAMP_SOURCE_HEALTH_RECEIPT_JSON` and `ICAMP_SOURCE_HEALTH_CUSTODIAN_ENROLLED=true` only after independent physical/source custodian enrollment. No default or development key can supply production authority.
5. A properly authenticated **campground owner/admin** may explicitly record HOLD, REJECT or (only with all fresh proof) REQUEST SUPERVISED REVIEW into an append-only private RLS ledger. The database trigger independently checks owner role, original source linkages, separate actors, current deployed SHA, latest dossier and one-time signed source nonce. No original raw signatures are persisted. The audit trail records only evidence digests and statuses.
6. **No action in this build sets CONNECTED, activates a receiver, grants Master credentials, or marks formal owner production acceptance signed.** Real runtime activation and independent owner consent require a subsequent separately authorized control-plane ceremony.

## Operational dependencies

- Migrations 0231, 0232 and new 0233 must exist on the **database actually used by production**. Isolated GitHub CI migration success is not evidence that the live target was migrated.
- The owner-only no-store export reports sanitized source HEALTHY, three Master statuses, digest state and append-only owner source decisions; it does not expose signing keys, guest PII or raw packets.
- A new deployment invalidates previously signed source revision and requires fresh genuine signature/receipt and owner evidence; stale materials intentionally remain HOLD.
- Protected CI, Chromium, PostgreSQL lifecycle, CodeQL, Gitleaks and Vercel exact-SHA production READY are release gates; real external signer and owner operational acceptance are distinct, separately supervised gates.
