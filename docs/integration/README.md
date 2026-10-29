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
