# iCamp Build 253 — Seven-App Connectivity Handoff

This file is a source-scoped **status handoff**, not a runtime connection request.
Order required by the owner (2026-11-14):

1. **ai-data-platform** — `RosevearCreations/ai-data-platform`; tier 0, MASTER_TOP_TIER. Root validation authority and topology source. Its current runtime signature/receipt was **not verified in this iCamp release**.
2. **rosevear-ai-hub** — `RosevearCreations/rosevear-ai-hub`; tier 1 MASTER_APPLICATION, governed by ai-data-platform. Original-host OFF/closure state is independently governed; no receiver ON is authorized by this handoff. Current external signature **not verified here**.
3. **rosevear-comms-hub** — `RosevearCreations/rosevear-comms-hub`; tier 1 MASTER_APPLICATION, governed by ai-data-platform. Public discovery does not equal private handshake or signed TEST/PRODUCTION authority. Current external signature **not verified here**.
4. **iCamp** — `RosevearCreations/iCamp`; GOVERNED_EXTERNAL_SHELL, governed by all three Master apps. Build 253 adds source-byte exact 0231–0233 migration checksum reconciliation and optional, independently Ed25519-signed database host/manifest/commit observation. Unless real protected custodian and receipt values are configured and independently verified, **SOURCE_CUSTODY=HOLD, DATABASE_PROVENANCE=HOLD, MASTER_CONNECTED=HOLD, OWNER_ACCEPTANCE=HOLD**. This release intentionally does not set receiver ON, enable bookings/communications across apps, or copy credentials.
5. **YW** — `RosevearCreations/yw`; GOVERNED_EXTERNAL_SHELL, governed by all three Masters. This iCamp source has not inspected YW's live proof; **no new state asserted**.
6. **devilndove** — `RosevearCreations/devilndove-site`; DIRECT_MASTER_APPLICATION, governed by the three Masters. No separate external Shell admission is implied. Live proof **not inspected here**.
7. **rosiedazzlers** — `RosevearCreations/rosiedazzlers`; DIRECT_MASTER_APPLICATION, governed by the three Masters. No separate Shell admission is implied. Live proof **not inspected here**.

Source of topology: `.github/rosevear-master-topology.v1.json`, `topologyId=rosevear-master-shell-seven-apps.v1`. Source file places Comms before AI Hub; the communication order above follows the owner's requested sequence without changing actual tier/parent assignments.

## Evidence contract to carry to the next app
- Sender: `icamp`; repository `RosevearCreations/iCamp`; Build `253`.
- Build source: final `main` commit SHA (attach only **after** exact-source protected merge and Vercel READY).
- Required readback: private Sysop `/sysop/provenance-review`; public safety/status can use existing `/status` and existing source integration manifest. The Sysop page is **not** a remote API for other apps.
- Migration digests: SQL sources 0231/0232/0233, source repo and current deployed revision. A positive checksum match is **only source integrity**.
- Independent database reviewer: only actual, independently enrolled Ed25519 public-key pin and real signature binding source SHA, database hostname SHA-256 (not host disclosure), canonical migration manifest SHA-256, issued-at, and nonce. Do not pass private keys, passwords, raw DB URL, user/guest records, or simulated receipts between applications.
- Three-Master CONNECTED requires independently reviewed current originals from `ai-data-platform`, `rosevear-ai-hub`, and `rosevear-comms-hub` under the receiving app's existing signed contracts; no shared label or visual indicator grants authority.
- Meadow theme: canonical platform `Standard / Meadow`, original `public/themes/standard/meadow-hero.webp`, separate selectable `Orbit Command`. Do not replace it with Camp Rosevear-only styling.

## Handoff line

`ICAMP BUILD253 | MAIN_SHA=<verified-main-sha> | VERCEL_PRODUCTION=<READY-or-HOLD> | MIGRATIONS_0231_0233=<observed-or-HOLD> | DATABASE_PROVENANCE=<signed-source-only-or-HOLD> | ORIGINAL_SIGNER=<source-only-or-HOLD> | MASTERS_CONNECTED=HOLD | OWNER_ACCEPTANCE=HOLD | NEXT=YW`

Fill the placeholders from **verified runtime evidence**, not intended state. Never print secrets.
