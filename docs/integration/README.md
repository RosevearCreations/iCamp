# iCamp QL-246 signed source proof publication

**Current status: BLOCKED / NOT_AVAILABLE.** No genuine signed file has been delivered by an authenticated custodian; `ql246-source-proof.json` is intentionally not present. Do not create a sample, mock signature or placeholder at this path, because the public immutable GitHub check expects exact genuine signed bytes.

Once a pre-existing tested source commit **A** has a successful CI run with exactly matching `head_sha`, an independently authenticated custodian must sign the canonical `rosevear.integration.v1` QL-246 24-field payload over A using a private Ed25519 key retained outside GitHub. A separate immutable descendant **B** publishes exactly the signed envelope here as `ql246-source-proof.json`. Return B's full SHA, raw-byte SHA256, source A CI URL and public A→B ancestry, keeping all approvals and gateway tests **HELD**. Read `docs/BUILD_147_QL252_SOURCE_PROOF_DENIAL_HOLD.md` for the safe public-only preflight.

## QL-253 Build 148 public GitHub retest

`npm run audit:ql253-public-proof` remains offline unless `--public-get` is
explicitly provided. Its only remote destinations are public GitHub API and
immutable raw GitHub source paths. It independently retries the source A CI,
the exact `main` SHA's signed-proof path and genuine proof B ancestry if B is
actually available. The result cannot establish out-of-band custody trust,
owner TEST-only authorization or gateway connectivity. See
`docs/BUILD_148_QL253_IMMUTABLE_PROOF_CUSTODY_OWNER_HOLD.md`.

## QL-254 Build 149 original source and private registry witness follow-up

`npm run audit:ql254-public-proof` is offline unless `--public-get` is
explicitly supplied. Only public GitHub commits, CI and immutable proof bytes
are fetched. Registry snapshot digests and custodian/witness receipt IDs are
not authenticated by this command. No gateway, test tenant or Rosevear AI Hub
is contacted, and all owner decisions stay separate and HELD. See
`docs/BUILD_149_QL254_ORIGINAL_PROOF_REGISTRY_OWNER_HOLD.md`.

## QL-255 Build 150 six-application proof and private witness escalation

`npm run audit:ql255-six-app-proof` makes **zero network requests** unless
explicit `--public-get` is given. That opt-in checks only public GitHub
`main` and exact immutable QL-246 proof paths for the six allowlisted apps,
never any private gateway or Rosevear AI Hub machine. The new independent
owner-only reviewer ledger also records private registry/witness exception
aging and synthetic, reversible private relay *planning* while original proof,
custody and owner TEST-only authorization remain strictly **HELD**. See
`docs/BUILD_150_QL255_SIX_APP_PROOF_WITNESS_PRIVATE_RELAY_HOLD.md`.
